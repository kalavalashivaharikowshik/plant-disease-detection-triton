"""Deeper, slower analyses that run on demand (Tech mode).

* Occlusion sensitivity - hide one patch at a time and measure how much the
  confidence for the predicted class drops. Independent of the heatmap method,
  so it acts as a second opinion (it can expose reliance on the background).
* Patch grid - classify each part of the leaf on its own to show which areas
  look diseased and which look healthy.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

from ..imaging.preprocessing import IMAGENET_MEAN, MODEL_SIZE

OCCLUSION_PATCH = 64
OCCLUSION_STRIDE = 40
GRID_SIZE = 3
GRID_OVERLAP = 0.15


def occlusion_inputs(model_rgb: np.ndarray) -> tuple[list[tuple[int, int]], list[np.ndarray]]:
    positions, images = [], []
    for y in range(0, MODEL_SIZE - OCCLUSION_PATCH + 1, OCCLUSION_STRIDE):
        for x in range(0, MODEL_SIZE - OCCLUSION_PATCH + 1, OCCLUSION_STRIDE):
            occluded = model_rgb.copy()
            occluded[y:y + OCCLUSION_PATCH, x:x + OCCLUSION_PATCH] = IMAGENET_MEAN  # neutral grey
            positions.append((y, x))
            images.append(occluded)
    return positions, images


def occlusion_map(positions: list[tuple[int, int]], probs: np.ndarray, baseline: float,
                  class_index: int) -> np.ndarray:
    """Return a (224, 224) map in [0, 1] of confidence drop when each area is hidden."""
    drop = np.zeros((MODEL_SIZE, MODEL_SIZE), dtype=np.float32)
    count = np.zeros_like(drop)
    for (y, x), p in zip(positions, probs, strict=True):
        drop[y:y + OCCLUSION_PATCH, x:x + OCCLUSION_PATCH] += max(0.0, baseline - float(p[class_index]))
        count[y:y + OCCLUSION_PATCH, x:x + OCCLUSION_PATCH] += 1
    drop /= np.maximum(count, 1)
    peak = float(drop.max())
    return drop / peak if peak > 0 else drop


def grid_inputs(original: Image.Image) -> tuple[list[tuple[int, int, tuple[float, float, float, float]]],
                                                list[np.ndarray]]:
    w, h = original.size
    cell_w, cell_h = w / GRID_SIZE, h / GRID_SIZE
    pad_w, pad_h = cell_w * GRID_OVERLAP, cell_h * GRID_OVERLAP
    cells, images = [], []
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            left = max(0.0, col * cell_w - pad_w)
            top = max(0.0, row * cell_h - pad_h)
            right = min(float(w), (col + 1) * cell_w + pad_w)
            bottom = min(float(h), (row + 1) * cell_h + pad_h)
            crop = original.crop((int(left), int(top), int(right), int(bottom)))
            crop = crop.resize((MODEL_SIZE, MODEL_SIZE), Image.Resampling.BICUBIC)
            images.append(np.asarray(crop, dtype=np.float32) / 255.0)
            cells.append((row, col, (left / w, top / h, (right - left) / w, (bottom - top) / h)))
    return cells, images
