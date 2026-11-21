"""Liveness and readiness probes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from .. import __version__
from ..inference.hybrid import HybridEngine
from ..schemas import HealthResponse, ReadyResponse
from ..state import AppState, get_state

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def health() -> HealthResponse:
    """Cheap check used by Render / Docker: the process is up."""
    return HealthResponse(status="ok", version=__version__)


@router.get("/ready", response_model=ReadyResponse, summary="Readiness and dependency status")
async def ready(state: AppState = Depends(get_state)) -> ReadyResponse:
    engine = state.engine
    engines = await engine.status() if isinstance(engine, HybridEngine) else {engine.name: await engine.is_ready()}
    serving = any(engines.values())
    cache_ok = await state.cache.ping()
    return ReadyResponse(
        status="ready" if serving and cache_ok else "degraded",
        version=__version__,
        engine=engine.name,
        engines=engines,
        cache=f"{state.cache.backend}{'' if cache_ok else ' (unreachable)'}",
        explanation_provider=state.explanations.active_provider,
        photo_explanations=state.explanations.supports_photos,
        classes=len(state.kb.labels),
    )
