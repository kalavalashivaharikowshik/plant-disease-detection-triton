"""Common interface for inference engines."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np

INPUT_NAME = "input"
LOGITS_NAME = "output"
FEATURES_NAME = "features"


class InferenceError(RuntimeError):
    """Raised when an engine cannot produce a result."""


@dataclass(frozen=True)
class InferenceResult:
    logits: np.ndarray  # (N, num_classes)
    features: np.ndarray | None  # (N, C, H, W) last conv feature map, if available
    engine: str  # "onnx" | "triton"


class InferenceEngine(ABC):
    name: str = "base"

    @abstractmethod
    async def infer(self, batch: np.ndarray, *, with_features: bool = True) -> InferenceResult:
        """Run the model on a float32 batch shaped (N, 3, 224, 224)."""

    @abstractmethod
    async def is_ready(self) -> bool:
        """Return True when the engine can serve requests."""

    async def close(self) -> None:  # pragma: no cover - default no-op
        return None
