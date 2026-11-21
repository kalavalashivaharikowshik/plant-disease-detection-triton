"""Application services created once at startup and shared by all requests."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request

from .config import Settings
from .explainability.cam import ClassifierHead
from .explanations.service import ExplanationService
from .inference.base import InferenceEngine
from .knowledge.repository import KnowledgeBase
from .services.cache import Cache
from .services.predictor import Predictor


@dataclass
class AppState:
    settings: Settings
    engine: InferenceEngine
    kb: KnowledgeBase
    head: ClassifierHead
    cache: Cache
    explanations: ExplanationService
    predictor: Predictor


def get_state(request: Request) -> AppState:
    return request.app.state.services
