"""Move prices from the sales team's Google Sheets, for the country pages.

    GET /prices?route=india&city=Mumbai&cft=650 [&origin=Singapore]
        -> {price, currency, cft, band, type, shipment_type, container_type, breakdown, port, tab, options}
        or {price: null, cft, reason}  (reason: origin | city | volume; our team quotes instead)
    options: one {price, band, type, shipment_type, container_type, breakdown} per container type
    that fits, cheapest first (the top-level fields are the cheapest). At 351-600 CFT that is Console
    (shared, slower) and 20' FCL (own container, faster), and the customer chooses.
    breakdown: {origin, freight, destination, margin} in whole SGD adding up to the price, from the
    rows "Origin - Total Cost (SGD)", "Freight all in Rate (SGD)", "Destination - Total Cost (SGD)"
    and "Margin (SGD)" (empty = 0); null when those rows don't add up to the quote amount.

Settings (ai/.env):
    GOOGLE_SERVICE_ACCOUNT_FILE  path to the service account's JSON key (the "robot" the sheets are shared with)
    PRICE_SHEETS                 route=sheet id pairs, e.g. india=1EhB...,germany=1Uw...
    PRICE_CACHE_SECONDS          how long a sheet is kept before reading it again (default 3600)

One sheet per route, one tab per city named "<Origin> to <City>". In each tab the
row "Line Item" gives Console / 20' FCL / 40' FCL, the row "Volume in CFT" the
bands ("Upto 50 CFT", "351 - 400 CFT"), and the row "Quote Amount (SGD)" the
price. Rows are found by their label, so sales can add or move rows. If a sheet
can't be read, the last good copy is used.
"""

import logging
import math
import os
import re
import threading
import time

import httpx
from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

log = logging.getLogger(__name__)
router = APIRouter()

KEY_FILE = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "")
SHEETS = dict(pair.strip().split("=", 1) for pair in os.environ.get("PRICE_SHEETS", "").split(",") if "=" in pair)
CACHE_SECONDS = int(os.environ.get("PRICE_CACHE_SECONDS", "3600"))
SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"

ALIASES = {"bengaluru": "bangalore", "bombay": "mumbai", "madras": "chennai", "new delhi": "delhi"}
SHIPMENT = {
    "console": ("CONSOLE", "NONE"),
    "20' fcl": ("FCL", "FT_20"),
    "40' fcl": ("FCL", "FT_40"),
}
PARTS = {
    "origin": "origin - total cost (sgd)",
    "freight": "freight all in rate (sgd)",
    "destination": "destination - total cost (sgd)",
    "margin": "margin (sgd)",
}

_cache: dict[str, tuple[float, dict]] = {}  # route -> (read at, {city: tab})
_lock = threading.Lock()
_creds = None


