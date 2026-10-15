"""The item catalog (catalog.json): what the AI looks for and how big each
item normally is. Kept free of heavy imports so the web API can use it."""

import json
from pathlib import Path

CATALOG_PATH = Path(__file__).with_name("catalog.json")


def load_catalog() -> list[dict]:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))["items"]
