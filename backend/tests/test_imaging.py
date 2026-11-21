import io

import numpy as np
import pytest
from PIL import Image, ImageFilter

from app.imaging import quality
from app.imaging.preprocessing import IMAGENET_MEAN, prepare, softmax, to_batch
from app.imaging.validation import ImageValidationError, open_image, sniff_format

from .conftest import FIXTURES

LIMITS = {"max_bytes": 8 * 1024 * 1024, "max_pixels": 40_000_000}


def encode(image: Image.Image, fmt: str = "JPEG") -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, fmt)
    return buffer.getvalue()


def test_sniff_format_detects_real_types():
    rgb = Image.new("RGB", (40, 40), "green")
    assert sniff_format(encode(rgb, "JPEG")) == "jpeg"
    assert sniff_format(encode(rgb, "PNG")) == "png"
    assert sniff_format(encode(rgb, "WEBP")) == "webp"
    assert sniff_format(b"GIF89a....") is None


@pytest.mark.parametrize(("data", "code"), [
    (b"", "empty_file"),
    (b"definitely not an image", "unsupported_format"),
    (b"\xff\xd8\xff" + b"\x00" * 100, "corrupt_image"),
])
def test_open_image_rejects_bad_input(data, code):
    with pytest.raises(ImageValidationError) as exc:
        open_image(data, **LIMITS)
    assert exc.value.code == code
    assert 400 <= exc.value.status_code < 500


def test_open_image_rejects_oversized_resolution():
    data = encode(Image.new("L", (3000, 3000)), "PNG")
    with pytest.raises(ImageValidationError) as exc:
        open_image(data, max_bytes=LIMITS["max_bytes"], max_pixels=1_000_000)
    assert exc.value.code == "image_too_large"


def test_prepare_applies_exif_rotation():
    image = Image.new("RGB", (200, 100), "green")
    exif = image.getexif()
    exif[0x0112] = 6  # orientation: rotate 90° clockwise
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", exif=exif)
    prepared = prepare(open_image(buffer.getvalue(), **LIMITS))
    assert prepared.original.size == (100, 200)


def test_tensor_layout_and_dtype():
    prepared = prepare(Image.open(FIXTURES / "grape_healthy.jpg"))
    batch = to_batch([prepared.model_rgb, prepared.model_rgb])
    assert batch.shape == (2, 3, 224, 224)
    assert batch.dtype == np.float32
    grey = np.full((224, 224, 3), IMAGENET_MEAN, dtype=np.float32)
    assert np.allclose(to_batch([grey]), 0.0, atol=1e-6)


def test_softmax_rows_sum_to_one():
    probs = softmax(np.array([[1.0, 2.0, 3.0], [1000.0, 0.0, -1000.0]]))
    assert np.allclose(probs.sum(axis=1), 1.0)
    assert probs[1, 0] == pytest.approx(1.0)


def test_quality_accepts_real_leaf_and_flags_bad_photos():
    leaf = Image.open(FIXTURES / "potato_early_blight.jpg").convert("RGB")
    assert quality.assess(leaf).ok
    blurred = quality.assess(leaf.filter(ImageFilter.GaussianBlur(4)))
    assert "blurry" in [i["code"] for i in blurred.issues]
    wall = quality.assess(Image.new("RGB", (300, 300), (128, 128, 130)))
    assert "no_leaf" in [i["code"] for i in wall.issues]
