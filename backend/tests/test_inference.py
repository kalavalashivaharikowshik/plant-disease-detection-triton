import json

import httpx
import numpy as np
import pytest

from app.config import Settings
from app.inference.base import InferenceEngine, InferenceError, InferenceResult
from app.inference.hybrid import HybridEngine
from app.inference.onnx_engine import OnnxEngine
from app.inference.triton_engine import HEADER_LENGTH, TritonEngine, build_request, parse_response


@pytest.fixture(scope="module")
def onnx_engine():
    return OnnxEngine(Settings().model_path)


async def test_onnx_engine_returns_logits_and_features(onnx_engine):
    batch = np.zeros((2, 3, 224, 224), dtype=np.float32)
    result = await onnx_engine.infer(batch)
    assert result.logits.shape == (2, 38)
    assert result.features.shape == (2, 1280, 7, 7)
    assert result.engine == "onnx"
    no_features = await onnx_engine.infer(batch, with_features=False)
    assert no_features.features is None


def test_binary_request_roundtrip():
    batch = np.random.default_rng(0).standard_normal((1, 3, 224, 224)).astype(np.float32)
    body, header_len = build_request(batch, ["output", "features"])
    header = json.loads(body[:header_len])
    assert header["inputs"][0]["parameters"]["binary_data_size"] == batch.nbytes
    assert np.array_equal(np.frombuffer(body[header_len:], dtype=np.float32).reshape(batch.shape), batch)
    assert len(body) < 700_000  # vs ~3 MB as JSON numbers


def _fake_triton(logits: np.ndarray, features: np.ndarray):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/ready"):
            return httpx.Response(200)
        header_len = int(request.headers[HEADER_LENGTH])
        req = json.loads(request.content[:header_len])
        assert req["inputs"][0]["shape"] == [1, 3, 224, 224]
        out_header = json.dumps({"outputs": [
            {"name": "output", "datatype": "FP32", "shape": list(logits.shape),
             "parameters": {"binary_data_size": logits.nbytes}},
            {"name": "features", "datatype": "FP32", "shape": list(features.shape),
             "parameters": {"binary_data_size": features.nbytes}},
        ]}).encode()
        return httpx.Response(200, content=out_header + logits.tobytes() + features.tobytes(),
                              headers={HEADER_LENGTH: str(len(out_header))})
    return httpx.MockTransport(handler)


async def test_triton_engine_parses_binary_response():
    logits = np.arange(38, dtype=np.float32).reshape(1, 38)
    features = np.ones((1, 1280, 7, 7), dtype=np.float32)
    engine = TritonEngine("http://triton:8000", "plant_model", transport=_fake_triton(logits, features))
    result = await engine.infer(np.zeros((1, 3, 224, 224), dtype=np.float32))
    assert np.array_equal(result.logits, logits)
    assert result.features.shape == (1, 1280, 7, 7)
    assert await engine.is_ready()


def test_parse_response_supports_json_data():
    body = json.dumps({"outputs": [{"name": "output", "datatype": "FP32", "shape": [1, 2],
                                    "data": [0.5, 1.5]}]}).encode()
    assert parse_response(body, None)["output"].tolist() == [[0.5, 1.5]]


async def test_triton_errors_become_inference_errors():
    engine = TritonEngine("http://triton:8000", "plant_model",
                          transport=httpx.MockTransport(lambda r: httpx.Response(500, text="boom")))
    with pytest.raises(InferenceError):
        await engine.infer(np.zeros((1, 3, 224, 224), dtype=np.float32))


class _Failing(InferenceEngine):
    name = "triton"
    calls = 0

    async def infer(self, batch, *, with_features=True):
        self.calls += 1
        raise InferenceError("down")

    async def is_ready(self):
        return False


class _Working(InferenceEngine):
    name = "onnx"

    async def infer(self, batch, *, with_features=True):
        return InferenceResult(np.zeros((len(batch), 38)), None, self.name)

    async def is_ready(self):
        return True


async def test_hybrid_falls_back_and_cools_down():
    primary = _Failing()
    hybrid = HybridEngine(primary, _Working(), cooldown_s=60)
    batch = np.zeros((1, 3, 224, 224), dtype=np.float32)
    assert (await hybrid.infer(batch)).engine == "onnx"
    assert (await hybrid.infer(batch)).engine == "onnx"
    assert primary.calls == 1  # skipped during cooldown
    assert await hybrid.status() == {"triton": False, "onnx": True}
