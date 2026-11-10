"""Move prices from the sales team's Google Sheets, for the country pages.

    GET /prices?route=india&city=Mumbai&cft=650 [&origin=Singapore]
        -> {id, price, currency, cft, band, type, shipment_type, container_type, breakdown, port, via, tab, options}
        or {price: null, cft, reason}  (reason: origin | city | volume; our team quotes instead)
    options: every way to ship this move, cheapest first (the top-level fields are the cheapest), each
    {id, price, band, type, shipment_type, container_type, breakdown, port, via, tab}. At 351-600 CFT
    that is Console (shared, slower) and 20' FCL (own container, faster), and the customer chooses.
    One option per type, except when a city is in more than one port's list (e.g. Chittoor: 20' FCL
    via Chennai or via ICD Bangalore): then each port is an option.
    id: the type ("Console"), or "<type> via <port city>" when two options have the same type.
    breakdown: {origin, freight, destination, margin[, inland]} in whole SGD adding up to the price,
    from the rows "Origin - Total Cost (SGD)", "Freight all in Rate (SGD)", "Destination - Total Cost
    (SGD)" and "Margin (SGD)" (empty = 0); null when those rows don't add up to the quote amount.
    port: the "POE:" port of the tab the price comes from.
    via: the port city when the price is that tab's price plus the inland charge (breakdown
    "inland") to the customer's city, else null.
    reason "volume" only when the move is larger than every band in the sheet; a city that has
    prices, but none for this volume, gets "city".

Settings (ai/.env):
    GOOGLE_SERVICE_ACCOUNT_FILE  path to the service account's JSON key (the "robot" the sheets are shared with)
    PRICE_SHEETS                 route=sheet id pairs, e.g. india=1EhB...,germany=1Uw...
    PRICE_CACHE_SECONDS          how long a sheet is kept before reading it again (default 3600)

Sheet layout. One sheet per route. A city tab "<Origin> to <City>" prices its city: the row
"Line Item" gives Console / 20' FCL / 40' FCL, the row "Volume in CFT" the bands ("Upto 50 CFT",
"351 - 400 CFT"), the row "Quote Amount (SGD)" the price and "POE: <port>" the port. A port tab
"<Origin> to <Country> (POE: <Port>)", e.g. "Singapore to India (POE: Chennai)", prices its port city
the same way. Any of these tabs can have, below a row "<Port> to Other Cities", one row per city
with the inland charge per band column: a number = the tab's price plus that charge; empty or
"#N/A" = not shipped via this tab's port in that band. "Tumakuru (Tumkur)", "Hubballi-Dharwad" or
"Hampi / Hosapete" match each name inside them (a whole row name comes first); a city listed twice
in one list keeps the higher charge. Rows are found by their label, so sales can add or move rows.
If a sheet can't be read, the last good copy is used.

Which price a city gets (sales rules, 2026-11-10):
    Console: when the sheet has a port tab, only from it (India: Console always via Chennai, i.e.
    Chennai's price plus the city's inland charge); Console columns in the other tabs (hidden in
    Mumbai and Bangalore) are not used. In a sheet without a port tab: as for FCL.
    20' / 40' FCL: from the city's own tab (e.g. Mumbai via Nhava Sheva); else from every list that
    has a number for the city ("nearest port": Delhi via the Mumbai list, Mysuru via Bangalore).
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

CITY_NAMES = [  # spellings of one city (letters only); the first is the one prices are kept under
    ("bangalore", "bengaluru"),
    ("mumbai", "bombay"),
    ("chennai", "madras"),
    ("delhincr", "delhi", "newdelhi", "gurgaon", "gurugram", "noida", "ghaziabad", "faridabad"),
    ("kochi", "cochin"),
    ("mysuru", "mysore"),
    ("mangaluru", "mangalore"),
    ("thiruvananthapuram", "trivandrum"),
    ("visakhapatnam", "vizag", "vishakhapatnam"),
    ("kolkata", "calcutta"),
    ("puducherry", "pondicherry"),
    ("tiruchirappalli", "trichy"),
    ("hubballi", "hubli", "hubballihubli"),
    ("vadodara", "baroda"),
    ("bhatinda", "bathinda"),
    ("pune", "poona"),
    ("tumakuru", "tumkur"),
    ("shivamogga", "shimoga"),
    ("ballari", "bellary"),
    ("belagavi", "belgaum"),
    ("vijayapura", "bijapur"),
    ("kalaburagi", "gulbarga"),
    ("hosapete", "hospet"),
    ("chikmagalur", "chikkamagaluru"),
]
_CANON = {name: names[0] for names in CITY_NAMES for name in names}
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
PORT_TAB = re.compile(r"\(\s*poe\s*:", re.I)  # "Singapore to India (POE: Chennai)"

_cache: dict[str, tuple[float, dict]] = {}  # route -> (read at, sheet from _read_sheet)
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


def _city_key(name) -> str:
    """'Delhi (NCR)', 'Delhi NCR' and 'New Delhi, India' all give 'delhincr'."""
    key = re.sub(r"[^a-z]", "", str(name).split(",")[0].lower())
    return _CANON.get(key, key)


def _city_keys(name) -> tuple[str, list[str]]:
    """A list row's whole name and the names inside it:
    'Tumakuru (Tumkur)' -> ('tumakurutumkur', ['tumakuru']), 'Hubballi-Dharwad' -> (..., ['hubballi', 'dharwad'])."""
    full = _city_key(name)
    inside = (_city_key(part) for part in re.split(r"[()/,\-–]", str(name)))
    return full, [k for k in dict.fromkeys(inside) if len(k) >= 3 and k != full]


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


def _merge(into: dict, key: str, charges: dict) -> None:
    """A city listed twice keeps the higher charge in each band, so we never quote too low."""
    old = into.get(key, {})
    into[key] = {col: max(v, old.get(col, v)) for col, v in {**old, **charges}.items()}


def _parse_tab(title: str, rows: list[list]) -> tuple[str, str, dict, dict] | None:
    """(origin, city, tab, extras) from one city or port tab, or None if it isn't one.
    city: the city the tab itself prices (a port tab: its port city).
    extras: {city: {column: inland charge}} from the tab's "<Port> to Other Cities" list."""
    origin, sep, rest = title.strip().partition(" to ")
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
            out.append({"label": str(bands[i]).strip(), "range": rng, "type": kind, "price": price, "parts": parts, "col": i})
    whole, inside = {}, {}
    start = next((i for i, r in enumerate(rows) if r and str(r[0]).strip().lower().endswith("to other cities")), None)
    if start is not None:
        for r in rows[start + 1:]:
            # Numbers only: "#N/A" or an empty cell = not via this port in that band. Rows without numbers are notes.
            charges = {i: v for i, v in enumerate(r) if i and isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0}
            full, names = _city_keys(r[0]) if r else ("", [])
            if full and charges:
                _merge(whole, full, charges)
                for name in names:
                    _merge(inside, name, charges)
    port_tab = bool(PORT_TAB.search(rest))
    city = _city_key(port if port_tab else rest)
    tab = {"tab": title.strip(), "port": port, "port_tab": port_tab, "bands": out}
    return origin.strip().lower(), city, tab, {**inside, **whole}  # a whole row name beats a name inside another row


