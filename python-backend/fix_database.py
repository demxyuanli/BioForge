"""
Script to fix database foreign key constraints
Run this once to update existing database schema

WARNING: This will delete all existing data!
Backup your database before running this script.
"""
import os
from database.models import init_database, Base

db_path = os.path.join(os.path.dirname(__file__), "privatetune.db")

# Initialize database to get engine
engine = init_database(db_path)

# Drop and recreate tables with CASCADE constraints
print("Recreating database tables with CASCADE constraints...")
print("WARNING: This will delete all existing data!")
Base.metadata.drop_all(engine)
Base.metadata.create_all(engine)
print("Database schema updated successfully!")
