"""Consistent JSON error responses that never leak internals."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from .imaging.validation import ImageValidationError
from .inference.base import InferenceError

logger = logging.getLogger(__name__)


def _error(status: int, code: str, message: str, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": message, "code": code}, headers=headers)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ImageValidationError)
    async def image_error(_: Request, exc: ImageValidationError):
        return _error(exc.status_code, exc.code, str(exc))

    @app.exception_handler(InferenceError)
    async def inference_error(_: Request, exc: InferenceError):
        logger.error("Inference failed: %s", exc)
        return _error(503, "inference_unavailable",
                      "The analysis service is temporarily unavailable. Please try again shortly.")

    @app.exception_handler(RateLimitExceeded)
    async def rate_limited(_: Request, exc: RateLimitExceeded):
        return _error(429, "rate_limited", f"Too many requests ({exc.detail}). Please slow down.",
                      headers={"Retry-After": "60"})

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(p) for p in first.get("loc", []) if p not in ("body", "query"))
        return _error(422, "invalid_request", f"Invalid request{f' ({field})' if field else ''}: "
                                             f"{first.get('msg', 'bad input')}")

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        code = {401: "unauthorized", 404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "error")
        return _error(exc.status_code, code, str(exc.detail), headers=getattr(exc, "headers", None))

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        logger.exception("Unhandled error: %s", exc)
        return _error(500, "internal_error", "Something went wrong on our side. Please try again.")
