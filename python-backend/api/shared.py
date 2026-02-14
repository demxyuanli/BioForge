"""
Shared constants and path/version helpers for API routes.
"""
import os
import random
import hashlib
import tempfile

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
DOCUMENTS_DIR = os.getenv("BIOFORGER_DOCUMENTS_DIR") or os.path.join(BACKEND_DIR, "documents")
STORAGE_SUBDIR_COUNT = 256
PREVIEW_CACHE_DIR = os.getenv("BIOFORGER_PREVIEW_CACHE_DIR") or os.path.join(
    tempfile.gettempdir(), "bioforger_preview_cache"
)
TRAINING_SET_PATH = os.path.join(BACKEND_DIR, "training_set.json")
AUDIT_LOG_PATH = os.path.join(BACKEND_DIR, "audit.log")
DESENSITIZATION_LOG_PATH = os.path.join(BACKEND_DIR, "desensitization.log")

DOC_EXTENSIONS = frozenset([
    "pdf", "doc", "docx", "md", "txt", "jpg", "jpeg", "png",
    "ppt", "pptx", "wps", "rtf"
])
TEMP_FILENAME_PREFIXES = ("~", "$", ".~", "~$")

if not os.path.exists(DOCUMENTS_DIR):
    os.makedirs(DOCUMENTS_DIR, exist_ok=True)
if not os.path.exists(PREVIEW_CACHE_DIR):
    os.makedirs(PREVIEW_CACHE_DIR, exist_ok=True)


def get_random_storage_dir() -> str:
    subdir = format(random.randint(0, STORAGE_SUBDIR_COUNT - 1), "02x")
    path = os.path.join(DOCUMENTS_DIR, subdir)
    os.makedirs(path, exist_ok=True)
    return path


def file_version(full_path: str) -> str:
    try:
        st = os.stat(full_path)
        return hashlib.sha256(f"{st.st_mtime_ns}_{st.st_size}".encode()).hexdigest()[:24]
    except OSError:
        return "0"


def preview_cache_path(cache_key: str, version: str) -> str:
    return os.path.join(PREVIEW_CACHE_DIR, f"{cache_key}_{version}.pdf")


def normalize_path(p: str) -> str:
    return (p or "").replace("\\", "/").rstrip("/").lower()


def dirname_from_path(p: str) -> str:
    p = (p or "").replace("\\", "/").rstrip("/")
    if not p:
        return ""
    return p.split("/")[-1] or ""


def is_temp_or_hidden_file(basename: str) -> bool:
    if not basename or not basename.strip():
        return True
    n = basename.strip()
    if n.startswith("."):
        return True
    for prefix in TEMP_FILENAME_PREFIXES:
        if n.startswith(prefix):
            return True
    return False
