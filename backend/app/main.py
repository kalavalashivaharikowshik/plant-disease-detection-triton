"""FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from slowapi.middleware import SlowAPIMiddleware

from . import __version__
from .config import BACKEND_DIR, Settings, get_settings
from .errors import register_error_handlers
from .explainability.cam import ClassifierHead
from .explanations.service import ExplanationService
from .inference.base import InferenceEngine
from .inference.factory import create_engine
from .knowledge.repository import get_knowledge_base
from .logging_config import configure_logging
from .routers import api_router
from .security import SecurityHeadersMiddleware, limiter
from .services.cache import Cache
from .services.predictor import Predictor
from .state import AppState

logger = logging.getLogger(__name__)
HEAD_PATH = BACKEND_DIR / "app" / "assets" / "classifier_head.npz"


def build_state(settings: Settings, engine: InferenceEngine | None = None) -> AppState:
    kb = get_knowledge_base()
    engine = engine or create_engine(settings)
    head = ClassifierHead(HEAD_PATH)
    cache = Cache(settings.redis_url, settings.cache_ttl_s)
    explanations = ExplanationService(settings, cache)
    return AppState(
        settings=settings, engine=engine, kb=kb, head=head, cache=cache,
        explanations=explanations, predictor=Predictor(engine, kb, head, settings),
    )


def mount_frontend(app: FastAPI, static_dir: Path) -> None:
    """Serve the built single-page app (one-container deployments such as Render)."""
    index = static_dir / "index.html"
    if not index.is_file():
        logger.info("No frontend build at %s; serving API only", static_dir)
        return
    root = static_dir.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Endpoint not found")
        candidate = (root / path).resolve()
        if path and candidate.is_file() and root in candidate.parents:
            cache = ("public, max-age=31536000, immutable" if path.startswith("assets/")
                     else "public, max-age=3600")
            return FileResponse(candidate, headers={"Cache-Control": cache})
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    logger.info("Serving frontend from %s", static_dir)


def create_app(settings: Settings | None = None, engine: InferenceEngine | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        state = build_state(settings, engine)
        app.state.services = state
        logger.info("Started v%s (engine=%s, explanations=%s, cache=%s)", __version__,
                    state.engine.name, state.explanations.active_provider, state.cache.backend)
        yield
        await state.explanations.close()
        await state.cache.close()
        await state.engine.close()

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description="Leaf photo → disease, confidence, heatmap, reliability checks and sourced treatment advice.",
        lifespan=lifespan,
    )
    app.state.limiter = limiter
    register_error_handlers(app)

    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-API-Key"],
    )

    app.include_router(api_router)
    mount_frontend(app, settings.static_dir)
    return app


app = create_app()
