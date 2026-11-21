"""Validate uploads by their actual bytes, not by the client-supplied content type."""

from __future__ import annotations

import io
import warnings

from PIL import Image, UnidentifiedImageError


class ImageValidationError(ValueError):
    """An upload that cannot be processed. ``status_code`` maps to the HTTP response."""

    def __init__(self, message: str, *, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def sniff_format(data: bytes) -> str | None:
    """Identify JPEG / PNG / WebP from magic bytes."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def open_image(data: bytes, *, max_bytes: int, max_pixels: int) -> Image.Image:
    """Return a fully decoded PIL image or raise ImageValidationError."""
    if not data:
        raise ImageValidationError("The uploaded file is empty.", code="empty_file")
    if len(data) > max_bytes:
        raise ImageValidationError(
            f"Image is larger than {max_bytes // (1024 * 1024)} MB.",
            code="file_too_large", status_code=413,
        )
    if sniff_format(data) is None:
        raise ImageValidationError(
            "Unsupported file. Please upload a JPEG, PNG or WebP photo.",
            code="unsupported_format", status_code=415,
        )
    try:
        image = Image.open(io.BytesIO(data))
        width, height = image.size  # read from the header, before decoding pixels
        if width * height > max_pixels:
            raise ImageValidationError(
                f"Image resolution {width}x{height} is too large.",
                code="image_too_large", status_code=413,
            )
        if min(width, height) < 32:
            raise ImageValidationError("Image is too small to analyse.", code="image_too_small")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image.load()
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombWarning,
            Image.DecompressionBombError, SyntaxError) as exc:
        raise ImageValidationError(
            "The file could not be read as an image. It may be corrupted.",
            code="corrupt_image",
        ) from exc
    return image
