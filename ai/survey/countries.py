"""Countries the survey covers, with our customs summaries (written in our own
words from the FIDI Customs Guides). The website shows the same files; copy
them over with `npm run sync:customs` in web/ after editing."""

import json
import re
from functools import cache
from pathlib import Path

CUSTOMS_DIR = Path(__file__).with_name("customs")

# Names and big cities people type instead of the country.
ALIASES = {
    "australia": ["australia", "aus", "sydney", "melbourne", "brisbane", "perth", "adelaide", "canberra"],
    "canada": ["canada", "toronto", "vancouver", "montreal", "calgary", "ottawa", "edmonton"],
    "france": ["france", "paris", "lyon", "marseille", "nice", "toulouse"],
    "germany": ["germany", "deutschland", "berlin", "munich", "frankfurt", "hamburg", "cologne", "stuttgart"],
    "india": ["india", "bharat", "delhi", "new delhi", "mumbai", "bombay", "bangalore", "bengaluru", "chennai",
              "hyderabad", "kolkata", "pune", "ahmedabad", "gurgaon", "gurugram", "noida", "jaipur", "chandigarh"],
    "new-zealand": ["new zealand", "nz", "auckland", "wellington", "christchurch"],
    "singapore": ["singapore", "sg"],
    "uae": ["uae", "united arab emirates", "emirates", "dubai", "abu dhabi", "sharjah"],
    "uk": ["uk", "united kingdom", "england", "britain", "great britain", "scotland", "wales", "london",
           "manchester", "birmingham", "edinburgh", "glasgow"],
    "usa": ["usa", "us", "u.s.", "united states", "america", "united states of america", "new york", "california",
            "texas", "florida", "chicago", "los angeles", "san francisco", "seattle", "boston", "houston",
            "new jersey", "dallas", "atlanta", "washington"],
}

GENERAL_DOCUMENTS = [
    "Passport (copy of the photo page)",
    "Visa, work permit or residence permit for your new country",
    "Detailed inventory of everything you are shipping, in English",
    "Bill of lading or air waybill (your mover arranges this)",
    "Signed authorisation letter so your mover can clear customs for you",
]


@cache
def countries() -> dict[str, dict]:
    out = {}
    for f in sorted(CUSTOMS_DIR.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        out[data["slug"]] = data
    return out


def name(slug: str) -> str:
    return countries()[slug]["name"]


def find(text: str) -> str | None:
    """Country slug mentioned in free text, preferring the longest match
    ("new zealand" over "zealand", "united states" over "us")."""
    t = " " + re.sub(r"[^a-z.]+", " ", text.lower()) + " "
    best, best_len = None, 0
    for slug, words in ALIASES.items():
        for w in words:
            if f" {w} " in t and len(w) > best_len:
                best, best_len = slug, len(w)
    return best


def facts(slugs: list[str]) -> str:
    """Customs facts for the countries in this conversation, as plain text for
    the chat model to answer from."""
    lines = ["Documents needed for every international move: " + "; ".join(GENERAL_DOCUMENTS) + "."]
    for slug in slugs:
        c = countries().get(slug)
        if not c:
            continue
        for kind, verb in (("export", "Leaving"), ("import", "Arriving in")):
            s = c.get(kind)
            if not s:
                lines.append(f"{verb} {c['name']}: no customs guide available; the mover will confirm.")
                continue
            parts = [f"documents: {'; '.join(s['documents'])}"]
            if s["dutyFree"]:
                parts.append(f"duty-free when: {'; '.join(s['dutyFree'])}")
            if s["restricted"]:
                parts.append(f"restricted: {'; '.join(s['restricted'])}")
            if s["notes"]:
                parts.append(f"notes: {'; '.join(s['notes'])}")
            lines.append(f"{verb} {c['name']}: " + ". ".join(parts) + ".")
    return "\n".join(lines)
