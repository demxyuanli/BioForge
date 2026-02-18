"""
Inspect knowledge_points and keywords in the database.
Run from project root: python python-backend/inspect_kp_keywords.py
"""
import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BACKEND_DIR)

_CONFIG_PATH = os.environ.get("BIOFORGER_CONFIG_PATH") or os.path.join(BACKEND_DIR, "bioforger-config.json")
db_path = os.getenv("BIOFORGER_DB_PATH")
if not db_path and os.path.exists(_CONFIG_PATH):
    try:
        with open(_CONFIG_PATH, encoding="utf-8") as f:
            config = json.load(f)
            db_path = config.get("dbPath")
    except Exception:
        pass
if not db_path:
    db_path = os.path.join(BACKEND_DIR, "aiforger.db")

from database.models import init_database, KnowledgePoint
from sqlalchemy.orm import sessionmaker

def main():
    engine = init_database(db_path)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        rows = db.query(KnowledgePoint).order_by(KnowledgePoint.document_id, KnowledgePoint.chunk_index).all()
        print(f"Database: {db_path}")
        print(f"Total knowledge_points: {len(rows)}")
        print("-" * 80)
        for kp in rows:
            raw_kw = getattr(kp, "keywords", None)
            if raw_kw:
                try:
                    kw_list = json.loads(raw_kw)
                    kw_str = ", ".join(kw_list) if isinstance(kw_list, list) else str(raw_kw)
                except Exception:
                    kw_str = f"(invalid JSON) {raw_kw!r}"
            else:
                kw_str = "(none)"
            content_preview = (kp.content or "")[:50].replace("\n", " ")
            if len(kp.content or "") > 50:
                content_preview += "..."
            print(f"id={kp.id} doc_id={kp.document_id} weight={kp.weight} excluded={kp.excluded}")
            print(f"  content: {content_preview}")
            print(f"  keywords column (raw): {raw_kw!r}")
            print(f"  keywords (parsed): [{kw_str}]")
            print()
    finally:
        db.close()

if __name__ == "__main__":
    main()
