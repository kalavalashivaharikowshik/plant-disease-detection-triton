"""Model metadata and the supported class catalogue."""

from fastapi import APIRouter, Depends

from ..explanations.base import LANGUAGES
from ..schemas import ClassesResponse, ClassInfo, ModelInfoResponse, RiskOut
from ..services.predictor import MODEL_VERSION
from ..state import AppState, get_state

router = APIRouter(prefix="/model", tags=["Model"])

# Measured with scripts/evaluate.py; see docs/evaluation.md.
EVALUATION = {
    "dataset": "PlantVillage (color), 10 random images per class",
    "images": 380,
    "top1_accuracy": 0.942,
    "top3_accuracy": 1.0,
    "reliable_share": 0.895,
    "reliable_accuracy": 0.994,
    "note": "Lab photos on plain backgrounds; expect lower accuracy on field photos.",
}


@router.get("/info", response_model=ModelInfoResponse, summary="Model card")
async def model_info(state: AppState = Depends(get_state)) -> ModelInfoResponse:
    return ModelInfoResponse(
        name="Plant Disease Classifier",
        version=MODEL_VERSION,
        architecture="EfficientNet-B0 (ONNX, opset 11)",
        input_shape=[3, 224, 224],
        num_classes=len(state.kb.labels),
        engine=state.engine.name,
        dataset="New Plant Diseases Dataset (augmented PlantVillage), 38 classes",
        evaluation=EVALUATION,
        languages=LANGUAGES,
    )


@router.get("/knowledge", summary="Full curated knowledge base (used by offline mode)")
async def model_knowledge(state: AppState = Depends(get_state)) -> dict:
    kb = state.kb
    return {
        "labels": kb.labels,
        "risk_levels": {k: v.__dict__ for k, v in kb.risk_levels.items()},
        "diseases": {cid: info.__dict__ for cid, info in kb.diseases.items()},
    }


@router.get("/classes", response_model=ClassesResponse, summary="All supported plants and diseases")
async def model_classes(state: AppState = Depends(get_state)) -> ClassesResponse:
    kb = state.kb
    classes = [
        ClassInfo(
            class_id=info.id, plant=info.plant, disease=info.disease,
            display_name=info.display_name, healthy=info.healthy,
            pathogen=info.pathogen, pathogen_type=info.pathogen_type,
            risk=RiskOut(**kb.risk(info.id).__dict__),
        )
        for info in (kb.get(label) for label in kb.labels)
    ]
    return ClassesResponse(total=len(classes), plants=kb.plants, classes=classes)
