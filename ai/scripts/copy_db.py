"""Copy all leads and chats from one database to another, e.g. from this
laptop's SQLite file to the real server's Postgres:

    python scripts/copy_db.py sqlite:///data/survey.db postgresql+psycopg://user:pass@host:5432/db

Rows that already exist in the target (same id) are skipped, so it is safe to
run more than once.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, select  # noqa: E402

from survey.db import conversations, leads, messages, metadata  # noqa: E402


def main() -> None:
    src, dst = create_engine(sys.argv[1]), create_engine(sys.argv[2])
    metadata.create_all(dst)
    with src.connect() as s, dst.begin() as d:
        for table in (leads, conversations):
            existing = {r[0] for r in d.execute(select(table.c.id))}
            rows = [dict(r) for r in s.execute(select(table)).mappings() if r["id"] not in existing]
            if rows:
                d.execute(table.insert(), rows)
            print(f"{table.name}: copied {len(rows)}")
        # Messages have no stable id across databases; copy those of new conversations only.
        have = {r[0] for r in d.execute(select(messages.c.conversation_id).distinct())}
        rows = [{k: v for k, v in dict(r).items() if k != "id"}
                for r in s.execute(select(messages).order_by(messages.c.id)).mappings()
                if r["conversation_id"] not in have]
        if rows:
            d.execute(messages.insert(), rows)
        print(f"messages: copied {len(rows)}")


if __name__ == "__main__":
    main()
