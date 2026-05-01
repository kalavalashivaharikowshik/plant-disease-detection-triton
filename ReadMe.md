# 🌿 Plant Disease Detection System (Triton + LLM + Docker)

A production-ready, end-to-end AI system for detecting plant diseases
from leaf images using deep learning, GPU-accelerated inference, and
Generative AI explanations.

------------------------------------------------------------------------

## ✨ Features

-   🎯 AI-powered plant disease detection (30+ classes)
-   ⚡ GPU-accelerated inference using NVIDIA Triton Inference Server
-   🤖 LLM-based explanation using Ollama (Llama3)
-   ⚡ Redis caching for faster responses
-   🖼️ Drag-and-drop image upload UI
-   🌐 Modern React + TypeScript frontend
-   🚀 FastAPI backend with async support
-   🐳 Fully Dockerized microservices architecture

------------------------------------------------------------------------

## 🏗️ Project Architecture

    Frontend (React)
          ↓
    FastAPI Backend
          ↓
    Triton Inference Server (GPU - ONNX Model)
          ↓
    Prediction Output
          ↓
    Redis Cache ───► (Cache Hit → Return Fast)
          ↓
    Ollama (Llama3 LLM)
          ↓
    Final Response (Prediction + Explanation)

------------------------------------------------------------------------

## 🏗️ Project Structure

Plant-Disease-Detection-main/
├── backend/
│   ├── app/
│   │   ├── adapters/
│   │   ├── routers/
│   │   ├── llm_service.py
│   │   ├── model_service.py
│   │   ├── config.py
│   │   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── Dockerfile
│
├── model_repository/
│   └── plant_model/
│       ├── config.pbtxt
│       └── 1/
│           └── model.onnx
│
├── docker-compose.yml
└── README.md

------------------------------------------------------------------------

## 🎯 Supported Crops & Diseases

Supports crops like Apple, Corn, Grape, Potato, Tomato, Mango, Citrus,
Rice with 30+ disease classes.

------------------------------------------------------------------------

## 🛠️ Tech Stack

Frontend: React, TypeScript, Vite\
Backend: FastAPI, Python\
AI/ML: EfficientNet-B0, ONNX, Triton\
LLM: Ollama (Llama3)\
Other: Redis, Docker

------------------------------------------------------------------------

## 🐳 Deployment Architecture

Services: - FastAPI backend - React frontend - Triton Inference Server
(GPU) - Ollama (LLM) - Redis (cache)

------------------------------------------------------------------------

## 🚀 Quick Start

docker compose up --build

------------------------------------------------------------------------

## 🌐 Access

Frontend: http://localhost:3000\
Backend: http://localhost:8005\
Docs: http://localhost:8005/docs

------------------------------------------------------------------------

## 🔄 Workflow

1.  Upload image\
2.  Backend preprocessing\
3.  Triton inference\
4.  Redis cache check\
5.  LLM explanation via Ollama\
6.  Results displayed

------------------------------------------------------------------------

## 🤖 Model Details

Dataset: New Plant Diseases Dataset (\>500MB)\
Model: EfficientNet-B0\
Format: ONNX\
Inference: Triton GPU

------------------------------------------------------------------------

## ⚡ Performance

-   Fast GPU inference\
-   Reduced latency via Redis\
-   Scalable system

------------------------------------------------------------------------

## 🔐 Security

-   Input validation\
-   Rate limiting\
-   CORS protection

------------------------------------------------------------------------

## ⚠️ Limitations

-   GPU recommended\
-   LLM output may vary

------------------------------------------------------------------------

## 🚀 Future Work

-   Cloud deployment\
-   Mobile app\
-   Multi-language support

------------------------------------------------------------------------

## 🎯 Conclusion

This project demonstrates a complete AI system integrating ML, Triton
GPU inference, LLM explanations, and Docker-based deployment.
