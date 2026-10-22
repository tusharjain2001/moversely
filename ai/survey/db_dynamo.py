"""Leads and chat history in DynamoDB (DATABASE_URL=dynamodb). Same functions
and results as db.py, so nothing else changes.

Three tables, created once with deploy/create-tables.sh:
- {prefix}leads          key: id
- {prefix}conversations  key: id
- {prefix}messages       key: conversation_id + at (time, so messages come back in order)
The prefix is DYNAMODB_TABLE_PREFIX (default "survey-"). On EC2 the server's
IAM role gives access, so no AWS keys are stored; the region comes from
AWS_REGION.

The admin list reads the whole leads table and sorts it, which is fine for
thousands of leads.
"""

import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key

from .db import LEAD_FIELDS, new_id

PREFIX = os.environ.get("DYNAMODB_TABLE_PREFIX", "survey-")
LEAD_COLUMNS = ("id", "created_at", "source", *LEAD_FIELDS, "survey_items", "survey_volume_ft3",
                "survey_updated_at")

_tables: dict = {}


def _table(name: str):
    if name not in _tables:
        _tables[name] = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION") or None).Table(PREFIX + name)
    return _tables[name]


def now() -> str:
    # Fixed width, so times sort correctly as text.
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f+00:00")


def _plain(value):
    """DynamoDB returns every number as a Decimal; give back int or float."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def _lead(item: dict) -> dict:
    lead = {k: _plain(item.get(k)) for k in LEAD_COLUMNS}
    lead["extras"] = json.loads(item["extras"]) if item.get("extras") else None
    return lead


def _set(table: str, key: dict, values: dict, must_exist: bool = True) -> bool:
    """Update some attributes of one item; False if it doesn't exist."""
    names = {f"#{i}": k for i, k in enumerate(values)}
    vals = {f":{i}": v for i, v in enumerate(values.values())}
    try:
        _table(table).update_item(
            Key=key,
            UpdateExpression="SET " + ", ".join(f"#{i} = :{i}" for i in range(len(values))),
            ExpressionAttributeNames=names, ExpressionAttributeValues=vals,
            **({"ConditionExpression": "attribute_exists(id)"} if must_exist else {}))
        return True
    except _table(table).meta.client.exceptions.ConditionalCheckFailedException:
        return False


def save_lead(source: str, fields: dict, lead_id: str | None = None) -> str:
    """Create a lead, or update it when the same visitor submits again."""
    values = {k: fields.get(k) for k in LEAD_FIELDS if k in fields}
    if "extras" in values:
        values["extras"] = json.dumps(values["extras"]) if values["extras"] is not None else None
    if lead_id and values and _set("leads", {"id": lead_id}, values):
        return lead_id
    if lead_id and not values and _table("leads").get_item(Key={"id": lead_id}).get("Item"):
        return lead_id
    lead_id = new_id()
    _table("leads").put_item(Item={"id": lead_id, "created_at": now(), "source": source, **values})
    return lead_id


def save_survey(lead_id: str, items: int, volume_ft3: float) -> bool:
    return _set("leads", {"id": lead_id}, {"survey_items": items,
                                           "survey_volume_ft3": Decimal(str(round(volume_ft3, 1))),
                                           "survey_updated_at": now()})


def list_leads(limit: int = 200) -> list[dict]:
    items, kwargs = [], {}
    while True:
        page = _table("leads").scan(**kwargs)
        items += page["Items"]
        if "LastEvaluatedKey" not in page:
            break
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    items.sort(key=lambda i: i["created_at"], reverse=True)
    return [_lead(i) for i in items[:limit]]


def get_lead(lead_id: str) -> dict | None:
    item = _table("leads").get_item(Key={"id": lead_id}).get("Item")
    if not item:
        return None
    lead = _lead(item)
    lead["messages"] = get_messages(lead["conversation_id"]) if lead["conversation_id"] else []
    return lead


def new_conversation(state: dict) -> str:
    cid, at = new_id(), now()
    _table("conversations").put_item(Item={"id": cid, "created_at": at, "updated_at": at,
                                           "state": json.dumps(state)})
    return cid


def get_conversation(cid: str) -> dict | None:
    item = _table("conversations").get_item(Key={"id": cid}).get("Item")
    if not item:
        return None
    return {"id": item["id"], "created_at": item["created_at"], "updated_at": item["updated_at"],
            "state": json.loads(item["state"]), "lead_id": item.get("lead_id")}


def save_conversation(cid: str, state: dict, lead_id: str | None = None) -> None:
    values = {"state": json.dumps(state), "updated_at": now()}
    if lead_id:
        values["lead_id"] = lead_id
    _set("conversations", {"id": cid}, values)


def add_message(cid: str, role: str, text: str) -> None:
    _table("messages").put_item(Item={"conversation_id": cid, "at": now(), "role": role, "text": text})


def get_messages(cid: str) -> list[dict]:
    items, kwargs = [], {"KeyConditionExpression": Key("conversation_id").eq(cid)}
    while True:
        page = _table("messages").query(**kwargs)
        items += page["Items"]
        if "LastEvaluatedKey" not in page:
            break
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    return [{"role": i["role"], "text": i["text"], "created_at": i["at"]} for i in items]
