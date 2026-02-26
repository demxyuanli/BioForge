"""
Background tasks: persist finetuning job progress to DB so it survives restarts and is queryable without recompute.
"""
import logging
import threading
from typing import Optional

logger = logging.getLogger(__name__)
_FINETUNING_SYNC_INTERVAL_SEC = 10.0
_stop_event = threading.Event()


def _run_finetuning_progress_sync() -> None:
    from api.db import get_db_session
    from database.models import FinetuningJob
    from services.monitoring_service import MonitoringService

    try:
        from api.routers.finetuning import _sync_placeholder_finetuning_job_state
    except Exception as e:
        logger.warning("background_jobs: could not import _sync_placeholder_finetuning_job_state: %s", e)
        return

    db = get_db_session()
    try:
        jobs = (
            db.query(FinetuningJob)
            .filter(FinetuningJob.status.in_(["submitted", "running"]))
            .all()
        )
        monitor = MonitoringService()
        changed = False
        for job in jobs:
            if _sync_placeholder_finetuning_job_state(db, job, monitor):
                changed = True
        if changed:
            db.commit()
    except Exception as e:
        logger.exception("background_jobs: finetuning sync failed: %s", e)
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()


def _finetuning_sync_loop() -> None:
    while not _stop_event.is_set():
        _stop_event.wait(timeout=_FINETUNING_SYNC_INTERVAL_SEC)
        if _stop_event.is_set():
            break
        try:
            _run_finetuning_progress_sync()
        except Exception as e:
            logger.warning("background_jobs: sync loop error: %s", e)


_finetuning_thread: Optional[threading.Thread] = None


def start_finetuning_background_sync() -> None:
    global _finetuning_thread
    if _finetuning_thread is not None and _finetuning_thread.is_alive():
        return
    _stop_event.clear()
    _finetuning_thread = threading.Thread(target=_finetuning_sync_loop, daemon=True)
    _finetuning_thread.start()
    logger.info("background_jobs: finetuning progress sync started (interval=%ss)", _FINETUNING_SYNC_INTERVAL_SEC)


def stop_finetuning_background_sync() -> None:
    _stop_event.set()
