"""In-process inference with ONNX Runtime (CPU, or CUDA when available)."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import numpy as np

from .base import FEATURES_NAME, INPUT_NAME, LOGITS_NAME, InferenceEngine, InferenceError, InferenceResult

logger = logging.getLogger(__name__)


class OnnxEngine(InferenceEngine):
    name = "onnx"

    def __init__(self, model_path: Path, threads: int = 0) -> None:
        import onnxruntime as ort

        if not Path(model_path).is_file():
            raise InferenceError(f"ONNX model not found at {model_path}")

        options = ort.SessionOptions()
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        # The memory arena keeps peak allocations (e.g. the 34-image deep-analysis batch)
        # for the life of the process: 545 MB vs 231 MB measured, which matters on
        # 512 MB instances. Latency cost is negligible for this model.
        options.enable_cpu_mem_arena = False
        options.enable_mem_pattern = False
        if threads:
            options.intra_op_num_threads = threads
        providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider")
                     if p in ort.get_available_providers()]
        self._session = ort.InferenceSession(str(model_path), options, providers=providers)
        outputs = {o.name for o in self._session.get_outputs()}
        if LOGITS_NAME not in outputs:
            raise InferenceError(f"Model has no '{LOGITS_NAME}' output")
        self._has_features = FEATURES_NAME in outputs
        # ONNX Runtime sessions are thread-safe, but limiting concurrency keeps
        # memory predictable on small instances.
        self._lock = asyncio.Semaphore(2)
        logger.info("ONNX Runtime engine ready (%s, providers=%s, features=%s)",
                    model_path, self._session.get_providers(), self._has_features)

    def _run(self, batch: np.ndarray, with_features: bool) -> InferenceResult:
        wanted = [LOGITS_NAME] + ([FEATURES_NAME] if with_features and self._has_features else [])
        outputs = self._session.run(wanted, {INPUT_NAME: batch.astype(np.float32, copy=False)})
        features = outputs[1] if len(outputs) > 1 else None
        return InferenceResult(logits=outputs[0], features=features, engine=self.name)

    async def infer(self, batch: np.ndarray, *, with_features: bool = True) -> InferenceResult:
        async with self._lock:
            try:
                return await asyncio.to_thread(self._run, batch, with_features)
            except Exception as exc:  # noqa: BLE001 - surface as a domain error
                raise InferenceError(f"ONNX Runtime inference failed: {exc}") from exc

    async def is_ready(self) -> bool:
        return True
