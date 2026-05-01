"""
Plant Disease Detection API
Enhanced FastAPI application with Triton integration
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .config import settings
from .routers import health_router, predict_router
from .routers.predict import limiter
from .security import (
    security_audit_logger as security_audit,
    response_cache
)
from .performance import (
    AsyncTaskManager,
    optimize_memory_usage,
)

# ================= LOGGING =================
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("app.log") if not settings.is_development else logging.NullHandler()
    ]
)
logger = logging.getLogger(__name__)

# ================= INIT COMPONENTS =================
task_manager = AsyncTaskManager(max_concurrent_tasks=getattr(settings, 'max_concurrent_predictions', 10))

security = HTTPBearer(auto_error=False) if settings.api_key else None


# ================= AUTH =================
async def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not settings.api_key:
        return True

    if not credentials or credentials.credentials != settings.api_key:
        await security_audit.log_event(
            event_type="authentication_failure",
            details={"reason": "invalid_api_key"}
        )
        raise HTTPException(status_code=401, detail="Invalid API key")

    await security_audit.log_event(
        event_type="authentication_success",
        details={}
    )
    return True


# ================= LIFECYCLE =================
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting API (Triton Mode)...")

    try:
        await security_audit.initialize()
        await response_cache.initialize()

        logger.info("✅ Security initialized")
        logger.info("✅ Using Triton for inference (no local model)")

        await optimize_memory_usage()

    except Exception as e:
        logger.error(f"Startup error: {e}")

    yield

    logger.info("🛑 Shutting down API...")
    await task_manager.shutdown()
    await security_audit.close()
    await response_cache.close()


# ================= APP =================
app = FastAPI(
    title="Plant Disease Detection API",
    description="AI-powered plant disease detection using Triton",
    version="2.0.0",
    docs_url="/docs",           # ✅ FORCE ENABLE
    redoc_url="/redoc",         # ✅ FORCE ENABLE
    openapi_url="/openapi.json",# ✅ FORCE ENABLE
    lifespan=lifespan,
    debug=settings.debug
)

# ================= MIDDLEWARE =================
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ================= RATE LIMIT =================
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ================= EXCEPTIONS =================
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(status_code=404, content={"detail": "Endpoint not found"})


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ================= ROUTERS =================
app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(predict_router, prefix="/api", tags=["Prediction"])


# ================= ROOT =================
@app.get("/")
async def root():
    return {
        "message": "Plant Disease Detection API (Triton)",
        "version": "2.0.0",
        "status": "running"
    }


# ================= RUN =================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        workers=settings.api_workers,
        log_level=settings.log_level.lower(),
        reload=settings.debug
    )