def _token() -> str:
    global _creds
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account

    if _creds is None:
        _creds = service_account.Credentials.from_service_account_file(
            KEY_FILE, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
    if not _creds.valid:
        _creds.refresh(Request())
    return _creds.token


def _band(label) -> tuple[int, int] | None:
    nums = [int(n) for n in re.findall(r"\d+", str(label))]
    if len(nums) == 1:
        return 0, nums[0]
    return (nums[0], nums[1]) if len(nums) == 2 else None


def _num(row: list, i: int) -> float:
    value = row[i] if i < len(row) else None
    return value if isinstance(value, (int, float)) else 0


def _breakdown(parts: dict | None, total: int) -> dict | None:
    """Whole-dollar parts that add up to the rounded total (the rounding goes on the largest part)."""
    if not parts:
        return None
    out = {k: round(v) for k, v in parts.items()}
    out[max(out, key=out.get)] += total - sum(out.values())
    return out


def _parse_tab(title: str, rows: list[list]) -> tuple[str, str, dict] | None:
    """(origin, city, tab) from one city tab, or None if it isn't one."""
    origin, sep, city = title.strip().partition(" to ")
    if not sep:
        return None
    label = {str(r[0]).strip().lower(): r for r in rows if r}
    bands, quote, types = label.get("volume in cft"), label.get("quote amount (sgd)"), label.get("line item", [])
    if not (bands and quote):
        return None
    port = next((str(r[0]).split(":", 1)[1].strip() for r in rows if r and str(r[0]).upper().startswith("POE:")), "")
    part_rows = {k: label.get(name, []) for k, name in PARTS.items()}
    out, kind = [], ""
    for i in range(1, len(bands)):
        kind = str(types[i]).strip() if i < len(types) and str(types[i]).strip() else kind  # merged header cells
        rng, price = _band(bands[i]), quote[i] if i < len(quote) else None
        if rng and isinstance(price, (int, float)) and price > 0 and kind.lower() in SHIPMENT:
            parts = {k: _num(r, i) for k, r in part_rows.items()}
            # Only shown when it matches the quote, e.g. not if sales add a charge outside these rows.
            parts = parts if abs(sum(parts.values()) - price) < 1 else None
            out.append({"label": str(bands[i]).strip(), "range": rng, "type": kind, "price": price, "parts": parts})
    city = city.split(",")[0].strip().lower()
    return origin.strip().lower(), city, {"tab": title.strip(), "port": port, "bands": out}


def _read_sheet(sheet_id: str) -> dict:
    headers = {"Authorization": f"Bearer {_token()}"}
    with httpx.Client(timeout=20, headers=headers) as client:
        meta = client.get(f"{SHEETS_API}/{sheet_id}", params={"fields": "sheets.properties.title"})
        meta.raise_for_status()
        titles = [s["properties"]["title"] for s in meta.json()["sheets"]]
        values = client.get(f"{SHEETS_API}/{sheet_id}/values:batchGet",
                            params={"ranges": [f"'{t}'!A1:AZ100" for t in titles], "valueRenderOption": "UNFORMATTED_VALUE"})
        values.raise_for_status()
    tabs = {}
    for title, vr in zip(titles, values.json()["valueRanges"]):
        parsed = _parse_tab(title, vr.get("values", []))
        if parsed:
            origin, city, tab = parsed
            tabs[(origin, city)] = tab
    return tabs


def _tabs(route: str) -> dict:
    with _lock:
        read_at, tabs = _cache.get(route, (0.0, {}))
        if time.time() - read_at < CACHE_SECONDS:
            return tabs
        try:
            tabs = _read_sheet(SHEETS[route])
            _cache[route] = (time.time(), tabs)
            log.info("Price sheet %s: %d city tabs", route, len(tabs))
        except Exception:
            log.exception("Price sheet %s could not be read", route)
            if not read_at:
                raise
            _cache[route] = (time.time() - CACHE_SECONDS + 300, tabs)  # keep the last copy, retry in 5 minutes
        return tabs


def price(route: str, origin: str, city: str, cft: float) -> dict:
    cft = max(1, math.ceil(cft))
    tabs = _tabs(route)
    origin = origin.strip().lower()
    if not any(o == origin for o, _ in tabs):
        return {"price": None, "cft": cft, "reason": "origin"}
    city = city.split(",")[0].strip().lower()
    tab = tabs.get((origin, ALIASES.get(city, city))) or tabs.get((origin, city))
    if not tab:
        return {"price": None, "cft": cft, "reason": "city"}
    fits = [b for b in tab["bands"] if b["range"][0] <= cft <= b["range"][1]]
    if not fits:
        return {"price": None, "cft": cft, "reason": "volume"}
    options = {}  # the cheapest band of each type, cheapest type first
    for b in sorted(fits, key=lambda b: b["price"]):
        if b["type"] not in options:
            shipment_type, container_type = SHIPMENT[b["type"].lower()]
            options[b["type"]] = {"price": round(b["price"]), "band": b["label"], "type": b["type"],
                                  "shipment_type": shipment_type, "container_type": container_type,
                                  "breakdown": _breakdown(b["parts"], round(b["price"]))}
    options = list(options.values())
    return {**options[0], "currency": "SGD", "cft": cft, "port": tab["port"], "tab": tab["tab"], "options": options}


@router.get("/prices")
async def get_price(
    route: str = Query(max_length=40),
    city: str = Query(max_length=80),
    cft: float = Query(gt=0, le=100000),
    origin: str = Query("Singapore", max_length=60),
):
    if route not in SHEETS or not KEY_FILE:
        raise HTTPException(404, "No price sheet for this route.")
    try:
        return await run_in_threadpool(price, route, origin, city, cft)
    except Exception:
        raise HTTPException(503, "Prices are not available right now. Please try again shortly.")
