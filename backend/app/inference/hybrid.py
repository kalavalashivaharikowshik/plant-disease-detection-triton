"""Hybrid engine: prefer Triton, fall back to the in-process ONNX Runtime engine."""

from __future__ import annotations

import logging
import time

import numpy as np

from .base import InferenceEngine, InferenceError, InferenceResult

logger = logging.getLogger(__name__)


class HybridEngine(InferenceEngine):
    """Routes requests to the primary engine and transparently falls back.

    After a primary failure the primary is skipped for ``cooldown_s`` seconds so a
    dead Triton does not add a timeout to every request.
    """

    name = "hybrid"

    def __init__(self, primary: InferenceEngine, fallback: InferenceEngine,
                 cooldown_s: float = 30.0) -> None:
        self.primary = primary
        self.fallback = fallback
        self._cooldown_s = cooldown_s
        self._skip_until = 0.0

    def _primary_available(self) -> bool:
        return time.monotonic() >= self._skip_until

    async def infer(self, batch: np.ndarray, *, with_features: bool = True) -> InferenceResult:
        if self._primary_available():
            try:
                return await self.primary.infer(batch, with_features=with_features)
            except InferenceError as exc:
                self._skip_until = time.monotonic() + self._cooldown_s
                logger.warning("Primary engine '%s' failed, using '%s' for %.0fs: %s",
                               self.primary.name, self.fallback.name, self._cooldown_s, exc)
        return await self.fallback.infer(batch, with_features=with_features)

    async def is_ready(self) -> bool:
        return await self.primary.is_ready() or await self.fallback.is_ready()

    async def status(self) -> dict[str, bool]:
        return {
            self.primary.name: await self.primary.is_ready(),
            self.fallback.name: await self.fallback.is_ready(),
        }

    async def close(self) -> None:
        await self.primary.close()
        await self.fallback.close()
