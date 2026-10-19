"""The "Talk to AI" assistant: collects the move details in a chat, answers
moving questions, then hands the visitor to the room survey.

Our code runs the conversation (which question is next, checking each answer)
and the chat model is only asked when the visitor writes a question or
something we can't read. That keeps a small free model fast and on track, and
its answers come from our customs summaries rather than its memory.

The model is reached over the OpenAI-style chat API, so the same code works
with Ollama on this laptop, a model host in the cloud, or a paid service:
    CHAT_AI_URL    default http://localhost:11434/v1 (Ollama)
    CHAT_AI_MODEL  default survey-chat (Qwen3 1.7B, see chat-model/Modelfile)
    CHAT_AI_KEY    API key, if the service needs one
    CHAT_AI_EXTRA  extra request fields as JSON; the default turns off Qwen3's
                   slow "thinking" mode. Set to {} for services that reject it.
"""

import json
import os
import re
from datetime import date, datetime

import httpx

from . import countries as C
from . import db, notify

CHAT_AI_URL = os.environ.get("CHAT_AI_URL", "http://localhost:11434/v1").rstrip("/")
CHAT_AI_MODEL = os.environ.get("CHAT_AI_MODEL", "survey-chat")
CHAT_AI_KEY = os.environ.get("CHAT_AI_KEY", "")
CHAT_AI_EXTRA = json.loads(os.environ.get("CHAT_AI_EXTRA", '{"reasoning_effort": "none"}'))

MOVE_TYPES = {"full": "Full household", "partial": "Partial household", "boxes": "A few boxes"}
STEPS = ["from", "to", "move_type", "vehicle", "pets", "date", "name", "email", "phone"]
EDITABLE = {"from": "Moving from", "to": "Moving to", "move_type": "What you're moving", "date": "Moving date",
            "name": "Name", "email": "Email", "phone": "Phone"}

GREETING = ("Hi! I'm your AI moving assistant. I'll ask a few quick questions, then you can scan your rooms "
            "with your phone to estimate your shipment. You can ask me anything about moving or customs "
            "documents along the way.")

QUESTION_START = re.compile(r"^(what|how|when|where|why|which|who|do|does|did|can|could|is|are|will|would|should|"
                            r"shall|may|tell me|explain|help)\b", re.I)


# ---------------------------------------------------------------- questions

def _question(step: str, a: dict) -> tuple[str, dict]:
    """The assistant's question for a step, and the input widget to show."""
    supported = [{"label": c["name"], "value": slug} for slug, c in C.countries().items()]
    yes_no = [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}]
    if step == "from":
        return "Where are you moving from?", {"type": "chips", "options": supported}
    if step == "to":
        opts = [o for o in supported if o["value"] != a.get("from")]
        return f"And where are you moving to from {C.name(a['from'])}?", {"type": "chips", "options": opts}
    if step == "move_type":
        return "What are you moving?", {"type": "chips",
                                        "options": [{"label": v, "value": k} for k, v in MOVE_TYPES.items()]}
    if step == "vehicle":
        return "Will you also ship a car or motorbike?", {"type": "chips", "options": yes_no}
    if step == "pets":
        return "Are any pets moving with you?", {"type": "chips", "options": yes_no}
    if step == "date":
        return "When would you like to move?", {"type": "date", "min": date.today().isoformat()}
    if step == "name":
        return "Great. What's your full name?", {"type": "text", "input": "text", "placeholder": "Full name"}
    if step == "email":
        first = (a.get("name") or "").split(" ")[0]
        return (f"Thanks{', ' + first if first else ''}! What's your email address?",
                {"type": "text", "input": "email", "placeholder": "you@example.com"})
    if step == "phone":
        return "And your phone number, so our team can reach you?", {"type": "text", "input": "tel",
                                                                      "placeholder": "+1 555 123 4567"}
    if step == "edit":
        return "What would you like to change?", {"type": "chips", "options": [
            {"label": label, "value": f"edit:{k}"} for k, label in EDITABLE.items()]}
    # confirm
    return _summary_text(a), {"type": "summary", "move": _move(a)}