def _read_sheet(sheet_id: str) -> dict:
    """{own: {(origin, city): tab}, lists: [(origin, tab, extras)], origins, port_tab_origins, biggest}"""
    headers = {"Authorization": f"Bearer {_token()}"}
    with httpx.Client(timeout=20, headers=headers) as client:
        meta = client.get(f"{SHEETS_API}/{sheet_id}", params={"fields": "sheets.properties.title"})
        meta.raise_for_status()
        titles = [s["properties"]["title"] for s in meta.json()["sheets"]]
        values = client.get(f"{SHEETS_API}/{sheet_id}/values:batchGet",
                            params={"ranges": [f"'{t}'!A1:AZ500" for t in titles], "valueRenderOption": "UNFORMATTED_VALUE"})
        values.raise_for_status()
    own, lists, origins, port_tab_origins, biggest = {}, [], set(), set(), 0
    for title, vr in zip(titles, values.json()["valueRanges"]):
        parsed = _parse_tab(title, vr.get("values", []))
        if not parsed:
            continue
        origin, city, tab, extras = parsed
        origins.add(origin)
        if tab["port_tab"]:
            port_tab_origins.add(origin)
        if (origin, city) not in own or (tab["port_tab"] and not own[(origin, city)]["port_tab"]):
            own[(origin, city)] = tab  # the port tab beats an older tab for its port city ("Singapore to Chennai")
        if extras:
            lists.append((origin, tab, extras))
        biggest = max([biggest, *(b["range"][1] for b in tab["bands"])])
    return {"own": own, "lists": lists, "origins": origins, "port_tab_origins": port_tab_origins, "biggest": biggest}


