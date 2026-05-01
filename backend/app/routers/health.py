from datetime import datetime
from fastapi import APIRouter, HTTPException
import requests

from ..models import HealthResponse
from ..config_manager import config_manager

router = APIRouter()

TRITON_HEALTH_URL = "http://localhost:8000/v2/health/ready"


# ================= HEALTH =================
@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check using Triton server."""
    try:
        # 🔥 Check Triton server
        response = requests.get(TRITON_HEALTH_URL)

        if response.status_code != 200:
            raise HTTPException(status_code=503, detail="Triton server unavailable")

        return HealthResponse(
            status="ok",
            model="plant_model (Triton)",
            timestamp=datetime.utcnow().isoformat(),
            model_loaded=True,
            total_classes=len(config_manager.disease_classes)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


# ================= MODEL INFO =================
@router.get("/model/info")
async def get_model_info():
    """Return model metadata (no local model needed)."""
    try:
        return {
            "name": "plant_model",
            "backend": "Triton Inference Server",
            "total_classes": len(config_manager.disease_classes),
            "input_shape": [3, 224, 224],
            "output_classes": len(config_manager.disease_classes),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get model info: {str(e)}")


# ================= CLASSES =================
@router.get("/model/classes")
async def get_model_classes():
    """Get all supported disease classes."""
    try:
        classes_info = []

        for class_id, disease_class in config_manager.disease_classes.items():
            severity_info = config_manager.get_severity_for_class(class_id)

            class_info = {
                "id": disease_class.id,
                "name": disease_class.name,
                "plant": disease_class.plant,
                "disease": disease_class.disease,
                "severity": {
                    "level": disease_class.severity,
                    "numeric_level": severity_info.level if severity_info else 0,
                    "color": severity_info.color if severity_info else "#10B981",
                    "description": severity_info.description if severity_info else "Unknown"
                },
                "treatment": {
                    "chemical": disease_class.treatment.chemical,
                    "cultural": disease_class.treatment.cultural,
                    "preventive": disease_class.treatment.preventive
                }
            }

            classes_info.append(class_info)

        return {
            "classes": classes_info,
            "total_classes": len(classes_info),
            "severity_levels": {
                name: {
                    "level": level.level,
                    "color": level.color,
                    "description": level.description
                }
                for name, level in config_manager.severity_levels.items()
            },
            "treatment_types": {
                name: {
                    "name": treatment_type.name,
                    "description": treatment_type.description
                }
                for name, treatment_type in config_manager.treatment_types.items()
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get classes info: {str(e)}")