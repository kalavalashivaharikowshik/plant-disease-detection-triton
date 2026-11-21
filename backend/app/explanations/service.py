"""Choose an explanation provider, cache successful AI answers, fall back safely."""

from __future__ import annotations

import hashlib
import logging

from ..config import Settings
from ..services.cache import Cache
from .base import ExplanationError, ExplanationProvider, ExplanationRequest, ExplanationResult
from .gemini import GeminiProvider
from .ollama import OllamaProvider
from .static import StaticProvider

logger = logging.getLogger(__name__)


class ExplanationService:
    def __init__(self, settings: Settings, cache: Cache) -> None:
        self._cache = cache
        self._ttl = settings.cache_ttl_s
        self.static = StaticProvider()
        candidates: list[ExplanationProvider] = []
        choice = settings.explanation_provider
        if choice in ("auto", "gemini") and settings.gemini_api_key:
            candidates.append(GeminiProvider(settings.gemini_api_key, settings.gemini_model,
                                             settings.gemini_timeout_s))
        if choice in ("auto", "ollama") and settings.ollama_url:
            candidates.append(OllamaProvider(settings.ollama_url, settings.ollama_model,
                                             settings.ollama_timeout_s))
        self.providers = candidates

    @property
    def active_provider(self) -> str:
        return self.providers[0].name if self.providers else self.static.name

    @property
    def supports_photos(self) -> bool:
        return any(p.name == "gemini" for p in self.providers)

    @staticmethod
    def _cache_key(provider: str, request: ExplanationRequest) -> str:
        # Photo-aware answers are specific to the image; text answers only to class + language.
        image_part = hashlib.sha256(request.image).hexdigest()[:16] if request.image else "noimg"
        confidence_band = "low" if request.confidence < 0.7 else "ok"
        return f"explain:v1:{provider}:{request.disease.id}:{request.language}:{confidence_band}:{image_part}"

    async def explain(self, request: ExplanationRequest) -> ExplanationResult:
        for provider in self.providers:
            key = self._cache_key(provider.name, request)
            cached = await self._cache.get(key)
            if cached:
                return ExplanationResult(**{**cached, "cached": True})
            try:
                result = await provider.explain(request)
            except ExplanationError as exc:
                logger.warning("Explanation provider '%s' failed: %s", provider.name, exc)
                continue
            await self._cache.set(key, {k: v for k, v in result.__dict__.items() if k != "cached"},
                                  self._ttl)
            return result
        return await self.static.explain(request)

    async def close(self) -> None:
        for provider in self.providers:
            await provider.close()
