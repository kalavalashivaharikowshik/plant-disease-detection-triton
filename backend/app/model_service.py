import numpy as np
import requests
import json
from PIL import Image
import io

# Load labels
with open("labels.json", "r") as f:
    labels = json.load(f)

TRITON_URL = "http://localhost:8000/v2/models/plant_model/infer"


def preprocess_image(image_bytes):
    from PIL import Image
    import numpy as np
    import io

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize((224, 224))

    img = np.array(image).astype(np.float32) / 255.0

    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])

    img = (img - mean) / std

    img = np.transpose(img, (2, 0, 1))  # HWC → CHW
    img = np.expand_dims(img, axis=0)   # Add batch

    return img

def predict(image_bytes):
    input_tensor = preprocess_image(image_bytes)

    payload = {
        "inputs": [
            {
                "name": "input",
                "shape": list(input_tensor.shape),
                "datatype": "FP32",
                "data": input_tensor.tolist()
            }
        ]
    }

    response = requests.post(TRITON_URL, json=payload)
    result = response.json()

    output = np.array(result["outputs"][0]["data"])
    predicted_class = np.argmax(output)
    confidence = float(np.max(output))

    return {
        "disease": labels[predicted_class],
        "confidence": confidence
    }