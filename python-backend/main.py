"""
PrivateTune Pro Python Backend Service
Main entry point for the Python backend service
"""
import logging
import sys
import uvicorn
from fastapi import FastAPI

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
