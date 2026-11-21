"""End-to-end analysis pipeline for one uploaded photo."""

from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime

import numpy as np

from ..config import Settings
from ..explainability import cam
from ..explainability.cam import ClassifierHead
from ..explainability.deep import grid_inputs, occlusion_inputs, occlusion_map
from ..explainability.render import overlay, to_data_url
from ..explainability.stability import make_variants, summarise
from ..imaging import quality as quality_mod
from ..imaging.preprocessing import prepare, softmax, to_batch
from ..imaging.validation import open_image
from ..inference.base import InferenceEngine
from ..knowledge.repository import DiseaseInfo, KnowledgeBase
from . import refinement

MODEL_VERSION = "efficientnet-b0-plantvillage-38@1"
EVIDENCE_SIZE = 320
DEEP_BATCH = 16


def _ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)


def confidence_level(confidence: float) -> str:
    if confidence >= 0.9:
        return "high"
    if confidence >= 0.7:
        return "medium"
    if confidence >= 0.5:
        return "low"
    return "uncertain"


class Predictor:
    def __init__(self, engine: InferenceEngine, kb: KnowledgeBase, head: ClassifierHead,
                 settings: Settings) -> None:
        self.engine = engine
        self.kb = kb
        self.head = head
        self.settings = settings

    # ---------- formatting helpers ----------
    def score(self, info: DiseaseInfo, confidence: float) -> dict:
        return {
            "class_id": info.id, "plant": info.plant, "disease": info.disease,
            "display_name": info.display_name, "confidence": round(float(confidence), 4),
            "healthy": info.healthy,
        }

    def prediction(self, info: DiseaseInfo, confidence: float) -> dict:
        return {**self.score(info, confidence), "risk": self.kb.risk(info.id).__dict__}

    @staticmethod
    def knowledge(info: DiseaseInfo) -> dict:
        return {
            "summary": info.summary, "pathogen": info.pathogen, "pathogen_type": info.pathogen_type,
            "symptoms": info.symptoms, "key_sign": info.key_sign,
            "favourable_conditions": info.favourable_conditions, "spread": info.spread,
            "action_plan": info.action_plan, "treatment": info.treatment,
            "prevention": info.prevention, "sources": info.sources,
        }

    @staticmethod
    def question(q) -> dict | None:
        return {"id": q.id, "text": q.text, "help": q.help} if q else None

    # ---------- main analysis ----------
    async def analyze(self, data: bytes) -> dict:
        settings = self.settings
        start = time.perf_counter()
        image = open_image(data, max_bytes=settings.max_upload_bytes,
                           max_pixels=settings.max_image_pixels)
        prepared = prepare(image)
        quality = quality_mod.assess(prepared.display)
        names, variant_images = make_variants(prepared.model_rgb, settings.stability_variants)
        preprocess_ms = _ms(start)

        t_infer = time.perf_counter()
        result = await self.engine.infer(to_batch(variant_images), with_features=True)
        inference_ms = _ms(t_infer)

        probs = softmax(result.logits.astype(np.float64))
        main = probs[0]
        order = np.argsort(main)[::-1]
        top_index = int(order[0])
        top_info = self.kb.by_index(top_index)
        top_conf = float(main[top_index])
        top_k = [self.score(self.kb.by_index(int(i)), main[i]) for i in order[:settings.top_k]]
        second_conf = float(main[order[1]])
        stability = summarise(names, probs, self.kb.labels)

        # ---------- visuals ----------
        t_vis = time.perf_counter()
        visuals: dict = {"image": to_data_url(prepared.display), "regions": [], "evidence": []}
        ambiguous = (top_conf - second_conf) < settings.ambiguity_margin or top_conf < settings.confidence_threshold
        if result.features is not None:
            features = result.features[0]
            heat = self.head.cam(features, top_index)
            visuals["heatmap"] = cam.heatmap_image(prepared.display, heat)
            if not top_info.healthy:
                visuals["regions"] = [r.__dict__ for r in cam.find_regions(heat, prepared.model_rgb)]
                visuals["zoom"] = cam.zoom_on_peak(prepared.original, heat, prepared.model_rgb)
            if ambiguous:
                small = prepared.display.copy()
                small.thumbnail((EVIDENCE_SIZE, EVIDENCE_SIZE))
                for idx in order[:2]:
                    info = self.kb.by_index(int(idx))
                    visuals["evidence"].append({
                        "class_id": info.id, "display_name": info.display_name,
                        "confidence": round(float(main[idx]), 4),
                        "image": to_data_url(overlay(small, self.head.cam(features, int(idx)))),
                    })
        visuals_ms = _ms(t_vis)

        # ---------- reliability ----------
        warnings: list[dict] = [{**issue, "severity": "warning"} for issue in quality.issues]
        if top_conf < settings.confidence_threshold:
            warnings.append({"code": "low_confidence", "severity": "danger",
                             "message": f"The AI is only {top_conf * 100:.0f}% sure. Retake the photo or "
                                        "confirm with an expert before treating."})
        if not stability["stable"]:
            warnings.append({"code": "unstable", "severity": "warning",
                             "message": f"The answer changed in {stability['total'] - stability['agreement']} of "
                                        f"{stability['total']} slightly altered copies of the photo."})
        if ambiguous and not top_info.healthy:
            second = self.kb.by_index(int(order[1]))
            warnings.append({"code": "ambiguous", "severity": "info",
                             "message": f"It could also be {second.display_name} "
                                        f"({second_conf * 100:.0f}%). See the comparison below."})
        reliable = top_conf >= settings.confidence_threshold and stability["stable"] and quality.ok

        comparison = None
        if ambiguous:
            candidates = [(self.kb.labels[int(i)], float(main[i])) for i in order[:settings.top_k]]
            comparison = {
                "candidates": [{**self.score(self.kb.get(cid), p), "key_sign": self.kb.get(cid).key_sign,
                                "symptoms": self.kb.get(cid).symptoms} for cid, p in candidates[:2]],
                "question": self.question(refinement.select_question(self.kb, candidates)),
            }

        static_text = await self._static_explanation(top_info, top_conf)

        return {
            "id": uuid.uuid4().hex,
            "created_at": datetime.now(UTC).isoformat(),
            "prediction": self.prediction(top_info, top_conf),
            "top_k": top_k,
            "confidence_level": confidence_level(top_conf),
            "reliable": reliable,
            "warnings": warnings,
            "quality": {"sharpness": quality.sharpness, "brightness": quality.brightness,
                        "leaf_coverage": quality.leaf_coverage, "ok": quality.ok,
                        "issues": [{**i, "severity": "warning"} for i in quality.issues]},
            "stability": stability,
            "visuals": visuals,
            "knowledge": self.knowledge(top_info),
            "comparison": comparison,
            "explanation": static_text,
            "meta": {
                "engine": result.engine,
                "model_version": MODEL_VERSION,
                "timings": {"preprocess_ms": preprocess_ms, "inference_ms": inference_ms,
                            "visuals_ms": visuals_ms, "total_ms": _ms(start)},
                "all_scores": [self.score(self.kb.by_index(int(i)), main[i]) for i in order],
            },
        }

    async def _static_explanation(self, info: DiseaseInfo, confidence: float) -> dict:
        from ..explanations.base import ExplanationRequest
        from ..explanations.static import StaticProvider

        result = await StaticProvider().explain(ExplanationRequest(disease=info, confidence=confidence))
        return result.__dict__

    # ---------- deep analysis (on demand) ----------
    async def _infer_probs(self, images: list[np.ndarray]) -> np.ndarray:
        chunks = []
        for i in range(0, len(images), DEEP_BATCH):
            res = await self.engine.infer(to_batch(images[i:i + DEEP_BATCH]), with_features=False)
            chunks.append(softmax(res.logits.astype(np.float64)))
        return np.concatenate(chunks)

    async def deep_analysis(self, data: bytes) -> dict:
        start = time.perf_counter()
        image = open_image(data, max_bytes=self.settings.max_upload_bytes,
                           max_pixels=self.settings.max_image_pixels)
        prepared = prepare(image)
        positions, occluded = occlusion_inputs(prepared.model_rgb)
        cells, crops = grid_inputs(prepared.original)
        probs = await self._infer_probs([prepared.model_rgb, *occluded, *crops])
        base = probs[0]
        class_index = int(np.argmax(base))
        occ = occlusion_map(positions, probs[1:1 + len(positions)], float(base[class_index]), class_index)
        grid = []
        for (row, col, (x, y, w, h)), p in zip(cells, probs[1 + len(positions):], strict=True):
            info = self.kb.by_index(int(np.argmax(p)))
            grid.append({"row": row, "col": col, "x": round(x, 4), "y": round(y, 4),
                         "width": round(w, 4), "height": round(h, 4), "class_id": info.id,
                         "display_name": info.display_name, "confidence": round(float(p.max()), 4),
                         "healthy": info.healthy})
        return {
            "class_id": self.kb.labels[class_index],
            "occlusion": to_data_url(overlay(prepared.display, occ)),
            "grid": grid,
            "elapsed_ms": _ms(start),
        }
