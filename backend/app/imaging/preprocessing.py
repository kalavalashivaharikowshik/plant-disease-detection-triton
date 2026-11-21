"""Turn an uploaded photo into model input.

The preprocessing must match training: RGB, resized to 224x224, scaled to [0, 1] and
normalised with ImageNet statistics, laid out as NCHW float32.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageOps

MODEL_SIZE = 224
DISPLAY_MAX_SIDE = 640
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


@dataclass
class PreparedImage:
    original: Image.Image  # EXIF-corrected, RGB, full resolution
    display: Image.Image  # EXIF-corrected, RGB, longest side <= DISPLAY_MAX_SIDE
    model_rgb: np.ndarray  # (224, 224, 3) float32 in [0, 1]


def prepare(image: Image.Image) -> PreparedImage:
    # Phone photos store rotation in EXIF; without this, sideways photos are classified sideways.
    image = ImageOps.exif_transpose(image).convert("RGB")
    display = image.copy()
    display.thumbnail((DISPLAY_MAX_SIDE, DISPLAY_MAX_SIDE), Image.Resampling.LANCZOS)
    resized = image.resize((MODEL_SIZE, MODEL_SIZE), Image.Resampling.BICUBIC)
    model_rgb = np.asarray(resized, dtype=np.float32) / 255.0
    return PreparedImage(original=image, display=display, model_rgb=model_rgb)


def to_tensor(rgb: np.ndarray) -> np.ndarray:
    """(H, W, 3) float in [0, 1] -> (3, H, W) normalised float32."""
    normalised = (rgb.astype(np.float32) - IMAGENET_MEAN) / IMAGENET_STD
    return np.ascontiguousarray(normalised.transpose(2, 0, 1), dtype=np.float32)


def to_batch(rgbs: list[np.ndarray]) -> np.ndarray:
    return np.stack([to_tensor(rgb) for rgb in rgbs]).astype(np.float32)


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - logits.max(axis=-1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=-1, keepdims=True)
