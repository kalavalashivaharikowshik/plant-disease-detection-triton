# Production frontend: static build served by nginx, proxying /api to the backend.
# Build from the repository root:  docker build -f frontend/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /repo
COPY model_repository/plant_model/1/model.onnx model_repository/plant_model/1/model.onnx
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
