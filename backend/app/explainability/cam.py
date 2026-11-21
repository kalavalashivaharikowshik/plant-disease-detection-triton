"""Class Activation Maps: where in the photo the model found evidence for a class.

For a network ending in GlobalAveragePool -> Linear, the class score is a weighted sum
of the averaged feature channels. Re-weighting the *spatial* feature map with the same
class weights shows which locations contributed (Zhou et al., 2016, "Learning Deep
Features for Discriminative Localization").
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from ..imaging.quality import plant_mask
from .render import overlay, resize_heat, to_data_url

GRID = 56  # resolution used for region detection


@dataclass(frozen=True)
class Region:
    x: float  # normalised [0, 1] bounding box
    y: float
    width: float
    height: float
    score: float  # mean heat inside the region
    area: float  # share of the image


class ClassifierHead:
    def __init__(self, path: Path) -> None:
        data = np.load(path)
        self.weight = data["weight"].astype(np.float32)  # (num_classes, channels)

    def cam(self, features: np.ndarray, class_index: int) -> np.ndarray:
        """features: (C, H, W) -> heat map (H, W) in [0, 1]."""
        heat = np.tensordot(self.weight[class_index], features, axes=1)
        heat = np.maximum(heat, 0)
        peak = float(heat.max())
        return heat / peak if peak > 0 else heat


def heatmap_image(photo: Image.Image, heat: np.ndarray) -> str:
    return to_data_url(overlay(photo, heat))


def _components(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    seen = np.zeros_like(mask, dtype=bool)
    groups: list[list[tuple[int, int]]] = []
    h, w = mask.shape
    for sy, sx in zip(*np.nonzero(mask), strict=True):
        if seen[sy, sx]:
            continue
        queue, group = deque([(sy, sx)]), []
        seen[sy, sx] = True
        while queue:
            y, x = queue.popleft()
            group.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        groups.append(group)
    return groups


def leaf_weighted_heat(heat: np.ndarray, model_rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Upsample heat to GRID and restrict it to plant pixels (ignores background)."""
    grid_heat = resize_heat(heat, (GRID, GRID))
    rgb_small = np.asarray(
        Image.fromarray((model_rgb * 255).astype(np.uint8)).resize((GRID, GRID)), dtype=np.float32
    ) / 255.0
    leaf = plant_mask(rgb_small)
    return grid_heat, leaf


def find_regions(heat: np.ndarray, model_rgb: np.ndarray, threshold: float = 0.5,
                 max_regions: int = 3) -> list[Region]:
    grid_heat, leaf = leaf_weighted_heat(heat, model_rgb)
    mask = (grid_heat >= threshold) & leaf
    regions: list[Region] = []
    for group in _components(mask):
        if len(group) < GRID * GRID * 0.01:  # ignore specks under 1% of the image
            continue
        ys, xs = zip(*group, strict=True)
        y0, y1, x0, x1 = min(ys), max(ys) + 1, min(xs), max(xs) + 1
        regions.append(Region(
            x=round(x0 / GRID, 4), y=round(y0 / GRID, 4),
            width=round((x1 - x0) / GRID, 4), height=round((y1 - y0) / GRID, 4),
            score=round(float(np.mean([grid_heat[p] for p in group])), 3),
            area=round(len(group) / (GRID * GRID), 3),
        ))
    regions.sort(key=lambda r: r.score * r.area, reverse=True)
    return regions[:max_regions]


def zoom_on_peak(original: Image.Image, heat: np.ndarray, model_rgb: np.ndarray,
                 fraction: float = 0.4, out_size: int = 360) -> str:
    """Crop the most suspicious leaf area from the full-resolution photo."""
    grid_heat, leaf = leaf_weighted_heat(heat, model_rgb)
    weighted = grid_heat * np.where(leaf, 1.0, 0.25)
    cy, cx = np.unravel_index(int(np.argmax(weighted)), weighted.shape)
    w, h = original.size
    side = int(min(w, h) * fraction)
    centre_x, centre_y = (cx + 0.5) / GRID * w, (cy + 0.5) / GRID * h
    left = int(np.clip(centre_x - side / 2, 0, w - side))
    top = int(np.clip(centre_y - side / 2, 0, h - side))
    crop = original.crop((left, top, left + side, top + side))
    crop = crop.resize((out_size, out_size), Image.Resampling.LANCZOS)
    return to_data_url(crop, quality=90)
