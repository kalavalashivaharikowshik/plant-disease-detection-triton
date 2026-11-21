import json

import httpx

from app.config import Settings
from app.explanations.base import ExplanationRequest
from app.explanations.gemini import GeminiProvider
from app.explanations.ollama import OllamaProvider
from app.explanations.service import ExplanationService
from app.knowledge.repository import get_knowledge_base
from app.services.cache import Cache


def request(class_id="Tomato___Late_blight", **kwargs) -> ExplanationRequest:
    return ExplanationRequest(disease=get_knowledge_base().get(class_id), confidence=0.9, **kwargs)


async def test_gemini_sends_photo_and_parses_text():
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(req.content)
        seen["key"] = req.headers["x-goog-api-key"]
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "Hello farmer"}]}}]})

    provider = GeminiProvider("k", "gemini-test", transport=httpx.MockTransport(handler))
    result = await provider.explain(request(language="te", image=b"\xff\xd8\xffdata"))
    assert result.text == "Hello farmer" and result.photo_aware
    parts = seen["body"]["contents"][0]["parts"]
    assert "Telugu" in parts[0]["text"] and "inline_data" in parts[1]
    assert seen["key"] == "k"


async def test_failed_provider_falls_back_and_is_not_cached():
    calls = {"n": 0}

    def not_pulled(_: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(404, json={"error": "model 'llama3' not found, try pulling it first"})

    service = ExplanationService(Settings(explanation_provider="static"), Cache())
    service.providers = [OllamaProvider("http://ollama:11434", "llama3", transport=httpx.MockTransport(not_pulled))]
    first = await service.explain(request())
    await service.explain(request())
    assert first.provider == "static" and "Explanation not available" not in first.text
    assert calls["n"] == 2  # failure was not cached


async def test_success_is_cached_per_class():
    calls = {"n": 0}

    def ok(_: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json={"response": "Explained"})

    service = ExplanationService(Settings(explanation_provider="static"), Cache())
    service.providers = [OllamaProvider("http://ollama:11434", "m", transport=httpx.MockTransport(ok))]
    await service.explain(request("Tomato___Tomato_mosaic_virus"))
    cached = await service.explain(request("Tomato___Tomato_mosaic_virus"))
    other = await service.explain(request("Tomato___Tomato_Yellow_Leaf_Curl_Virus"))
    assert cached.cached and not other.cached
    assert calls["n"] == 2
