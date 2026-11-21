"""Refine an ambiguous prediction with the user's answers to follow-up questions.

Bayes' rule over the model's candidate classes:
    P(class | answers) ∝ P(class | image) × Π P(answer | class)
The likelihoods come from the curated question bank (knowledge/meta.json).
"""

from __future__ import annotations

from ..knowledge.repository import KnowledgeBase, Question


def select_question(kb: KnowledgeBase, candidates: list[tuple[str, float]],
                    exclude: set[str] | None = None) -> Question | None:
    """Pick the question that best separates the top two candidates."""
    if len(candidates) < 2:
        return None
    exclude = exclude or set()
    (first, _), (second, _) = candidates[0], candidates[1]
    pool = [kb.questions[q] for cid in (first, second) for q in kb.get(cid).questions]
    best, best_gap = None, 0.0
    for question in pool:
        if question.id in exclude:
            continue
        gap = abs(question.likelihood(first, "yes") - question.likelihood(second, "yes"))
        if gap > best_gap:
            best, best_gap = question, gap
    return best if best_gap >= 0.3 else None


def refine(kb: KnowledgeBase, candidates: list[tuple[str, float]],
           answers: dict[str, str]) -> list[tuple[str, float]]:
    """Return candidates re-ranked by posterior probability (normalised over candidates)."""
    scores = []
    for class_id, prior in candidates:
        posterior = max(prior, 1e-6)
        for question_id, answer in answers.items():
            question = kb.questions.get(question_id)
            if question is not None:
                posterior *= question.likelihood(class_id, answer)
        scores.append((class_id, posterior))
    total = sum(score for _, score in scores) or 1.0
    ranked = [(cid, score / total) for cid, score in scores]
    ranked.sort(key=lambda item: item[1], reverse=True)
    return ranked
