"""Shared types for explanation providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from ..knowledge.repository import DiseaseInfo

LANGUAGES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "kn": "Kannada",
    "mr": "Marathi",
}


class ExplanationError(RuntimeError):
    """Raised when a provider cannot produce an explanation."""


@dataclass
class ExplanationRequest:
    disease: DiseaseInfo
    confidence: float
    language: str = "en"
    alternatives: list[tuple[DiseaseInfo, float]] = field(default_factory=list)
    image: bytes | None = None
    image_mime: str = "image/jpeg"

    @property
    def language_name(self) -> str:
        return LANGUAGES.get(self.language, "English")


@dataclass
class ExplanationResult:
    text: str
    provider: str
    language: str
    model: str | None = None
    photo_aware: bool = False
    translated: bool = True
    cached: bool = False


class ExplanationProvider(ABC):
    name: str = "base"

    @property
    def available(self) -> bool:
        return True

    @abstractmethod
    async def explain(self, request: ExplanationRequest) -> ExplanationResult:
        ...

    async def close(self) -> None:  # pragma: no cover
        return None
