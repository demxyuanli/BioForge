"""
Reset all BioForger data for a fresh start.
Run from python-backend directory: python reset_data.py
Stop tauri dev / Python backend before running.
"""
import json
import os
import platform
import shutil
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))


def _get_system_config_path():
    """Get config path from env or system config dir (same as Tauri app_config_dir)."""
    path = os.environ.get("BIOFORGER_CONFIG_PATH")
    if path and os.path.exists(path):
        return path
    if path:
        return path
    sys_name = platform.system()
    if sys_name == "Windows":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
        return os.path.join(base, "com.privatetune.pro", "bioforger-config.json")
    if sys_name == "Darwin":
        base = os.path.expanduser("~/Library/Application Support")
        return os.path.join(base, "com.privatetune.pro", "bioforger-config.json")
    base = os.environ.get("XDG_CONFIG_HOME", os.path.expanduser("~/.config"))
    return os.path.join(base, "com.privatetune.pro", "bioforger-config.json")


def get_paths():
    db_path = os.path.join(BACKEND_DIR, "privatetune.db")
    documents_dir = os.path.join(BACKEND_DIR, "documents")
    config_path = _get_system_config_path()
    if os.path.exists(config_path):
        try:
            with open(config_path, encoding="utf-8") as f:
                cfg = json.load(f)
                if cfg.get("dbPath"):
                    db_path = cfg["dbPath"]
                if cfg.get("documentsDir"):
                    documents_dir = cfg["documentsDir"]
        except Exception:
            pass
    return db_path, documents_dir


def safe_remove(path, is_dir=False):
    if not os.path.exists(path):
        return
    try:
        if is_dir:
            shutil.rmtree(path)
        else:
            os.remove(path)
        print(f"Removed: {path}")
    except Exception as e:
        print(f"Warning: Could not remove {path}: {e}")


def main():
    reset_config = "--reset-config" in sys.argv
    db_path, documents_dir = get_paths()

    print("Resetting BioForger data...")

    safe_remove(db_path)
    if os.path.isdir(documents_dir):
        safe_remove(documents_dir, is_dir=True)
        os.makedirs(documents_dir, exist_ok=True)
    elif os.path.exists(documents_dir):
        safe_remove(documents_dir)

    chroma_path = os.path.join(BACKEND_DIR, "chroma_db")
    safe_remove(chroma_path, is_dir=True)

    training_set = os.path.join(BACKEND_DIR, "training_set.json")
    safe_remove(training_set)

    for log_name in ("audit.log", "desensitization.log"):
        safe_remove(os.path.join(BACKEND_DIR, log_name))

    if reset_config:
        safe_remove(_get_system_config_path())
        print("Storage config cleared. Storage wizard will show on next launch.")

    print("Reset complete. Restart the application.")


if __name__ == "__main__":
    main()
