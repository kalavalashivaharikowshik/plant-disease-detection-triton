import requests

import os

OLLAMA_URL = os.getenv(
    "OLLAMA_URL",
    "http://ollama:11434/api/generate"
)

def generate_explanation(disease_data):
    prompt = f"""
You are an agriculture expert.

Explain this plant disease in simple, practical terms for farmers.

Use the following information as your main source:

Plant: {disease_data['plant']}
Disease: {disease_data['disease']}
Severity: {disease_data['severity']}
Symptoms: {", ".join(disease_data['symptoms'])}
Causes: {disease_data['causes']}

Treatment:
- Chemical: {disease_data['treatment']['chemical']}
- Cultural: {disease_data['treatment']['cultural']}
- Preventive: {disease_data['treatment']['preventive']}

Instructions:
- You may rephrase naturally
- Do NOT contradict the given data
- Do NOT add unrelated facts

Explain in EXACT format:

1. What the disease is  
2. Why it happens  
3. What the farmer should do  

Keep it short, clear, and practical.
"""

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": "llama3",
            "prompt": prompt,
            "stream": False
        },
        timeout=120   # ✅ ADD THIS
    )

    data = response.json()
    return data.get("response", "Explanation not available")    