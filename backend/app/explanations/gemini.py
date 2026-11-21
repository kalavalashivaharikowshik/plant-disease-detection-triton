"""Google Gemini provider (REST, generateContent) with optional photo input."""

from __future__ import annotations

import base64
import logging

import httpx

from .base import ExplanationError, ExplanationProvider, ExplanationRequest, ExplanationResult
from .prompt import SYSTEM_INSTRUCTION, build_prompt

logger = logging.getLogger(__name__)

API_ROOT = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProvider(ExplanationProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str, timeout_s: float = 30.0) -> None:
        self._api_key = api_key
        self._model = model
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(timeout_s, connect=5.0))

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    async def explain(self, request: ExplanationRequest) -> ExplanationResult:
        parts: list[dict] = [{"text": build_prompt(request)}]
        if request.image:
            parts.append({"inline_data": {
                "mime_type": request.image_mime,
                "data": base64.b64encode(request.image).decode(),
            }})
        body = {
            "system_instruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 700},
        }
        try:
            response = await self._client.post(
                f"{API_ROOT}/models/{self._model}:generateContent",
                json=body,
                headers={"x-goog-api-key": self._api_key},
            )
        except httpx.HTTPError as exc:
            raise ExplanationError(f"Gemini request failed: {exc!r}") from exc
        if response.status_code != 200:
            raise ExplanationError(f"Gemini returned HTTP {response.status_code}: {response.text[:300]}")

        data = response.json()
        try:
            candidate = data["candidates"][0]
            text = "".join(p.get("text", "") for p in candidate["content"]["parts"]).strip()
        except (KeyError, IndexError, TypeError) as exc:
            reason = (data.get("promptFeedback") or {}).get("blockReason", "no candidates")
            raise ExplanationError(f"Gemini returned no text ({reason})") from exc
        if not text:
            raise ExplanationError("Gemini returned an empty explanation")
        return ExplanationResult(
            text=text, provider=self.name, language=request.language,
            model=self._model, photo_aware=request.image is not None,
        )

    async def close(self) -> None:
        await self._client.aclose()
