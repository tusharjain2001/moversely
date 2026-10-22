"""Leads and chat history.

Where the data lives is one setting, DATABASE_URL:
- this laptop (default): a SQLite file, ai/data/survey.db
- a real server:         postgresql+psycopg://user:password@host:5432/dbname
- AWS:                   dynamodb (see db_dynamo.py)
SQL tables are created on start-up, so a new, empty database needs no setup.
`scripts/copy_db.py` moves existing data from one database to another.
"""

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (JSON, Column, DateTime, Float, ForeignKey, Integer, MetaData, String, Table, Text,
                        create_engine, insert, select, update)
from sqlalchemy.engine import Engine

DEFAULT_SQLITE = Path(__file__).resolve().parents[1] / "data" / "survey.db"
DATABASE_URL = os.environ.get("DATABASE_URL") or f"sqlite:///{DEFAULT_SQLITE.as_posix()}"

metadata = MetaData()

leads = Table(
    "leads", metadata,
    Column("id", String(16), primary_key=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("source", String(16), nullable=False),  # "form" or "chat"
    Column("name", String(120)),
    Column("email", String(200)),
    Column("phone", String(40)),
    Column("from_country", String(40)),
    Column("to_country", String(40)),
    Column("move_date", String(10)),  # yyyy-mm-dd
    Column("move_type", String(16)),
    Column("extras", JSON),  # chat-only answers, e.g. {"vehicle": "yes", "pets": "no"}
    Column("conversation_id", String(16)),
    Column("survey_items", Integer),
    Column("survey_volume_ft3", Float),
    Column("survey_updated_at", DateTime(timezone=True)),
)

conversations = Table(
    "conversations", metadata,
    Column("id", String(16), primary_key=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("state", JSON, nullable=False),  # answers so far and the question being asked
    Column("lead_id", String(16)),
)

messages = Table(
    "messages", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("conversation_id", String(16), ForeignKey("conversations.id"), nullable=False, index=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("role", String(16), nullable=False),  # "user" or "assistant"
    Column("text", Text, nullable=False),
)

_engine: Engine | None = None


def engine() -> Engine:
    global _engine
    if _engine is None:
        if DATABASE_URL.startswith("sqlite:///"):
            Path(DATABASE_URL.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        metadata.create_all(_engine)
    return _engine


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex[:12]


LEAD_FIELDS = ("name", "email", "phone", "from_country", "to_country", "move_date", "move_type", "extras",
               "conversation_id")


def save_lead(source: str, fields: dict, lead_id: str | None = None) -> str:
    """Create a lead, or update it when the same visitor submits again."""
    values = {k: fields.get(k) for k in LEAD_FIELDS if k in fields}
    with engine().begin() as c:
        if lead_id and c.execute(select(leads.c.id).where(leads.c.id == lead_id)).first():
            c.execute(update(leads).where(leads.c.id == lead_id).values(**values))
            return lead_id
        lead_id = new_id()
        c.execute(insert(leads).values(id=lead_id, created_at=now(), source=source, **values))
        return lead_id


def save_survey(lead_id: str, items: int, volume_ft3: float) -> bool:
    with engine().begin() as c:
        res = c.execute(update(leads).where(leads.c.id == lead_id).values(
            survey_items=items, survey_volume_ft3=round(volume_ft3, 1), survey_updated_at=now()))
        return res.rowcount > 0


def list_leads(limit: int = 200) -> list[dict]:
    with engine().connect() as c:
        rows = c.execute(select(leads).order_by(leads.c.created_at.desc()).limit(limit)).mappings().all()
        return [dict(r) for r in rows]


def get_lead(lead_id: str) -> dict | None:
    with engine().connect() as c:
        row = c.execute(select(leads).where(leads.c.id == lead_id)).mappings().first()
        if not row:
            return None
        lead = dict(row)
        lead["messages"] = get_messages(lead["conversation_id"]) if lead["conversation_id"] else []
        return lead


def new_conversation(state: dict) -> str:
    cid = new_id()
    with engine().begin() as c:
        c.execute(insert(conversations).values(id=cid, created_at=now(), updated_at=now(), state=state))
    return cid


def get_conversation(cid: str) -> dict | None:
    with engine().connect() as c:
        row = c.execute(select(conversations).where(conversations.c.id == cid)).mappings().first()
        return dict(row) if row else None


def save_conversation(cid: str, state: dict, lead_id: str | None = None) -> None:
    values = {"state": state, "updated_at": now()}
    if lead_id:
        values["lead_id"] = lead_id
    with engine().begin() as c:
        c.execute(update(conversations).where(conversations.c.id == cid).values(**values))


def add_message(cid: str, role: str, text: str) -> None:
    with engine().begin() as c:
        c.execute(insert(messages).values(conversation_id=cid, created_at=now(), role=role, text=text))


def get_messages(cid: str) -> list[dict]:
    with engine().connect() as c:
        rows = c.execute(select(messages.c.role, messages.c.text, messages.c.created_at)
                         .where(messages.c.conversation_id == cid).order_by(messages.c.id)).mappings().all()
        return [dict(r) for r in rows]


if DATABASE_URL == "dynamodb":
    from .db_dynamo import (add_message, get_conversation, get_lead, get_messages, list_leads,  # noqa: E402, F811
                            new_conversation, save_conversation, save_lead, save_survey)
