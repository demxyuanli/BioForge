"""
Initialize database
Run this script to create the database schema
"""
import os
from models import init_database

if __name__ == "__main__":
    db_path = os.path.join(os.path.dirname(__file__), "..", "aiforger.db")
    engine = init_database(db_path)
    print(f"Database initialized at: {db_path}")
