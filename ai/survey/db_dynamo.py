"""Leads in DynamoDB (DATABASE_URL=dynamodb). Same functions and results as
db.py, so nothing else changes.

Only leads are stored: one table, {prefix}leads (key: id), created once with
deploy/create-tables.sh. Chats and survey results are not stored. A chat is
kept in memory while it is going on (so it can move from question to
question) and dropped a day later or when the server restarts; a survey
result is kept in memory only so the "survey done" email can include it.

The prefix is DYNAMODB_TABLE_PREFIX (default "survey-"). On EC2 the server's
IAM role gives access, so no AWS keys are stored; the region comes from
AWS_REGION. The admin list reads the whole table and sorts it, which is fine
for thousands of leads.
"""

import json
import os
import threading
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3

from .db import new_id

PREFIX = os.environ.get("DYNAMODB_TABLE_PREFIX", "survey-")
# What a lead keeps: contact and move details, not the chat it came from.
STORED_FIELDS = ("name", "email", "phone", "from_country", "to_country", "move_date", "move_type", "extras")
LEAD_COLUMNS = ("id", "created_at", "source", *STORED_FIELDS, "conversation_id", "survey_items",
                "survey_volume_ft3", "survey_updated_at")
KEEP_CHATS = timedelta(days=1)

_table = None
_lock = threading.Lock()
_chats: dict[str, dict] = {}  # conversation id -> {"created_at", "updated_at", "state", "lead_id", "messages"}
_surveys: dict[str, dict] = {}  # lead id -> survey fields


def leads():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION") or None).Table(PREFIX + "leads")
    return _table


def now() -> str:
    # Fixed width, so times sort correctly as text.
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")


def _plain(value):
    """DynamoDB returns every number as a Decimal; give back int or float."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value


def _lead(item: dict) -> dict:
    lead = {k: _plain(item.get(k)) for k in LEAD_COLUMNS}
    lead["extras"] = json.loads(item["extras"]) if item.get("extras") else None
    lead.update(_surveys.get(lead["id"], {}))
    return lead


def save_lead(source: str, fields: dict, lead_id: str | None = None) -> str:
    """Create a lead, or update it when the same visitor submits again."""
    values = {k: fields.get(k) for k in STORED_FIELDS if k in fields}
    if "extras" in values:
        values["extras"] = json.dumps(values["extras"]) if values["extras"] is not None else None
    if lead_id and values:
        try:
            leads().update_item(
                Key={"id": lead_id}, ConditionExpression="attribute_exists(id)",
                UpdateExpression="SET " + ", ".join(f"#{i} = :{i}" for i in range(len(values))),
                ExpressionAttributeNames={f"#{i}": k for i, k in enumerate(values)},
                ExpressionAttributeValues={f":{i}": v for i, v in enumerate(values.values())})
            return lead_id
        except leads().meta.client.exceptions.ConditionalCheckFailedException:
            pass
    elif lead_id and leads().get_item(Key={"id": lead_id}).get("Item"):
        return lead_id
    lead_id = new_id()
    leads().put_item(Item={"id": lead_id, "created_at": now(), "source": source, **values})
    return lead_id


def save_survey(lead_id: str, items: int, volume_ft3: float) -> bool:
    if not leads().get_item(Key={"id": lead_id}).get("Item"):
        return False
    _surveys[lead_id] = {"survey_items": items, "survey_volume_ft3": round(volume_ft3, 1),
                         "survey_updated_at": now()}
    return True


def list_leads(limit: int = 200) -> list[dict]:
    items, kwargs = [], {}
    while True:
        page = leads().scan(**kwargs)
        items += page["Items"]
        if "LastEvaluatedKey" not in page:
            break
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    items.sort(key=lambda i: i["created_at"], reverse=True)
    return [_lead(i) for i in items[:limit]]


def get_lead(lead_id: str) -> dict | None:
    item = leads().get_item(Key={"id": lead_id}).get("Item")
    if not item:
        return None
    lead = _lead(item)
    chat = next((c for c in _chats.values() if c["lead_id"] == lead_id), None)
    lead["messages"] = list(chat["messages"]) if chat else []
    return lead


def _forget_old_chats() -> None:
    cutoff = (datetime.now(timezone.utc) - KEEP_CHATS).strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")
    for cid in [cid for cid, c in _chats.items() if c["updated_at"] < cutoff]:
        del _chats[cid]


def new_conversation(state: dict) -> str:
    cid, at = new_id(), now()
    with _lock:
        _forget_old_chats()
        _chats[cid] = {"created_at": at, "updated_at": at, "state": json.loads(json.dumps(state)),
                       "lead_id": None, "messages": []}
    return cid


def get_conversation(cid: str) -> dict | None:
    chat = _chats.get(cid)
    if not chat:
        return None
    return {"id": cid, "created_at": chat["created_at"], "updated_at": chat["updated_at"],
            "state": json.loads(json.dumps(chat["state"])), "lead_id": chat["lead_id"]}


def save_conversation(cid: str, state: dict, lead_id: str | None = None) -> None:
    chat = _chats.get(cid)
    if chat:
        chat.update(state=json.loads(json.dumps(state)), updated_at=now())
        if lead_id:
            chat["lead_id"] = lead_id


def add_message(cid: str, role: str, text: str) -> None:
    chat = _chats.get(cid)
    if chat:
        chat["messages"].append({"role": role, "text": text, "created_at": now()})


def get_messages(cid: str) -> list[dict]:
    chat = _chats.get(cid)
    return list(chat["messages"]) if chat else []
