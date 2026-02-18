"""
Quick fix script to add keywords column to knowledge_points table
Run this if you get 'no such column: knowledge_points.keywords' error
"""
import os
import sys
from sqlalchemy import create_engine, text, inspect

BACKEND_DIR = os.path.dirname(__file__)
db_path = os.getenv("BIOFORGER_DB_PATH") or os.path.join(BACKEND_DIR, "aiforger.db")

if not os.path.exists(db_path):
    print(f"Database file not found: {db_path}")
    sys.exit(1)

print(f"Connecting to database: {db_path}")
engine = create_engine(f"sqlite:///{db_path}")

insp = inspect(engine)
if "knowledge_points" not in insp.get_table_names():
    print("Error: knowledge_points table does not exist")
    sys.exit(1)

cols = [c["name"] for c in insp.get_columns("knowledge_points")]
print(f"Current columns: {', '.join(cols)}")

if "keywords" in cols:
    print("keywords column already exists")
else:
    print("Adding keywords column...")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE knowledge_points ADD COLUMN keywords TEXT"))
        conn.commit()
    print("keywords column added successfully")

if "tags" not in cols:
    print("Adding tags column...")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE knowledge_points ADD COLUMN tags TEXT"))
        conn.commit()
    print("tags column added successfully")
else:
    print("tags column already exists")

print("Done!")
