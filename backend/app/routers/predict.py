from fastapi import APIRouter, HTTPException, UploadFile, File
from slowapi import Limiter
from slowapi.util import get_remote_address
import numpy as np
import requests
import json
from PIL import Image
import io
from datetime import datetime
from app.security import response_cache

from ..models import PredictionResponse
from ..config import settings
from ..config_manager import config_manager
from ..llm_service import generate_explanation

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

import os

TRITON_URL = os.getenv(
    "TRITON_URL",
    "http://triton:8000/v2/models/plant_model/infer"
)

# Load labels
with open("labels.json", "r") as f:
    labels = json.load(f)


# ================= VALIDATION =================
def validate_image_file(file: UploadFile) -> None:
    if hasattr(file, 'size') and file.size > settings.max_image_size_bytes:
        raise HTTPException(status_code=413, detail="File too large")

    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type")


# ================= PREPROCESS =================
def preprocess_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize((224, 224))

    img = np.array(image).astype(np.float32) / 255.0

    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])

    img = (img - mean) / std
    img = np.transpose(img, (2, 0, 1))
    img = np.expand_dims(img, axis=0)

    return img


# ================= PREDICT =================
@router.post("/predict", response_model=PredictionResponse)
async def predict_disease(image: UploadFile = File(...)):
    import time

    try:
        start_time = time.time()

        # Validate file
        validate_image_file(image)

        # Read image
        image_bytes = await image.read()

        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        # Preprocess
        input_tensor = preprocess_image(image_bytes)

        # Triton request
        payload = {
            "inputs": [{
                "name": "input",
                "shape": list(input_tensor.shape),
                "datatype": "FP32",
                "data": input_tensor.tolist()
            }]
        }

        response = requests.post(TRITON_URL, json=payload)

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Triton inference failed")

        result = response.json()

        output = np.array(result["outputs"][0]["data"])

        # ✅ Softmax
        exp_output = np.exp(output - np.max(output))
        probs = exp_output / exp_output.sum()

        predicted_class = int(np.argmax(probs))
        confidence = float(np.max(probs))

        inference_time = (time.time() - start_time) * 1000

        class_id = labels[predicted_class]

        # 🔥 Normalize and match with config_manager
        class_id_clean = class_id.strip().lower().replace(" ", "_")

        matched_class = None

        for key in config_manager.disease_classes.keys():
            key_clean = key.strip().lower().replace(" ", "_")

            if key_clean == class_id_clean:
                matched_class = key
                break

        if not matched_class:
            raise HTTPException(
                status_code=500,
                detail=f"Class not found in config: {class_id}"
            )

        disease_class = config_manager.get_class_by_id(matched_class)
        severity_info = config_manager.get_severity_for_class(matched_class)

        prediction_item = {
            "label": class_id,   # 🔥 ADD THIS (IMPORTANT)
            "class_name": disease_class.name,
            "plant": disease_class.plant,
            "disease": disease_class.disease,
            "confidence": confidence,
            "severity": disease_class.severity,

            "severity_level": (
                severity_info.level
                if severity_info and severity_info.level is not None
                else {
                    "low": 0,
                    "moderate": 1,
                    "high": 2,
                    "severe": 3
                }.get(disease_class.severity.lower(), 0)
            ),

            "severity_color": severity_info.color if severity_info else "#10B981",
            "treatment": {
                "chemical": disease_class.treatment.chemical,
                "cultural": disease_class.treatment.cultural,
                "preventive": disease_class.treatment.preventive,
            },

            "symptoms": disease_class.symptoms,
            "causes": disease_class.causes,
            "urgency": disease_class.urgency,
            "economic_impact": disease_class.economic_impact,
            }
        cache_key = f"{disease_class.plant}_{disease_class.disease}"

        cached = await response_cache.get(cache_key)

        if cached:
            llm_explanation = cached["llm_explanation"]

        else:
            try:
                llm_explanation = generate_explanation({
                    "plant": disease_class.plant,
                    "disease": disease_class.disease,
                    "severity": disease_class.severity,
                    "symptoms": disease_class.symptoms,
                    "causes": disease_class.causes,
                    "treatment": {
                        "chemical": disease_class.treatment.chemical,
                        "cultural": disease_class.treatment.cultural,
                        "preventive": disease_class.treatment.preventive,
                    }
                })

                # 🔥 SAVE TO REDIS
                await response_cache.set(
                    cache_key,
                    {"llm_explanation": llm_explanation}
                )

            except Exception as e:
                print(f"LLM error: {e}")
                llm_explanation = "Explanation not available"

        return PredictionResponse(
            predictions=[prediction_item],
            top_prediction=prediction_item,
            confidence_level=config_manager.get_confidence_level(confidence),
            model_info={
                "name": config_manager.model_config.name,
                "framework": config_manager.model_config.framework
            },
            inference_ms=int(inference_time),
            timestamp=datetime.utcnow().isoformat(),
            llm_explanation=llm_explanation   # 🔥 ADD THIS
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))