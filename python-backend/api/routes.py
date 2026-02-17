"""
API Routes for Python Backend
FastAPI routes for document processing, annotation, and fine-tuning
"""
from fastapi import APIRouter

from api.routers import logs as logs_router
from api.routers import api_keys as api_keys_router
from api.routers import directories as directories_router
from api.routers import mount_points as mount_points_router
from api.routers import evaluation as evaluation_router
from api.routers import chat as chat_router
from api.routers import misc as misc_router
from api.routers import documents as documents_router
from api.routers import knowledge_points as knowledge_points_router
from api.routers import annotations as annotations_router
from api.routers import finetuning as finetuning_router
from api.routers import training as training_router
from api.routers import config as config_router

router = APIRouter()
router.include_router(config_router.router)
router.include_router(logs_router.router)
router.include_router(api_keys_router.router)
router.include_router(directories_router.router)
router.include_router(mount_points_router.router)
router.include_router(evaluation_router.router)
router.include_router(chat_router.router)
router.include_router(misc_router.router)
router.include_router(documents_router.router)
router.include_router(knowledge_points_router.router)
router.include_router(annotations_router.router)
router.include_router(finetuning_router.router)
router.include_router(training_router.router)
