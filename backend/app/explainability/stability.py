"""Stability check: does the diagnosis survive small, harmless changes to the photo?

A reliable prediction should not flip when the leaf is mirrored, rotated or the
lighting changes slightly. The original image is always variant 0, so this batch
also produces the main prediction (one model call in total).
"""

from __future__ import annotations

from collections.abc import Callable

import numpy as np

Variant = tuple[str, Callable[[np.ndarray], np.ndarray]]

VARIANTS: list[Variant] = [
    ("original", lambda rgb: rgb),
    ("mirrored", lambda rgb: rgb[:, ::-1]),
    ("flipped", lambda rgb: rgb[::-1]),
    ("rotated 90°", lambda rgb: np.rot90(rgb)),
    ("darker", lambda rgb: rgb * 0.75),
    ("brighter", lambda rgb: np.clip(rgb * 1.25, 0.0, 1.0)),
]

STABLE_RATIO = 0.8


def make_variants(model_rgb: np.ndarray, count: int) -> tuple[list[str], list[np.ndarray]]:
    chosen = VARIANTS[:max(1, min(count, len(VARIANTS)))]
    names = [name for name, _ in chosen]
    images = [np.ascontiguousarray(fn(model_rgb), dtype=np.float32) for _, fn in chosen]
    return names, images


def summarise(names: list[str], probabilities: np.ndarray, labels: list[str]) -> dict:
    """probabilities: (num_variants, num_classes); row 0 is the original image."""
    reference = int(np.argmax(probabilities[0]))
    variants = []
    for name, probs in zip(names, probabilities, strict=True):
        index = int(np.argmax(probs))
        variants.append({
            "name": name,
            "class_id": labels[index],
            "confidence": round(float(probs[index]), 4),
            "agrees": index == reference,
        })
    agreement = sum(v["agrees"] for v in variants)
    total = len(variants)
    return {
        "agreement": agreement,
        "total": total,
        "stable": total == 1 or agreement / total >= STABLE_RATIO,
        "mean_confidence": round(float(probabilities[:, reference].mean()), 4),
        "variants": variants,
    }
