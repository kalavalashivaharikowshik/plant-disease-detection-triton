"""Application settings, loaded from environment variables (and an optional .env file)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        protected_namespaces=(),
    )

    # ---------- General ----------
    app_name: str = "Plant Disease Detection API"
    environment: Literal["development", "production", "test"] = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    # Directory with the built frontend. When it exists the API also serves the SPA.
    static_dir: Path = REPO_DIR / "frontend" / "dist"

    # ---------- Inference ----------
    inference_backend: Literal["auto", "onnx", "triton"] = "auto"
    model_path: Path = REPO_DIR / "model_repository" / "plant_model" / "1" / "model.onnx"
    triton_url: str = "http://triton:8000"
    triton_model_name: str = "plant_model"
    triton_timeout_s: float = 10.0
    onnx_threads: int = Field(default=0, ge=0, description="0 lets ONNX Runtime decide")

    # ---------- Reliability ----------
    confidence_threshold: float = Field(default=0.70, ge=0.0, le=1.0)
    ambiguity_margin: float = Field(default=0.25, ge=0.0, le=1.0)
    stability_variants: int = Field(default=6, ge=1, le=6)
    top_k: int = Field(default=3, ge=1, le=10)

    # ---------- Uploads ----------
    max_upload_mb: float = Field(default=8.0, gt=0)
    max_image_pixels: int = 40_000_000  # 40 MP; protects against decompression bombs

    # ---------- Explanations ----------
    explanation_provider: Literal["auto", "gemini", "ollama", "static"] = "auto"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_timeout_s: float = 30.0
    ollama_url: str = ""
    ollama_model: str = "llama3.2:3b"
    ollama_timeout_s: float = 60.0

    # ---------- Cache ----------
    redis_url: str = ""
    cache_ttl_s: int = 7 * 24 * 3600

    # ---------- Security ----------
    api_key: str = ""
    rate_limit: str = "30/minute"
    rate_limit_enabled: bool = True

    @field_validator("log_level")
    @classmethod
    def _upper_log_level(cls, value: str) -> str:
        value = value.upper()
        if value not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("LOG_LEVEL must be DEBUG, INFO, WARNING, ERROR or CRITICAL")
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return int(self.max_upload_mb * 1024 * 1024)


@lru_cache
def get_settings() -> Settings:
    return Settings()
