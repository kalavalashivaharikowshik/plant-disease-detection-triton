# Changelog

## 3.0.0

A full rebuild focused on correctness, trustworthy results and deployability.

### Fixed
- AI explanations failed silently (Ollama model never pulled, HTTP errors ignored) and the
  failure text was cached in Redis; failures now fall back to built-in text and are never cached.
- Explanation cache key collided for different diseases (both tomato viruses shared one key).
- Health check called a hardcoded `localhost` Triton, so it always failed in Docker.
- Blocking HTTP calls inside async routes froze the whole server during LLM requests.
- Rate limiting, API-key auth and security headers were defined but never enabled.
- Internal exception text was returned to users; corrupt images returned HTTP 500.
- `labels.json` only loaded when the server was started from `backend/`.
- Phone photos were not rotated using EXIF; tensors were silently float64.
- Website: no plant name in results, wrong severity colours, no low-confidence warning,
  silent upload rejections, blank 404 page, clipped mobile header, floating footer.
- ESLint configuration referenced configs and rules that do not exist.
- The frontend container ran the Vite dev server; Redis, Triton and Ollama were exposed publicly.
- README and About page claimed classes and crops the model does not support.
- The license file was truncated.

### Added
- Hybrid inference: NVIDIA Triton (binary tensor protocol) with automatic ONNX Runtime fallback.
- Heatmaps, outlined regions, auto-zoom, side-by-side evidence maps, occlusion test and patch grid.
- Stability test, photo-quality checks and a reliability flag (99.4% accurate when set).
- Follow-up questions with Bayesian re-ranking for look-alike diseases.
- Curated, sourced knowledge base for all 38 classes with dated action plans.
- Gemini photo-aware explanations in six Indian languages, with read-aloud.
- On-device inference (offline mode), live camera scanning, field survey, history, PDF/WhatsApp sharing.
- Tech mode, evaluation script and published results, 50 automated tests, GitHub Actions CI,
  production Docker images, Docker Compose profiles and a Render blueprint.
