"""Local Ollama provider (offline, text-only)."""

from __future__ import annotations

import httpx

from .base import ExplanationError, ExplanationProvider, ExplanationRequest, ExplanationResult
from .prompt import SYSTEM_INSTRUCTION, build_prompt


class OllamaProvider(ExplanationProvider):
    name = "ollama"

    def __init__(self, base_url: str, model: str, timeout_s: float = 60.0,
                 transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._base = base_url.rstrip("/")
        self._model = model
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(timeout_s, connect=3.0), transport=transport)

    @property
    def available(self) -> bool:
        return bool(self._base)

    async def explain(self, request: ExplanationRequest) -> ExplanationResult:
        payload = {
            "model": self._model,
            "system": SYSTEM_INSTRUCTION,
            "prompt": build_prompt(request),
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 600},
        }
        try:
            response = await self._client.post(f"{self._base}/api/generate", json=payload)
        except httpx.HTTPError as exc:
            raise ExplanationError(f"Ollama request failed: {exc!r}") from exc
        data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        if response.status_code != 200 or "error" in data:
            # e.g. 404 "model 'llama3' not found, try pulling it first"
            raise ExplanationError(f"Ollama error (HTTP {response.status_code}): {data.get('error', response.text[:200])}")
        text = (data.get("response") or "").strip()
        if not text:
            raise ExplanationError("Ollama returned an empty explanation")
        return ExplanationResult(text=text, provider=self.name, language=request.language, model=self._model)

    async def close(self) -> None:
        await self._client.aclose()
