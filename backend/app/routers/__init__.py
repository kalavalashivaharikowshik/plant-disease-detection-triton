from fastapi import APIRouter

from . import explain, health, model, predict

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(model.router)
api_router.include_router(predict.router)
api_router.include_router(explain.router)

__all__ = ["api_router"]
