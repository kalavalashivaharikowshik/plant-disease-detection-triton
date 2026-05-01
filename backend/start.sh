#!/bin/bash

echo "🚀 Starting Plant Disease Detection Backend..."

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Check required files
echo "🔍 Checking required files..."

if [ ! -f "labels.json" ]; then
    echo "❌ labels.json not found"
    exit 1
fi

echo "✅ Required files found"

# Start FastAPI
echo "🎯 Starting FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8005 --workers 1