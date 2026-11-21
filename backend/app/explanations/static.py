"""Built-in explanation composed from the curated knowledge entry (always available)."""

from __future__ import annotations

from .base import ExplanationProvider, ExplanationRequest, ExplanationResult


class StaticProvider(ExplanationProvider):
    name = "static"

    async def explain(self, request: ExplanationRequest) -> ExplanationResult:
        d = request.disease
        if d.healthy:
            text = (
                f"1. What is happening\nThis {d.plant.lower()} leaf looks healthy: no spots, powder or "
                f"discolouration were detected.\n\n"
                f"2. Why it matters\nRegular checks catch problems early, when they are cheapest to fix.\n\n"
                f"3. What to do now\n" + "\n".join(f"- {tip}" for tip in d.prevention)
            )
        else:
            steps = d.action_plan["today"] + d.action_plan["this_week"]
            text = (
                f"1. What is happening\n{d.summary}\n\n"
                f"2. Why it happens\nCaused by {d.pathogen} ({d.pathogen_type}). "
                f"{d.favourable_conditions} {d.spread}\n\n"
                f"3. What to do now\n" + "\n".join(f"- {step}" for step in steps)
            )
            if request.confidence < 0.7:
                text += ("\n\nThe AI is not very sure about this result. Retake the photo in daylight "
                         "with a single leaf filling the frame, or confirm with an expert before treating.")
        return ExplanationResult(
            text=text,
            provider=self.name,
            language="en",
            translated=request.language == "en",
        )
