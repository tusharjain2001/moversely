"""Chat, leads and the admin view.

    POST /chat                  {conversation_id?, text?, value?} -> assistant messages + next input widget
    GET  /chat/{id}             the conversation so far (to continue after a reload)
    POST /leads                 the homepage form -> {lead_id}
    POST /leads/{id}/survey     {items, volume_ft3} once the visitor reaches the summary
    GET  /admin/leads           all leads           (header X-Admin-Password)
    GET  /admin/leads/{id}      one lead with its chat

ADMIN_PASSWORD must be set for the admin endpoints to work.
"""

import os
import secrets

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from . import chat, db


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
    to: str = Field(max_length=40)
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
        "name": body.name, "email": body.email, "phone": body.phone, "from_country": body.from_, "to_country": body.to,
        "move_date": body.date, "move_type": body.moveType,
    }, body.lead_id)
    return {"lead_id": lead_id}


@router.post("/leads/{lead_id}/survey")
def lead_survey(lead_id: str, body: SurveyIn):
    if not db.save_survey(lead_id, body.items, body.volume_ft3):
        raise HTTPException(404, "Unknown lead.")
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