def _summary_text(a: dict) -> str:
    when = datetime.strptime(a["date"], "%Y-%m-%d").strftime("%d %B %Y").lstrip("0")
    return (f"Here's your move: {C.name(a['from'])} to {C.name(a['to'])}, "
            f"{MOVE_TYPES[a['move_type']].lower()}, around {when}. "
            "Next, scan each room with your phone and I'll estimate your shipment volume.")


def _move(a: dict) -> dict:
    """The move details in the shape the website's form uses."""
    return {"name": a.get("name", ""), "email": a.get("email", ""), "phone": a.get("phone", ""),
            "from": a.get("from", ""), "to": a.get("to", ""), "date": a.get("date", ""),
            "moveType": a.get("move_type", "full")}


# ---------------------------------------------------------------- answers

def _yes_no(text: str, yes_words: tuple[str, ...] = ()) -> str | None:
    t = text.lower().strip(" .!")
    if re.search(r"\b(no|nope|nah|none|not|don't|dont|without)\b", t):
        return "no"
    if re.search(r"\b(yes|yeah|yep|yup|sure|ok|okay|of course|definitely|we do|i do)\b", t) or \
            any(w in t for w in yes_words):
        return "yes"
    return None


MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov",
                                      "dec"], 1)}


def _date(text: str) -> str | None:
    t = text.lower().strip()
    if m := re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", t):
        y, mo, d = map(int, m.groups())
    elif m := re.search(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b", t):
        d, mo, y = map(int, m.groups())
        if mo > 12 and d <= 12:  # written month-first
            d, mo = mo, d
        y += 2000 if y < 100 else 0
    elif m := re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})\b", t):
        d, mon, y = int(m[1]), m[2], int(m[3])
        mo = MONTHS.get(mon, 0)
    elif m := re.search(r"\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b", t):
        mon, d, y = m[1], int(m[2]), int(m[3])
        mo = MONTHS.get(mon, 0)
    else:
        return None
    try:
        when = date(y, mo, d)
    except ValueError:
        return None
    return when.isoformat() if when >= date.today() else None


def _name(text: str) -> str | None:
    t = re.sub(r"^(hi|hello|hey)[,!.\s]+", "", text.strip(), flags=re.I)
    t = re.sub(r"^(my name is|my name's|i am|i'm|im|this is|it's|its|name is|call me)\s+", "", t, flags=re.I)
    t = t.strip(" .!,")
    if 2 <= len(t) <= 60 and re.fullmatch(r"[^\W\d_][^\W\d_ .'\-]*(?:[ .'\-]+[^\W\d_][^\W\d_.'\-]*){0,4}", t):
        return " ".join(w[:1].upper() + w[1:] for w in t.split())
    return None


def _email(text: str) -> str | None:
    m = re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", text)
    return m[0].lower() if m else None


def _phone(text: str) -> str | None:
    if not re.search(r"\d", text):
        return None
    digits = re.sub(r"\D", "", text)
    if 7 <= len(digits) <= 15:
        return re.sub(r"[^\d+ ()-]", "", text).strip()
    return None


def _parse(step: str, text: str, a: dict) -> tuple[str | None, str | None]:
    """(value, problem). value None + problem None means "couldn't read it"."""
    if step in ("from", "to"):
        slug = C.find(text)
        if slug and step == "to" and slug == a.get("from"):
            return None, f"That's where you're moving from. Which country are you moving to?"
        return slug, None
    if step == "move_type":
        t = text.lower()
        if re.search(r"\b(box|boxes|suitcase|suitcases|bags?)\b", t):
            return "boxes", None
        if re.search(r"\b(partial|part|some|few items|a few things|only)\b", t):
            return "partial", None
        if re.search(r"\b(full|whole|entire|everything|all|house|home|apartment|flat|bhk|bedroom)\b", t):
            return "full", None
        return None, None
    if step == "vehicle":
        return _yes_no(text, ("car", "bike", "motorbike", "motorcycle", "scooter", "suv")), None
    if step == "pets":
        return _yes_no(text, ("dog", "cat", "puppy", "kitten", "bird", "pet")), None
    if step == "date":
        if re.search(r"\d", text) and not _date(text):
            return None, "That date doesn't look right, or it's in the past. Please pick it from the calendar."
        return _date(text), None
    if step == "name":
        return _name(text), None
    if step == "email":
        v = _email(text)
        return v, (None if v or "@" not in text else "That email doesn't look complete. Could you check it?")
    if step == "phone":
        v = _phone(text)
        return v, (None if v or not re.search(r"\d", text) else
                   "That number looks too short or too long. Could you check it?")
    return None, None


