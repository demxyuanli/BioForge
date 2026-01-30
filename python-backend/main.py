"""
PrivateTune Pro Python Backend Service
Main entry point for the Python backend service
"""
import uvicorn
from fastapi import FastAPI
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
    port = int(os.getenv("PORT", "8778"))
    uvicorn.run(app, host="127.0.0.1", port=port)
