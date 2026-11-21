"""Cheap photo-quality checks run before trusting a diagnosis.

All measurements come from the uploaded pixels:
  * sharpness    - variance of the Laplacian (low = blurry)
  * brightness   - mean luminance (too dark / overexposed)
  * leaf coverage - share of pixels with plant-like colour (green, yellow or brown tissue)
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from PIL import Image

ANALYSIS_SIZE = 256

# Thresholds were calibrated on PlantVillage photos versus blurred / dark / non-leaf images.
MIN_SHARPNESS = 5.0
MAX_SHARPNESS = 30_000.0  # pixel-level noise, not a camera photo
MIN_BRIGHTNESS = 0.18
MAX_BRIGHTNESS = 0.88
MIN_LEAF_COVERAGE = 0.08


@dataclass
class QualityReport:
    sharpness: float
    brightness: float
    leaf_coverage: float
    issues: list[dict[str, str]] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.issues


def _laplacian_variance(gray: np.ndarray) -> float:
    lap = (-4 * gray[1:-1, 1:-1] + gray[:-2, 1:-1] + gray[2:, 1:-1]
           + gray[1:-1, :-2] + gray[1:-1, 2:])
    return float(lap.var())


def plant_mask(rgb: np.ndarray) -> np.ndarray:
    """Boolean mask of pixels that look like plant tissue (healthy or diseased)."""
    hsv = np.asarray(Image.fromarray((rgb * 255).astype(np.uint8)).convert("HSV"),
                     dtype=np.float32) / 255.0
    hue, sat, val = hsv[..., 0] * 360.0, hsv[..., 1], hsv[..., 2]
    green_yellow = (hue >= 35) & (hue <= 170) & (sat >= 0.18) & (val >= 0.15)
    brown = (hue >= 10) & (hue < 35) & (sat >= 0.25) & (val >= 0.12) & (val <= 0.85)
    return green_yellow | brown


def assess(display: Image.Image) -> QualityReport:
    small = display.copy()
    small.thumbnail((ANALYSIS_SIZE, ANALYSIS_SIZE))
    rgb = np.asarray(small, dtype=np.float32) / 255.0
    gray = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32) * 255.0

    report = QualityReport(
        sharpness=round(_laplacian_variance(gray), 1),
        brightness=round(float(gray.mean() / 255.0), 3),
        leaf_coverage=round(float(plant_mask(rgb).mean()), 3),
    )
    no_leaf = report.leaf_coverage < MIN_LEAF_COVERAGE
    if report.sharpness < MIN_SHARPNESS and not no_leaf:
        report.issues.append({"code": "blurry",
                              "message": "The photo looks blurry. Hold the phone steady and tap to focus."})
    elif report.sharpness > MAX_SHARPNESS:
        report.issues.append({"code": "noisy",
                              "message": "The image looks like noise rather than a camera photo."})
    if report.brightness < MIN_BRIGHTNESS:
        report.issues.append({"code": "too_dark",
                              "message": "The photo is too dark. Take it in daylight or move into the light."})
    elif report.brightness > MAX_BRIGHTNESS:
        report.issues.append({"code": "overexposed",
                              "message": "The photo is overexposed. Avoid direct glare on the leaf."})
    if no_leaf:
        report.issues.append({"code": "no_leaf",
                              "message": "No clear leaf was found. Fill the frame with a single leaf."})
    return report
