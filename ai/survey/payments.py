"""Payments for the country pages, with the amount set by this server, not the browser.

    POST /payment {order_id, route, origin, city, cft, type, price, email, name, origin_port, destination_port}
        -> {client_secret, price, currency}
        409 {code: "price_changed", price, quote}  the sheet price changed since the quotation was shown
        409 {code: "no_price"}                     this option has no online price any more

The browser says which option the customer chose (type, e.g. "Console") and the price it
showed; it never sets the amount. The price is looked up in the sales sheet again
(prices.py), saved on the Moversly order (create-pricing-with-split) and a Stripe payment is
opened for it (survey-app/payment-intent), both server to server with the same bodies the
Malaysia page sends. The browser gets only the Stripe client secret.

Settings (ai/.env):
    MOVERSLY_API_URL   default https://api.moversly.com
"""

import logging
import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from . import prices

log = logging.getLogger(__name__)
router = APIRouter()

API = os.environ.get("MOVERSLY_API_URL", "https://api.moversly.com").rstrip("/")


class PaymentIn(BaseModel):
    order_id: str = Field(min_length=1, max_length=60)
    route: str = Field(max_length=40)
    origin: str = Field("Singapore", max_length=60)
    city: str = Field(max_length=80)
    cft: float = Field(gt=0, le=100000)
    type: str = Field(max_length=20)
    price: float | None = None  # the price the customer saw
    email: str = Field(max_length=200)
    name: str = Field(max_length=120)
    origin_port: str = Field("", max_length=80)
    destination_port: str = Field("", max_length=80)


def _find(data, names: tuple[str, ...]):
    """First value under one of these keys anywhere in a nested response."""
    if isinstance(data, dict):
        for k, v in data.items():
            if k in names and v:
                return v
        data = list(data.values())
    if isinstance(data, list):
        for v in data:
            found = _find(v, names)
            if found:
                return found
    return None


def _post(client: httpx.Client, path: str, body: dict):
    res = client.post(API + path, json=body)
    if res.status_code >= 400:
        raise RuntimeError(f"{path} returned {res.status_code}: {res.text[:300]}")
    return res.json() if res.content else None


def _open_payment(p: PaymentIn, option: dict, cft: int, currency: str) -> str | None:
    amount = {"currency": currency, "amount": str(option["price"])}
    with httpx.Client(timeout=30) as client:
        try:
            _post(client, "/api/v1/order/create-pricing-with-split", {
                "order_id": p.order_id,
                "volume": {"magnitude": str(cft), "unit": "CUBIC_FT"},
                "container_type": option["container_type"],
                "shipment_type": option["shipment_type"],
                "origin_port": p.origin_port,
                "destination_port": p.destination_port,
                "final_price": amount,
                "from_survey_app": True,
            })
        except Exception:
            # As on the Malaysia page: the customer can still pay if saving the price fails.
            log.exception("create-pricing-with-split failed for order %s", p.order_id)
        res = _post(client, "/api/v1/order/survey-app/payment-intent",
                    {"orderId": p.order_id, "email": p.email, "name": p.name, "amount": amount})
    return _find(res, ("clientSecret", "client_secret"))


@router.post("/payment")
async def create_payment(p: PaymentIn):
    if p.route not in prices.SHEETS or not prices.KEY_FILE:
        raise HTTPException(404, "No price sheet for this route.")
    try:
        quote = await run_in_threadpool(prices.price, p.route, p.origin, p.city, p.cft)
    except Exception:
        raise HTTPException(503, "Prices are not available right now. Please try again shortly.")
    option = next((o for o in quote.get("options", []) if o["type"] == p.type), None)
    if not option:
        raise HTTPException(409, {"code": "no_price", "message": "This price is no longer available online."})
    if p.price is not None and round(p.price) != option["price"]:
        raise HTTPException(409, {"code": "price_changed", "price": option["price"], "quote": quote})
    try:
        secret = await run_in_threadpool(_open_payment, p, option, quote["cft"], quote["currency"])
    except Exception:
        log.exception("payment-intent failed for order %s", p.order_id)
        secret = None
    if not secret:
        raise HTTPException(502, "We couldn't start the payment. Please try again.")
    log.info("Payment opened for order %s: %s %s (%s)", p.order_id, quote["currency"], option["price"], p.type)
    return {"client_secret": secret, "price": option["price"], "currency": quote["currency"]}