def _tabs(route: str) -> dict:
    with _lock:
        read_at, sheet = _cache.get(route, (0.0, {}))
        if time.time() - read_at < CACHE_SECONDS:
            return sheet
        try:
            sheet = _read_sheet(SHEETS[route])
            _cache[route] = (time.time(), sheet)
            log.info("Price sheet %s: %d city tabs, %d city lists", route, len(sheet["own"]), len(sheet["lists"]))
        except Exception:
            log.exception("Price sheet %s could not be read", route)
            if not read_at:
                raise
            _cache[route] = (time.time() - CACHE_SECONDS + 300, sheet)  # keep the last copy, retry in 5 minutes
        return sheet


def price(route: str, origin: str, city: str, cft: float) -> dict:
    cft = max(1, math.ceil(cft))
    sheet = _tabs(route)
    origin = origin.strip().lower()
    if origin not in sheet["origins"]:
        return {"price": None, "cft": cft, "reason": "origin"}
    key = _city_key(city)
    port_only = origin in sheet["port_tab_origins"]
    usable = lambda tab, b: b["type"] != "Console" or tab["port_tab"] or not port_only  # Console only via the port tab

    own = sheet["own"].get((origin, key))
    own_types = {b["type"] for b in own["bands"] if usable(own, b)} if own else set()
    priced = []  # (tab, band, inland charge, via): the city's own tab first, then each list it is in
    if own:
        priced += [(own, b, 0, None) for b in own["bands"] if usable(own, b)]
    for o, tab, extras in sheet["lists"]:
        charges = extras.get(key) if o == origin and tab is not own else None
        if charges:
            via = tab["port"].split(",")[0].strip()
            priced += [(tab, b, charges[b["col"]], via) for b in tab["bands"]
                       if usable(tab, b) and b["col"] in charges and b["type"] not in own_types]
    fits = [p for p in priced if p[1]["range"][0] <= cft <= p[1]["range"][1]]
    if not fits:
        return {"price": None, "cft": cft, "reason": "volume" if priced and cft > sheet["biggest"] else "city"}

    options = {}  # the cheapest band of each type from each tab, cheapest first
    for tab, b, inland, via in sorted(fits, key=lambda p: p[1]["price"] + p[2]):
        if (b["type"], tab["tab"]) in options:
            continue
        total = round(b["price"] + inland)
        shipment_type, container_type = SHIPMENT[b["type"].lower()]
        parts = {**b["parts"], "inland": inland} if b["parts"] and inland else b["parts"]
        options[(b["type"], tab["tab"])] = {
            "id": b["type"], "price": total, "band": b["label"], "type": b["type"],
            "shipment_type": shipment_type, "container_type": container_type,
            "breakdown": _breakdown(parts, total), "port": tab["port"], "via": via, "tab": tab["tab"]}
    options = list(options.values())
    for o in options:
        if sum(x["type"] == o["type"] for x in options) > 1:
            o["id"] = f"{o['type']} via {o['via'] or o['port'].split(',')[0].strip()}"
    return {**options[0], "currency": "SGD", "cft": cft, "options": options}


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