def _is_question(text: str) -> bool:
    t = text.strip()
    return t.endswith("?") or bool(QUESTION_START.match(t)) or len(t.split()) > 8


# ---------------------------------------------------------------- fixed answers

# The questions people ask most get a fixed answer from our own data: always
# correct, instant, and a small model can't wander off into made-up prices or
# shipping times.
COST = re.compile(r"\b(cost|costs|price|prices|pricing|quote|quotation|how much|charge|charges|fee|fees|expensive|"
                  r"cheap|budget|rate|rates)\b", re.I)
TIME = re.compile(r"\b(how long|how many (days|weeks|months)|transit|delivery time|when will .* (arrive|reach)|"
                  r"take to (ship|arrive|reach|deliver))\b", re.I)
DOCS = re.compile(r"\b(document|documents|docs|paperwork|papers|customs|forms?|visa|passport|permit)\b", re.I)
SCAN = re.compile(r"\b(scan|scanning|video|record|recording|survey|camera|app)\b", re.I)
SERVICES = re.compile(r"\b(pack|packing|packers|unpack|storage|store|warehouse|insurance|insure|insured|pick ?up|"
                      r"door to door|assemble|dismantle|crating)\b", re.I)
PETS = re.compile(r"\b(pet|pets|dog|dogs|cat|cats|puppy|kitten|bird|birds|rabbit|animal|animals)\b", re.I)
# "Is it safe to ship my TV?" is not a privacy question, so only data words count.
PRIVACY = re.compile(r"\b(data|privacy|private|gdpr|share my|personal (data|information|details)|"
                     r"my (details|information|videos?))\b", re.I)
OFF_TOPIC = "OFF_TOPIC"


def _documents_answer(text: str, a: dict) -> str:
    asked = C.find(text)
    parts = []

    def block(verb: str, slug: str, docs: list[str] | None) -> str:
        if not docs:
            return f"{verb} {C.name(slug)}: there's no customs guide yet, so our team will confirm."
        return f"{verb} {C.name(slug)}:\n" + "\n".join(f"• {d}" for d in docs)

    for slug, kind, verb in ((a.get("from"), "export", "To leave"), (a.get("to"), "import", "To move into")):
        if slug:
            s = C.countries()[slug].get(kind)
            parts.append(block(verb, slug, s["documents"] if s else None))
    if asked and asked not in (a.get("from"), a.get("to")):
        s = C.countries()[asked].get("import")
        parts.append(block("To move into", asked, s["documents"] if s else None))
    if not parts:
        return ("Every international move needs your passport, a visa or residence permit for your new country, and "
                "a detailed inventory. Once I know your route, I'll show the exact customs documents for it.")
    return "\n\n".join(parts) + "\n\nYou'll get the full checklist, with duty-free rules, at the end."


def _fixed_answer(text: str, a: dict) -> str | None:
    if COST.search(text):
        return ("Our team gives you an exact quote after your room scan. The scan measures your furniture, and the "
                "shipment volume is what the price is based on.")
    if TIME.search(text):
        return ("It depends on your route and whether you ship by sea or air. Our team will confirm the timeline "
                "together with your quote.")
    if DOCS.search(text):
        return _documents_answer(text, a)
    if PETS.search(text):
        rules = [r for slug in (a.get("to"),) if slug and (s := C.countries()[slug].get("import"))
                 for r in s["restricted"] if PETS.search(r)]
        rule = f" For {C.name(a['to'])}: {rules[0].rstrip('.')}." if rules else ""
        return ("Pets travel separately from your household goods and need their own paperwork, usually a "
                f"microchip, vaccinations and a health certificate.{rule} Our team will guide you through it.")
    if SERVICES.search(text):
        return ("Our moving team will go through the services with you, such as packing, storage and insurance, "
                "when they prepare your quote.")
    if PRIVACY.search(text):
        return ("Your details and room videos are used only to plan your move and prepare your quote. Our team can "
                "answer any privacy questions when they contact you.")
    if SCAN.search(text):
        return ("After these questions, you record a short video of each room with your phone, no app needed. "
                "AI finds your furniture, measures it in 3D and adds up your shipment volume. You can edit any item.")
    return None


