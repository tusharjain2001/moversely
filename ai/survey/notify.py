"""Emails the team about new leads.

Sent in the background so the visitor never waits for the mail server, and
skipped quietly when SMTP isn't set up. Settings (ai/.env locally):
    SMTP_USER       the account that sends, e.g. leads@company.com
    SMTP_PASSWORD   its app password (Gmail: Google Account -> Security -> App passwords)
    LEAD_EMAIL_TO   where leads go; defaults to SMTP_USER. Several: a,b
    SMTP_HOST       default smtp.gmail.com (Outlook: smtp.office365.com, Zoho: smtp.zoho.com)
    SMTP_PORT       default 587 (STARTTLS); 465 uses SSL
"""

import logging
import os
import smtplib
import threading
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr

from . import countries as C

log = logging.getLogger("survey.notify")

MOVE_TYPES = {"full": "Full household", "partial": "Partial household", "boxes": "A few boxes"}
SOURCES = {"form": "website form", "chat": "Talk to AI chat"}


def _settings() -> dict | None:
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").replace(" ", "")  # Gmail shows app passwords in groups of 4
    if not user or not password:
        return None
    return {"user": user, "password": password,
            "to": [a.strip() for a in os.environ.get("LEAD_EMAIL_TO", user).split(",") if a.strip()],
            "host": os.environ.get("SMTP_HOST", "smtp.gmail.com"), "port": int(os.environ.get("SMTP_PORT", 587))}


def enabled() -> bool:
    return _settings() is not None


def _country(slug: str | None) -> str:
    return C.name(slug) if slug and slug in C.countries() else (slug or "-")


def _date(value: str | None) -> str | None:
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%d %B %Y").lstrip("0")
    except (TypeError, ValueError):
        return value


def _details(lead: dict) -> str:
    extras = lead.get("extras") or {}
    rows = [
        ("Name", lead.get("name")), ("Email", lead.get("email")), ("Phone", lead.get("phone")),
        ("Moving from", extras.get("from_place") or _country(lead.get("from_country"))),
        ("Moving to", extras.get("to_place") or _country(lead.get("to_country"))),
        ("Moving date", _date(lead.get("move_date"))), ("What's moving", MOVE_TYPES.get(lead.get("move_type"), lead.get("move_type"))),
        ("Car or motorbike", extras.get("vehicle", "").capitalize() or None),
        ("Pets", extras.get("pets", "").capitalize() or None),
    ]
    if lead.get("survey_volume_ft3") is not None:
        ft3 = lead["survey_volume_ft3"]
        rows.append(("Room survey", f"{lead.get('survey_items') or 0} items, {ft3:,.0f} ft³ ({ft3 * 0.0283168:.1f} m³)"))
    rows.append(("Came from", SOURCES.get(lead.get("source"), lead.get("source"))))
    rows.append(("Lead ID", lead.get("id")))
    return "\n".join(f"{label + ':':<18}{value}" for label, value in rows if value)


def _transcript(lead: dict) -> str:
    msgs = lead.get("messages") or []
    if not msgs:
        return ""
    lines = [f"{'Visitor' if m['role'] == 'user' else 'AI'}: {m['text']}" for m in msgs]
    return "\n\nThe chat:\n" + "\n".join(lines)


def _send(subject: str, body: str, reply_to: str | None) -> None:
    s = _settings()
    if not s:
        return
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr(("AI Move Survey", s["user"]))
    msg["To"] = ", ".join(s["to"])
    if reply_to and "@" in reply_to:
        msg["Reply-To"] = reply_to  # "Reply" in the inbox answers the customer
    msg.set_content(body)
    try:
        if s["port"] == 465:
            server = smtplib.SMTP_SSL(s["host"], s["port"], timeout=30)
        else:
            server = smtplib.SMTP(s["host"], s["port"], timeout=30)
            server.starttls()
        with server:
            server.login(s["user"], s["password"])
            server.send_message(msg)
        log.info("Lead email sent: %s", subject)
    except (smtplib.SMTPException, OSError) as e:
        log.warning("Lead email failed (%s): %s", subject, e)


def _send_later(subject: str, body: str, reply_to: str | None) -> None:
    if enabled():
        threading.Thread(target=_send, args=(subject, body, reply_to), daemon=True).start()


def new_lead(lead: dict) -> None:
    extras = lead.get("extras") or {}
    to = extras.get("to_place") or _country(lead.get("to_country"))
    route = f"{extras.get('from_place') or _country(lead.get('from_country'))} → {to}"
    body = (f"A new moving enquiry came in through the {SOURCES.get(lead.get('source'), 'website')}.\n\n"
            f"{_details(lead)}\n\nYou'll get a second email if they finish the room survey."
            f"{_transcript(lead)}\n")
    _send_later(f"New lead: {lead.get('name') or 'Visitor'} ({route})", body, lead.get("email"))


def survey_done(lead: dict) -> None:
    body = (f"{lead.get('name') or 'A visitor'} finished the AI room survey.\n\n{_details(lead)}\n\n"
            "The volume is an AI estimate from phone videos; please confirm it before quoting.\n")
    _send_later(f"Room survey done: {lead.get('name') or 'Visitor'}, {lead.get('survey_volume_ft3') or 0:,.0f} ft³",
                body, lead.get("email"))


def test() -> None:
    """python -m survey.notify  sends a test email using ai/.env."""
    s = _settings()
    if not s:
        print("SMTP_USER and SMTP_PASSWORD are not set in ai/.env")
        return
    print(f"Sending a test email from {s['user']} to {', '.join(s['to'])} via {s['host']}:{s['port']} ...")
    logging.basicConfig(level=logging.INFO)
    _send("Test: lead emails are working",
          "This is a test from the AI Move Survey. New leads will arrive like this.\n\n" + _details({
              "name": "Test Customer", "email": "customer@example.com", "phone": "+1 555 123 4567",
              "from_country": "india", "to_country": "usa", "move_date": "2026-12-01", "move_type": "full",
              "extras": {"vehicle": "no", "pets": "yes"}, "survey_items": 14, "survey_volume_ft3": 420.0,
              "source": "chat", "id": "test"}), None)


if __name__ == "__main__":
    from pathlib import Path

    for line in (Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines():
        key, sep, value = line.partition("=")
        if sep and not key.strip().startswith("#"):
            os.environ.setdefault(key.strip(), value.strip().strip('"'))
    test()
