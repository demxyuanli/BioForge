"""
GUI host wrapper for backend service.
This script is intended to be launched with pythonw on Windows.
"""

import asyncio
import os
import sys

import uvicorn

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from main import app  # noqa: E402


def run() -> None:
    port = int(os.getenv("PORT", "8778"))
    try:
        uvicorn.run(app, host="127.0.0.1", port=port, use_colors=False)
    except OSError as e:
        winerror = getattr(e, "winerror", None)
        errno_val = getattr(e, "errno", None)
        if winerror == 10048 or errno_val in (98, 48):
            sys.exit(0)
        raise


if __name__ == "__main__":
    run()