# ---------------------------------------------------------------- the model

def _system_prompt(a: dict) -> str:
    slugs = [s for s in (a.get("from"), a.get("to")) if s]
    covered = ", ".join(c["name"] for c in C.countries().values())
    return (
        "You are the AI moving assistant on an international moving company's website. "
        "Answer the visitor's latest message in at most 3 short sentences of plain English. "
        "Do not ask the visitor questions; the website asks the next question itself.\n"
        "Rules:\n"
        f"- If the message is not about moving house, shipping belongings, customs or this website, reply with "
        f"exactly {OFF_TOPIC} and nothing else.\n"
        "- You do not know which services the company offers, its prices or its policies. Never claim the company "
        "does something; say the moving team will confirm.\n"
        "- For customs documents and rules, use ONLY the facts below. If they don't cover it, say the moving team "
        "will confirm it.\n"
        "- NEVER state any price, cost, number of days or weeks, or delivery time. Say the team confirms these "
        "with the quote.\n"
        "- Never give legal or immigration advice beyond the facts below.\n"
        "- If you are not sure, say the moving team will confirm. Do not guess.\n"
        f"- Customs checklists currently cover: {covered}. Other countries are coming soon.\n\n"
        "About this website: the visitor answers a few questions, then records a short video of each room with "
        "their phone (no app needed). AI finds the furniture, measures it in 3D and estimates the shipment volume "
        "in cubic feet, then shows the customs documents for their route. Sizes are estimates, usually within about "
        "20 to 25 percent for a whole room, and the visitor can edit any item.\n\n"
        f"Facts:\n{C.facts(slugs)}"
    )


def _ask_model(a: dict, history: list[dict]) -> str | None:
    msgs = [{"role": "system", "content": _system_prompt(a)}]
    msgs += [{"role": m["role"], "content": m["text"]} for m in history[-8:]]
    headers = {"Authorization": f"Bearer {CHAT_AI_KEY}"} if CHAT_AI_KEY else {}
    try:
        r = httpx.post(f"{CHAT_AI_URL}/chat/completions", headers=headers, timeout=90,
                       json={"model": CHAT_AI_MODEL, "messages": msgs, "max_tokens": 220, **CHAT_AI_EXTRA})
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"] or ""
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        return None
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    if OFF_TOPIC in text:
        return "I can only help with your move. Ask me anything about moving, shipping or customs documents."
    # Last line of defence: a small model sometimes invents prices or shipping
    # times. ("Owned for 12 months" is a real customs rule, so only durations
    # next to shipping words count.)
    invented_price = re.search(r"[$€£₹]\s?\d|\b\d+\s*(usd|dollars|rupees|euros)\b", text, re.I)
    invented_time = (re.search(r"\b(take|takes|taking|arrive|arrives|arrival|delivery|deliver|transit|shipping time)\b",
                               text, re.I)
                     and re.search(r"\b\d+\s*(-|to)?\s*\d*\s*(days?|weeks?)\b", text, re.I))
    if invented_price or invented_time:
        return "Our moving team will confirm prices and timings together with your quote."
    return text or None


def warm() -> None:
    """Load the chat model now, so the first visitor's question isn't slow."""
    try:
        httpx.post(f"{CHAT_AI_URL}/chat/completions", timeout=300,
                   headers={"Authorization": f"Bearer {CHAT_AI_KEY}"} if CHAT_AI_KEY else {},
                   json={"model": CHAT_AI_MODEL, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1,
                         **CHAT_AI_EXTRA})
    except httpx.HTTPError:
        pass


# ---------------------------------------------------------------- the turn

def _next_step(a: dict) -> str:
    return next((s for s in STEPS if s not in a), "confirm")


def _label(step: str, value: str, a: dict) -> str:
    """What the visitor 'said' when they tapped a button."""
    if step in ("from", "to") and value in C.countries():
        return C.name(value)
    if step == "move_type":
        return MOVE_TYPES.get(value, value)
    if step in ("vehicle", "pets"):
        return value.capitalize()
    if step == "date":
        try:
            return datetime.strptime(value, "%Y-%m-%d").strftime("%d %B %Y").lstrip("0")
        except ValueError:
            return value
    if value.startswith("edit:"):
        return f"Change {EDITABLE.get(value[5:], value[5:]).lower()}"
    if value == "edit":
        return "Change something"
    return value


