"""Curated disease knowledge: what the app tells the user after a prediction.

Everything here is reference content written from published extension sources,
not model output. The model decides *which* entry applies; this module supplies
the reviewed, sourced guidance for it. Keeping it as data (one JSON file per crop)
means agronomists can review or translate it without touching code.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).resolve().parent


@dataclass(frozen=True)
class RiskLevel:
    key: str
    label: str
    level: int
    color: str
    description: str


@dataclass(frozen=True)
class Question:
    id: str
    text: str
    help: str
    likelihood_yes: dict[str, float]
    default: float = 0.5

    def likelihood(self, class_id: str, answer: str) -> float:
        p_yes = self.likelihood_yes.get(class_id, self.default)
        if answer == "yes":
            return p_yes
        if answer == "no":
            return 1.0 - p_yes
        return 1.0  # "unsure" carries no information


@dataclass(frozen=True)
class DiseaseInfo:
    id: str
    plant: str
    disease: str
    display_name: str
    healthy: bool
    pathogen: str
    pathogen_type: str
    risk: str
    summary: str
    symptoms: list[str]
    key_sign: str
    favourable_conditions: str
    spread: str
    action_plan: dict[str, list[str]]
    treatment: dict[str, list[str]]
    prevention: list[str]
    look_alikes: list[str] = field(default_factory=list)
    questions: list[str] = field(default_factory=list)
    sources: list[dict[str, str]] = field(default_factory=list)


class KnowledgeBase:
    def __init__(self, directory: Path = KNOWLEDGE_DIR) -> None:
        self.labels: list[str] = json.loads((directory / "labels.json").read_text("utf-8"))
        meta = json.loads((directory / "meta.json").read_text("utf-8"))
        self.risk_levels = {k: RiskLevel(key=k, **v) for k, v in meta["risk_levels"].items()}
        self.questions = {k: Question(id=k, **v) for k, v in meta["questions"].items()}

        self.diseases: dict[str, DiseaseInfo] = {}
        for path in sorted((directory / "crops").glob("*.json")):
            for entry in json.loads(path.read_text("utf-8")):
                info = DiseaseInfo(**entry)
                if info.id in self.diseases:
                    raise ValueError(f"Duplicate class id {info.id} in {path.name}")
                self.diseases[info.id] = info
        self._validate()

    def _validate(self) -> None:
        missing = [label for label in self.labels if label not in self.diseases]
        if missing:
            raise ValueError(f"Knowledge base is missing entries for: {missing}")
        for info in self.diseases.values():
            if info.risk not in self.risk_levels:
                raise ValueError(f"{info.id}: unknown risk level '{info.risk}'")
            for ref in info.look_alikes:
                if ref not in self.diseases:
                    raise ValueError(f"{info.id}: unknown look-alike '{ref}'")
            for qid in info.questions:
                if qid not in self.questions:
                    raise ValueError(f"{info.id}: unknown question '{qid}'")
        for question in self.questions.values():
            for cid, p in question.likelihood_yes.items():
                if cid not in self.diseases or not 0.0 < p < 1.0:
                    raise ValueError(f"Question {question.id}: bad likelihood for {cid}")

    def get(self, class_id: str) -> DiseaseInfo:
        return self.diseases[class_id]

    def by_index(self, index: int) -> DiseaseInfo:
        return self.diseases[self.labels[index]]

    def risk(self, class_id: str) -> RiskLevel:
        return self.risk_levels[self.diseases[class_id].risk]

    @property
    def plants(self) -> list[str]:
        return sorted({d.plant for d in self.diseases.values()})


@lru_cache
def get_knowledge_base() -> KnowledgeBase:
    return KnowledgeBase()
