# All-in-one image: FastAPI serves the API *and* the built website from one container.
# This is what Render deploys (see render.yaml). Inference runs on CPU with ONNX Runtime.

# ---------- 1. Build the frontend ----------
FROM node:20-alpine AS frontend
WORKDIR /repo
COPY model_repository/plant_model/1/model.onnx model_repository/plant_model/1/model.onnx
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---------- 2. Python runtime ----------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    ENVIRONMENT=production \
    INFERENCE_BACKEND=onnx \
    MODEL_PATH=/app/model/model.onnx \
    STATIC_DIR=/app/static \
    PORT=8000

WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/app ./app
COPY model_repository/plant_model/1/model.onnx /app/model/model.onnx
COPY --from=frontend /repo/frontend/dist /app/static

RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import os,urllib.request,sys; sys.exit(0 if urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/api/health', timeout=4).status == 200 else 1)"

# Render injects $PORT; one worker keeps memory within small instances (the model uses ~150 MB).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
