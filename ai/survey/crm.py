"""Chat, leads and the admin view.

    POST /chat                  {conversation_id?, text?, value?} -> assistant messages + next input widget
    GET  /chat/{id}             the conversation so far (to continue after a reload)
    POST /leads                 the homepage form -> {lead_id}
    POST /leads/{id}/survey     {items, volume_ft3} once the visitor reaches the summary
    GET  /admin/leads           all leads           (header X-Admin-Password)
    GET  /admin/leads/{id}      one lead with its chat

ADMIN_PASSWORD must be set for the admin endpoints to work. New leads and
finished surveys are emailed to the team when SMTP is set up (see notify.py).
"""

import os
import secrets

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from . import chat, db, notify


class ChatIn(BaseModel):
    conversation_id: str | None = Field(None, max_length=16)
    text: str = Field("", max_length=500)
    value: str = Field("", max_length=100)


class LeadIn(BaseModel):
    lead_id: str | None = Field(None, max_length=16)
    name: str = Field(max_length=120)
    email: str = Field(max_length=200)
    phone: str = Field(max_length=40)
    from_: str = Field(alias="from", max_length=40)
    to: str = Field(max_length=60)  # country slug, or a country name we have no customs summary for
    toPlace: str | None = Field(None, max_length=120)  # the place picked in the search box, e.g. "Toronto, Canada"
    date: str = Field(max_length=10)
    moveType: str = Field(max_length=16)


class SurveyIn(BaseModel):
    items: int = Field(ge=0, le=10000)
    volume_ft3: float = Field(ge=0, le=100000)


def _check_admin(password: str | None) -> None:
    expected = os.environ.get("ADMIN_PASSWORD", "")
    if not expected:
        raise HTTPException(503, "Admin is not set up. Set ADMIN_PASSWORD on the AI server.")
    if not password or not secrets.compare_digest(password, expected):
        raise HTTPException(401, "Wrong password.")


router = APIRouter()


@router.post("/chat")
async def chat_turn(body: ChatIn):
    if not body.conversation_id:
        return await run_in_threadpool(chat.start)
    out = await run_in_threadpool(chat.turn, body.conversation_id, body.text, body.value)
    if out is None:
        raise HTTPException(404, "Unknown conversation.")
    return out


@router.get("/chat/{cid}")
def chat_get(cid: str):
    out = chat.resume(cid)
    if out is None:
        raise HTTPException(404, "Unknown conversation.")
    return out


@router.post("/leads")
def lead_create(body: LeadIn):
    lead_id = db.save_lead("form", {
        "name": body.name, "email": body.email, "phone": body.phone, "from_country": body.from_,
        "to_country": body.to[:40], "move_date": body.date, "move_type": body.moveType,
        "extras": {"to_place": body.toPlace} if body.toPlace else None,
    }, body.lead_id)
    if lead_id != body.lead_id:  # a new lead, not the same visitor sending the form again
        notify.new_lead(db.get_lead(lead_id))
    return {"lead_id": lead_id}


@router.post("/leads/{lead_id}/survey")
def lead_survey(lead_id: str, body: SurveyIn):
    before = db.get_lead(lead_id)
    if not before or not db.save_survey(lead_id, body.items, body.volume_ft3):
        raise HTTPException(404, "Unknown lead.")
    # The summary page saves again whenever a room changes; email only the first real result.
    if body.items and not before["survey_items"]:
        notify.survey_done(db.get_lead(lead_id))
    return {"ok": True}


@router.get("/admin/leads")
def admin_leads(x_admin_password: str | None = Header(None)):
    _check_admin(x_admin_password)
    return db.list_leads()


@router.get("/admin/leads/{lead_id}")
def admin_lead(lead_id: str, x_admin_password: str | None = Header(None)):
    _check_admin(x_admin_password)
    lead = db.get_lead(lead_id)
    if not lead:
        raise HTTPException(404, "Unknown lead.")
    return lead
