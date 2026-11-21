"""Public API response and request models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ClassScore(BaseModel):
    class_id: str
    plant: str
    disease: str
    display_name: str
    confidence: float = Field(ge=0.0, le=1.0)
    healthy: bool


class RiskOut(BaseModel):
    key: str
    label: str
    level: int
    color: str
    description: str


class PredictionOut(ClassScore):
    risk: RiskOut


class Notice(BaseModel):
    code: str
    message: str
    severity: Literal["info", "warning", "danger"] = "warning"


class QualityOut(BaseModel):
    sharpness: float
    brightness: float
    leaf_coverage: float
    ok: bool
    issues: list[Notice]


class StabilityVariant(BaseModel):
    name: str
    class_id: str
    confidence: float
    agrees: bool


class StabilityOut(BaseModel):
    agreement: int
    total: int
    stable: bool
    mean_confidence: float
    variants: list[StabilityVariant]


class RegionOut(BaseModel):
    x: float
    y: float
    width: float
    height: float
    score: float
    area: float


class EvidenceOut(BaseModel):
    class_id: str
    display_name: str
    confidence: float
    image: str


class VisualsOut(BaseModel):
    image: str
    heatmap: str | None = None
    zoom: str | None = None
    regions: list[RegionOut] = []
    evidence: list[EvidenceOut] = []


class SourceOut(BaseModel):
    title: str
    url: str


class ActionPlanOut(BaseModel):
    today: list[str]
    this_week: list[str]
    next_two_weeks: list[str]


class TreatmentOut(BaseModel):
    chemical: list[str]
    organic: list[str]
    cultural: list[str]


class KnowledgeOut(BaseModel):
    summary: str
    pathogen: str
    pathogen_type: str
    symptoms: list[str]
    key_sign: str
    favourable_conditions: str
    spread: str
    action_plan: ActionPlanOut
    treatment: TreatmentOut
    prevention: list[str]
    sources: list[SourceOut]


class QuestionOut(BaseModel):
    id: str
    text: str
    help: str


class CandidateOut(ClassScore):
    key_sign: str
    symptoms: list[str]


class ComparisonOut(BaseModel):
    candidates: list[CandidateOut]
    question: QuestionOut | None = None


class ExplanationOut(BaseModel):
    text: str
    provider: str
    language: str
    model: str | None = None
    photo_aware: bool = False
    translated: bool = True
    cached: bool = False


class TimingsOut(BaseModel):
    preprocess_ms: int
    inference_ms: int
    visuals_ms: int
    total_ms: int


class MetaOut(BaseModel):
    engine: str
    model_version: str
    timings: TimingsOut
    all_scores: list[ClassScore]


class PredictionResponse(BaseModel):
    id: str
    created_at: str
    prediction: PredictionOut
    top_k: list[ClassScore]
    confidence_level: Literal["high", "medium", "low", "uncertain"]
    reliable: bool
    warnings: list[Notice]
    quality: QualityOut
    stability: StabilityOut
    visuals: VisualsOut
    knowledge: KnowledgeOut
    comparison: ComparisonOut | None = None
    explanation: ExplanationOut
    meta: MetaOut


class CandidateIn(BaseModel):
    class_id: str
    confidence: float = Field(ge=0.0, le=1.0)


class RefineRequest(BaseModel):
    candidates: list[CandidateIn] = Field(min_length=2, max_length=10)
    answers: dict[str, Literal["yes", "no", "unsure"]] = Field(min_length=1, max_length=10)


class RefineResponse(BaseModel):
    ranked: list[ClassScore]
    prediction: PredictionOut
    knowledge: KnowledgeOut
    next_question: QuestionOut | None = None


class GridCellOut(BaseModel):
    row: int
    col: int
    x: float
    y: float
    width: float
    height: float
    class_id: str
    display_name: str
    confidence: float
    healthy: bool


class DeepAnalysisResponse(BaseModel):
    class_id: str
    occlusion: str
    grid: list[GridCellOut]
    elapsed_ms: int


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


class ReadyResponse(BaseModel):
    status: Literal["ready", "degraded"]
    version: str
    engine: str
    engines: dict[str, bool]
    cache: str
    explanation_provider: str
    photo_explanations: bool
    classes: int


class ClassInfo(BaseModel):
    class_id: str
    plant: str
    disease: str
    display_name: str
    healthy: bool
    pathogen: str
    pathogen_type: str
    risk: RiskOut


class ClassesResponse(BaseModel):
    total: int
    plants: list[str]
    classes: list[ClassInfo]


class ModelInfoResponse(BaseModel):
    name: str
    version: str
    architecture: str
    input_shape: list[int]
    num_classes: int
    engine: str
    dataset: str
    evaluation: dict[str, float | int | str]
    languages: dict[str, str]
