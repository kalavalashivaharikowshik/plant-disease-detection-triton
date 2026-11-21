"""Grounded prompt construction for LLM providers.

The model's prediction and the curated knowledge entry are given as the only facts.
The LLM may describe what it sees in the photo and rephrase, but must not invent
treatments, doses or diseases.
"""

from __future__ import annotations

from .base import ExplanationRequest

SYSTEM_INSTRUCTION = (
    "You are an agricultural extension officer explaining a plant disease diagnosis to a farmer. "
    "Use plain, friendly language. Base every recommendation ONLY on the reference notes provided. "
    "Never invent chemical names, doses or extra diseases. If a photo is attached, briefly describe "
    "the visible signs that support or contradict the diagnosis. Remind the farmer to follow the "
    "product label and local agriculture officer for exact doses."
)


def build_prompt(request: ExplanationRequest) -> str:
    d = request.disease
    lines = [
        f"Write the answer in {request.language_name}.",
        "",
        "Diagnosis from the image model:",
        f"- Plant: {d.plant}",
        f"- Result: {d.display_name} ({request.confidence * 100:.0f}% confidence)",
    ]
    if request.alternatives:
        alt = ", ".join(f"{a.display_name} ({p * 100:.0f}%)" for a, p in request.alternatives)
        lines.append(f"- Other possibilities: {alt}")
    lines += [
        "",
        "Reference notes (the only facts you may use):",
        f"- Cause: {d.pathogen} ({d.pathogen_type})",
        f"- Summary: {d.summary}",
        f"- Symptoms: {'; '.join(d.symptoms)}",
        f"- Favourable conditions: {d.favourable_conditions}",
        f"- How it spreads: {d.spread}",
        f"- Do today: {'; '.join(d.action_plan['today'])}",
        f"- This week: {'; '.join(d.action_plan['this_week'])}",
        f"- Chemical options: {'; '.join(d.treatment['chemical']) or 'none'}",
        f"- Organic options: {'; '.join(d.treatment['organic']) or 'none'}",
        f"- Prevention: {'; '.join(d.prevention)}",
        "",
        "Format (use these three short headings, under 180 words in total):",
        "1. What is happening" + (" (mention what you can see in the photo)" if request.image else ""),
        "2. Why it happens",
        "3. What to do now",
    ]
    if request.confidence < 0.7:
        lines.append("The confidence is low: say clearly that the farmer should retake the photo "
                     "or confirm with an expert before spending money on treatment.")
    return "\n".join(lines)
