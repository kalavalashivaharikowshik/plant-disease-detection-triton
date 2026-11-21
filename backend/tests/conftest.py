import os
from pathlib import Path

# Must be set before the app (and its rate limiter) is imported.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("INFERENCE_BACKEND", "onnx")
os.environ.setdefault("EXPLANATION_PROVIDER", "static")
os.environ.setdefault("REDIS_URL", "")
os.environ.setdefault("GEMINI_API_KEY", "")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"

# fixture file -> expected class id
LABELLED = {
    "tomato_late_blight.jpg": "Tomato___Late_blight",
    "apple_black_rot.jpg": "Apple___Black_rot",
    "corn_common_rust.jpg": "Corn_(maize)___Common_rust_",
    "grape_healthy.jpg": "Grape___healthy",
    "potato_early_blight.jpg": "Potato___Early_blight",
    "squash_powdery_mildew.jpg": "Squash___Powdery_mildew",
}


@pytest.fixture(scope="session")
def settings() -> Settings:
    return Settings(static_dir=Path("/nonexistent"))


@pytest.fixture(scope="session")
def client(settings):
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def leaf_bytes() -> bytes:
    return (FIXTURES / "apple_black_rot.jpg").read_bytes()
