"""AI explanation endpoint (called after /predict so the result shows instantly)."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from ..config import get_settings
from ..explanations.base import LANGUAGES, ExplanationRequest
from ..imaging.validation import sniff_format
from ..schemas import ExplanationOut
from ..security import limiter, require_api_key
from ..state import AppState, get_state
from .predict import read_upload

router = APIRouter(tags=["Explanation"], dependencies=[Depends(require_api_key)])


@router.post("/explain", response_model=ExplanationOut, summary="Plain-language explanation in a chosen language")
@limiter.limit(lambda: get_settings().rate_limit)
async def explain(
    request: Request,
    class_id: str = Form(...),
    confidence: float = Form(..., ge=0.0, le=1.0),
    language: str = Form("en"),
    alternatives: str = Form("[]", description='JSON list of {"class_id", "confidence"}'),
    image: UploadFile | None = File(None, description="Optional photo for photo-aware explanations"),
    state: AppState = Depends(get_state),
) -> dict:
    kb = state.kb
    if class_id not in kb.diseases:
        raise HTTPException(status_code=422, detail="Unknown class_id")
    if language not in LANGUAGES:
        raise HTTPException(status_code=422, detail=f"Unsupported language. Use one of: {', '.join(LANGUAGES)}")
    try:
        alt_items = json.loads(alternatives)[:2]
        alts = [(kb.get(a["class_id"]), float(a["confidence"])) for a in alt_items if a["class_id"] in kb.diseases]
    except (ValueError, KeyError, TypeError):
        alts = []

    data, mime = None, "image/jpeg"
    if image is not None and state.explanations.supports_photos:
        data = await read_upload(image, state.settings.max_upload_bytes)
        fmt = sniff_format(data)
        data, mime = (data, f"image/{fmt}") if fmt else (None, mime)

    result = await state.explanations.explain(ExplanationRequest(
        disease=kb.get(class_id), confidence=confidence, language=language,
        alternatives=alts, image=data, image_mime=mime,
    ))
    return result.__dict__