def _save_lead(cid: str, state: dict) -> None:
    a = state["answers"]
    state["lead_id"] = db.save_lead("chat", {
        "name": a.get("name"), "email": a.get("email"), "phone": a.get("phone"),
        "from_country": a.get("from"), "to_country": a.get("to"), "move_date": a.get("date"),
        "move_type": a.get("move_type"),
        "extras": {k: a[k] for k in ("vehicle", "pets") if k in a}, "conversation_id": cid,
    }, state.get("lead_id"))


def _reply(cid: str, state: dict, texts: list[str]) -> dict:
    for t in texts:
        db.add_message(cid, "assistant", t)
    question, widget = _question(state["step"], state["answers"])
    if not texts or texts[-1] != question:
        db.add_message(cid, "assistant", question)
        texts = [*texts, question]
    db.save_conversation(cid, state, state.get("lead_id"))
    return {"conversation_id": cid, "messages": [{"role": "assistant", "text": t} for t in texts],
            "widget": widget, "lead_id": state.get("lead_id")}


def start() -> dict:
    state = {"step": "from", "answers": {}, "editing": False, "lead_id": None}
    cid = db.new_conversation(state)
    return _reply(cid, state, [GREETING])


def resume(cid: str) -> dict | None:
    conv = db.get_conversation(cid)
    if not conv:
        return None
    state = conv["state"]
    _, widget = _question(state["step"], state["answers"])
    return {"conversation_id": cid, "messages": [{"role": m["role"], "text": m["text"]} for m in db.get_messages(cid)],
            "widget": widget, "lead_id": state.get("lead_id")}


def turn(cid: str, text: str = "", value: str = "") -> dict | None:
    conv = db.get_conversation(cid)
    if not conv:
        return None
    state, step = conv["state"], conv["state"]["step"]
    a = state["answers"]
    text, value = text.strip()[:500], value.strip()[:100]
    if not text and not value:
        return _reply(cid, state, [])
    db.add_message(cid, "user", text or _label(step, value, a))

    # Changing an answer from the summary.
    if value == "edit":
        state["step"] = "edit"
        return _reply(cid, state, [])
    if value.startswith("edit:") and value[5:] in EDITABLE:
        state.update(step=value[5:], editing=True)
        if value[5:] == "from":
            a.pop("to", None)  # the destination list depends on the origin
        return _reply(cid, state, [])

    # A real question ("what documents do I need to leave India?") is answered,
    # even if it happens to mention a country or a yes/no word.
    asking = bool(text) and _is_question(text) and len(text.split()) > 3
    answer, problem = None, None
    if step in ("from", "to") and value in C.countries() and not (step == "to" and value == a.get("from")):
        answer = value  # a country button
    elif step in STEPS and not asking:
        answer, problem = _parse(step, value or text, a)

    if answer is not None:
        a[step] = answer
        state["step"] = "confirm" if state["editing"] and _next_step(a) == "confirm" else _next_step(a)
        if state["step"] == "confirm":
            state["editing"] = False
        _save_lead(cid, state)
        if state["step"] == "confirm" and not state.get("emailed"):  # all details in: tell the team once
            state["emailed"] = True
            notify.new_lead(db.get_lead(state["lead_id"]))
        return _reply(cid, state, [])

    if problem:
        return _reply(cid, state, [problem])

    # A question or something we couldn't read: a fixed answer if we have one,
    # otherwise the model.
    if text and (asking or _is_question(text) or step not in STEPS):
        reply = _fixed_answer(text, a) or _ask_model(a, db.get_messages(cid))
        if not reply:
            reply = "Sorry, I can't answer that right now. Our moving team will help with it after you finish here."
        return _reply(cid, state, [reply])

    hint = {"from": "I can help with moves from these countries for now.",
            "to": "I can help with moves to these countries for now.",
            "date": "Please pick a date from the calendar.",
            "name": "Just your first and last name is perfect."}.get(step, "Sorry, I didn't catch that.")
    return _reply(cid, state, [hint])
