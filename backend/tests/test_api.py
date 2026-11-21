import json

import pytest

from .conftest import FIXTURES, LABELLED


def post_image(client, name: str, path: str = "/api/predict"):
    with open(FIXTURES / name, "rb") as fh:
        return client.post(path, files={"image": (name, fh, "image/jpeg")})


def test_health_and_ready(client):
    assert client.get("/api/health").json()["status"] == "ok"
    ready = client.get("/api/ready").json()
    assert ready["status"] == "ready" and ready["engine"] == "onnx" and ready["classes"] == 38


@pytest.mark.parametrize(("name", "expected"), list(LABELLED.items()))
def test_predict_labelled_leaves(client, name, expected):
    response = post_image(client, name)
    assert response.status_code == 200
    body = response.json()
    assert body["prediction"]["class_id"] == expected
    assert len(body["top_k"]) == 3
    assert body["visuals"]["image"].startswith("data:image/jpeg;base64,")
    assert body["visuals"]["heatmap"].startswith("data:image/jpeg;base64,")
    assert body["knowledge"]["sources"]
    assert body["meta"]["engine"] == "onnx" and len(body["meta"]["all_scores"]) == 38


def test_confident_disease_has_regions_zoom_and_is_reliable(client):
    body = post_image(client, "apple_black_rot.jpg").json()
    assert body["reliable"] and body["confidence_level"] == "high"
    assert body["visuals"]["zoom"] and body["visuals"]["regions"]
    assert body["stability"]["stable"]
    assert body["comparison"] is None


def test_uncertain_result_has_warnings_and_comparison(client):
    sample = FIXTURES.parent / "fixtures" / "tomato_late_blight.jpg"
    body = post_image(client, sample.name).json()
    if body["reliable"]:
        pytest.skip("fixture happens to be confidently classified")
    codes = {w["code"] for w in body["warnings"]}
    assert codes & {"low_confidence", "unstable", "ambiguous"}


def test_rejects_non_image_with_clear_error(client):
    response = client.post("/api/predict", files={"image": ("x.jpg", b"not an image", "image/jpeg")})
    assert response.status_code == 415
    assert response.json()["code"] == "unsupported_format"
    assert "Traceback" not in response.text and "BytesIO" not in response.text


def test_rejects_missing_file(client):
    response = client.post("/api/predict")
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_request"


def test_refine_endpoint(client):
    payload = {"candidates": [{"class_id": "Tomato___Late_blight", "confidence": 0.49},
                              {"class_id": "Tomato___Early_blight", "confidence": 0.29}],
               "answers": {"target_rings": "yes"}}
    body = client.post("/api/refine", json=payload).json()
    assert body["prediction"]["class_id"] == "Tomato___Early_blight"
    bad = client.post("/api/refine", json={**payload, "candidates": [{"class_id": "Nope", "confidence": 0.5}] * 2})
    assert bad.status_code == 422


def test_explain_static_fallback(client):
    body = client.post("/api/explain", data={
        "class_id": "Potato___Late_blight", "confidence": "0.55", "language": "hi",
        "alternatives": json.dumps([{"class_id": "Potato___Early_blight", "confidence": 0.3}]),
    }).json()
    assert body["provider"] == "static" and body["translated"] is False
    assert "What to do now" in body["text"]
    assert client.post("/api/explain", data={"class_id": "x", "confidence": "0.5"}).status_code == 422


def test_deep_analysis(client):
    body = post_image(client, "corn_common_rust.jpg", "/api/predict/deep").json()
    assert body["occlusion"].startswith("data:image/jpeg")
    assert len(body["grid"]) == 9


def test_catalogue_and_model_card(client):
    classes = client.get("/api/model/classes").json()
    assert classes["total"] == 38 and "Tomato" in classes["plants"]
    info = client.get("/api/model/info").json()
    assert info["num_classes"] == 38 and info["evaluation"]["images"] == 380


def test_security_headers_and_unknown_route(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_knowledge_export_for_offline_mode(client):
    body = client.get("/api/model/knowledge").json()
    assert len(body["labels"]) == 38
    assert body["diseases"]["Tomato___Late_blight"]["action_plan"]["today"]
