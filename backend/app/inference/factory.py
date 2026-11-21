"""Build the inference engine selected by configuration."""

from __future__ import annotations

import logging

from ..config import Settings
from .base import InferenceEngine
from .hybrid import HybridEngine
from .onnx_engine import OnnxEngine
from .triton_engine import TritonEngine

logger = logging.getLogger(__name__)


def create_engine(settings: Settings) -> InferenceEngine:
    mode = settings.inference_backend
    if mode == "onnx":
        return OnnxEngine(settings.model_path, settings.onnx_threads)

    triton = TritonEngine(settings.triton_url, settings.triton_model_name, settings.triton_timeout_s)
    if mode == "triton":
        return triton

    logger.info("Hybrid inference: Triton at %s with ONNX Runtime fallback", settings.triton_url)
    return HybridEngine(primary=triton, fallback=OnnxEngine(settings.model_path, settings.onnx_threads))
