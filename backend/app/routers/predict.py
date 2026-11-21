"""Analysis endpoints: predict, deep analysis and follow-up refinement."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from ..config import get_settings
from ..imaging.validation import ImageValidationError
from ..schemas import DeepAnalysisResponse, PredictionResponse, RefineRequest, RefineResponse
from ..security import limiter, require_api_key
from ..services import refinement
from ..state import AppState, get_state

router = APIRouter(tags=["Analysis"], dependencies=[Depends(require_api_key)])


def _rate() -> str:
    return get_settings().rate_limit


async def read_upload(upload: UploadFile, max_bytes: int) -> bytes:
    """Read at most max_bytes + 1 so huge uploads are rejected without buffering them fully."""
    data = await upload.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ImageValidationError(f"Image is larger than {max_bytes // (1024 * 1024)} MB.",
                                   code="file_too_large", status_code=413)
    return data


@router.post("/predict", response_model=PredictionResponse, summary="Analyse a leaf photo")
@limiter.limit(_rate)
async def predict(request: Request, image: UploadFile = File(..., description="JPEG, PNG or WebP leaf photo"),
                  state: AppState = Depends(get_state)) -> dict:
    data = await read_upload(image, state.settings.max_upload_bytes)
    return await state.predictor.analyze(data)


@router.post("/predict/deep", response_model=DeepAnalysisResponse,
             summary="Occlusion test and patch grid (slower, for Tech mode)")
@limiter.limit("10/minute")
async def predict_deep(request: Request, image: UploadFile = File(...),
                       state: AppState = Depends(get_state)) -> dict:
    data = await read_upload(image, state.settings.max_upload_bytes)
    return await state.predictor.deep_analysis(data)


@router.post("/refine", response_model=RefineResponse, summary="Update a result with follow-up answers")
@limiter.limit(_rate)
async def refine(request: Request, body: RefineRequest, state: AppState = Depends(get_state)) -> dict:
    kb, predictor = state.kb, state.predictor
    unknown = [c.class_id for c in body.candidates if c.class_id not in kb.diseases]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown class id(s): {', '.join(unknown)}")
    ranked = refinement.refine(kb, [(c.class_id, c.confidence) for c in body.candidates], body.answers)
    best_id, best_p = ranked[0]
    next_q = refinement.select_question(kb, ranked, exclude=set(body.answers))
    return {
        "ranked": [predictor.score(kb.get(cid), p) for cid, p in ranked],
        "prediction": predictor.prediction(kb.get(best_id), best_p),
        "knowledge": predictor.knowledge(kb.get(best_id)),
        "next_question": predictor.question(next_q),
    }
