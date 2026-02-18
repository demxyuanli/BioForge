"""
Clean local test data before packaging.
- Backs up python-backend/aiforger.db (and legacy python-backend/privatetune.db) and python-backend/bioforger-config.json
- Removes in-repo database file
- Resets bioforger-config.json to default (backendPort only, no local paths)
Run from repo root: python scripts/clean_test_data.py
"""
import json
import os
import shutil
import sys
from datetime import datetime

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(REPO_ROOT, "python-backend")
BACKUPS_DIR = os.path.join(REPO_ROOT, "backups")
PREFERRED_DB_PATH = os.path.join(BACKEND_DIR, "aiforger.db")
LEGACY_DB_PATH = os.path.join(BACKEND_DIR, "privatetune.db")
CONFIG_PATH = os.path.join(BACKEND_DIR, "bioforger-config.json")
DEFAULT_CONFIG = {"backendPort": 8778}


def main():
    os.chdir(REPO_ROOT)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(BACKUPS_DIR, f"clean_before_build_{timestamp}")
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    os.makedirs(backup_dir, exist_ok=True)

    # Backup and remove in-repo DB files (preferred + legacy)
    if os.path.isfile(PREFERRED_DB_PATH):
        backup_db = os.path.join(backup_dir, "aiforger.db")
        shutil.copy2(PREFERRED_DB_PATH, backup_db)
        os.remove(PREFERRED_DB_PATH)
        print(f"Backed up and removed: {PREFERRED_DB_PATH}")
    else:
        print(f"No DB at {PREFERRED_DB_PATH} (skip)")

    if os.path.isfile(LEGACY_DB_PATH):
        backup_db = os.path.join(backup_dir, "privatetune.db")
        shutil.copy2(LEGACY_DB_PATH, backup_db)
        os.remove(LEGACY_DB_PATH)
        print(f"Backed up and removed: {LEGACY_DB_PATH}")
    else:
        print(f"No DB at {LEGACY_DB_PATH} (skip)")

    # Backup and reset config (remove dbPath/documentsDir so no local paths leak)
    if os.path.isfile(CONFIG_PATH):
        backup_cfg = os.path.join(backup_dir, "bioforger-config.json")
        shutil.copy2(CONFIG_PATH, backup_cfg)
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2)
        print(f"Backed up and reset config: {CONFIG_PATH} -> {DEFAULT_CONFIG}")
    else:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2)
        print(f"Created default config: {CONFIG_PATH}")

    print(f"Backup dir: {backup_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
