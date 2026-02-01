"""
PrivateTune Pro Python Backend Service
Main entry point for the Python backend service
"""
import json
import logging
import os
import sys
import uvicorn
from fastapi import FastAPI

# Load storage config from system config dir or local fallback before importing routes
_CONFIG_PATH = os.environ.get("BIOFORGER_CONFIG_PATH") or os.path.join(
    os.path.dirname(__file__), "bioforger-config.json"
)
if os.path.exists(_CONFIG_PATH):
    try:
        with open(_CONFIG_PATH, encoding="utf-8") as f:
            config = json.load(f)
            if config.get("dbPath"):
                os.environ["BIOFORGER_DB_PATH"] = config["dbPath"]
            if config.get("documentsDir"):
                os.environ["BIOFORGER_DOCUMENTS_DIR"] = config["documentsDir"]
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stderr,
)
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router

app = FastAPI(title="PrivateTune Pro Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import os
    import sys
    port = int(os.getenv("PORT", "8778"))
    try:
        uvicorn.run(app, host="127.0.0.1", port=port)
    except OSError as e:
        winerror = getattr(e, "winerror", None)
        errno_val = getattr(e, "errno", None)
        if winerror == 10048 or errno_val in (98, 48):
            print(f"Port {port} is already in use. Backend may already be running.")
            sys.exit(0)
        raise
