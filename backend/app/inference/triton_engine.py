"""Remote inference on NVIDIA Triton using the KServe v2 HTTP protocol.

Tensors are sent with Triton's *binary tensor data* extension instead of JSON
numbers: a 1x3x224x224 FP32 input is ~0.6 MB raw versus ~3 MB as JSON text.
"""

from __future__ import annotations

import json
import logging

import httpx
import numpy as np

from .base import FEATURES_NAME, INPUT_NAME, LOGITS_NAME, InferenceEngine, InferenceError, InferenceResult

logger = logging.getLogger(__name__)

HEADER_LENGTH = "Inference-Header-Content-Length"
_DTYPES = {"FP32": np.float32, "FP16": np.float16, "INT64": np.int64, "INT32": np.int32}


def build_request(batch: np.ndarray, outputs: list[str]) -> tuple[bytes, int]:
    """Encode a binary inference request. Returns (body, json_header_length)."""
    tensor = np.ascontiguousarray(batch, dtype=np.float32)
    raw = tensor.tobytes()
    header = {
        "inputs": [{
            "name": INPUT_NAME,
            "shape": list(tensor.shape),
            "datatype": "FP32",
            "parameters": {"binary_data_size": len(raw)},
        }],
        "outputs": [{"name": name, "parameters": {"binary_data": True}} for name in outputs],
    }
    header_bytes = json.dumps(header, separators=(",", ":")).encode()
    return header_bytes + raw, len(header_bytes)


def parse_response(body: bytes, header_length: int | None) -> dict[str, np.ndarray]:
    """Decode a (possibly binary) inference response into numpy arrays by output name."""
    if header_length is None:
        header_length = len(body)
    header = json.loads(body[:header_length])
    offset = header_length
    result: dict[str, np.ndarray] = {}
    for out in header.get("outputs", []):
        dtype = _DTYPES.get(out["datatype"])
        if dtype is None:
            raise InferenceError(f"Unsupported output datatype {out['datatype']}")
        size = (out.get("parameters") or {}).get("binary_data_size")
        if size is not None:
            array = np.frombuffer(body[offset:offset + size], dtype=dtype)
            offset += size
        else:
            array = np.asarray(out["data"], dtype=dtype)
        result[out["name"]] = array.reshape(out["shape"])
    return result


class TritonEngine(InferenceEngine):
    name = "triton"

    def __init__(self, base_url: str, model_name: str, timeout_s: float = 10.0) -> None:
        self._base = base_url.rstrip("/")
        self._model = model_name
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(timeout_s, connect=3.0))

    @property
    def infer_url(self) -> str:
        return f"{self._base}/v2/models/{self._model}/infer"

    async def infer(self, batch: np.ndarray, *, with_features: bool = True) -> InferenceResult:
        outputs = [LOGITS_NAME] + ([FEATURES_NAME] if with_features else [])
        body, header_len = build_request(batch, outputs)
        try:
            response = await self._client.post(
                self.infer_url,
                content=body,
                headers={HEADER_LENGTH: str(header_len),
                         "Content-Type": "application/octet-stream"},
            )
        except httpx.HTTPError as exc:
            raise InferenceError(f"Triton request failed: {exc!r}") from exc
        if response.status_code != 200:
            raise InferenceError(f"Triton returned HTTP {response.status_code}: {response.text[:200]}")
        length = response.headers.get(HEADER_LENGTH)
        tensors = parse_response(response.content, int(length) if length else None)
        if LOGITS_NAME not in tensors:
            raise InferenceError("Triton response did not include logits")
        return InferenceResult(
            logits=tensors[LOGITS_NAME], features=tensors.get(FEATURES_NAME), engine=self.name
        )

    async def is_ready(self) -> bool:
        try:
            response = await self._client.get(f"{self._base}/v2/models/{self._model}/ready")
            return response.status_code == 200
        except httpx.HTTPError:
            return False

    async def close(self) -> None:
        await self._client.aclose()
