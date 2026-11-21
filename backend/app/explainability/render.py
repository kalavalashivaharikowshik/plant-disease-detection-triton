"""Image encoding and colour-map helpers for visual outputs."""

from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image

# Perceptual "inferno"-style ramp: black -> purple -> red -> orange -> pale yellow.
_STOPS = np.array([
    [0.00, 0, 0, 4],
    [0.25, 87, 16, 110],
    [0.50, 188, 55, 84],
    [0.75, 249, 142, 9],
    [1.00, 252, 255, 164],
], dtype=np.float32)
_LUT = np.stack([np.interp(np.linspace(0, 1, 256), _STOPS[:, 0], _STOPS[:, i])
                 for i in (1, 2, 3)], axis=-1).astype(np.uint8)


def colorize(heat: np.ndarray) -> np.ndarray:
    """Map a [0, 1] heat array to RGB uint8."""
    return _LUT[np.clip((heat * 255).astype(np.int32), 0, 255)]


def resize_heat(heat: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    """Smoothly upsample a low-resolution heat map to (width, height)."""
    img = Image.fromarray(heat.astype(np.float32), mode="F").resize(size, Image.Resampling.BICUBIC)
    return np.clip(np.asarray(img), 0.0, 1.0)


def overlay(photo: Image.Image, heat_lowres: np.ndarray, strength: float = 0.6) -> Image.Image:
    """Blend a heat map over a photo; cool areas stay close to the original."""
    heat = resize_heat(heat_lowres, photo.size)
    base = np.asarray(photo.convert("RGB"), dtype=np.float32)
    colour = colorize(heat).astype(np.float32)
    alpha = (strength * np.clip(heat * 1.3, 0, 1))[..., None]
    blended = base * (1 - alpha) + colour * alpha
    return Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8))


def to_data_url(image: Image.Image, fmt: str = "JPEG", quality: int = 85) -> str:
    buffer = io.BytesIO()
    params = {"quality": quality, "optimize": True} if fmt == "JPEG" else {"optimize": True}
    image.convert("RGB" if fmt == "JPEG" else "RGBA").save(buffer, fmt, **params)
    mime = "image/jpeg" if fmt == "JPEG" else "image/png"
    return f"data:{mime};base64,{base64.b64encode(buffer.getvalue()).decode()}"
