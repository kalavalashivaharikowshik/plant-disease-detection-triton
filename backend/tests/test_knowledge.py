from app.knowledge.repository import get_knowledge_base
from app.services.refinement import refine, select_question


def test_every_label_has_complete_entry():
    kb = get_knowledge_base()
    assert len(kb.labels) == 38
    for label in kb.labels:
        info = kb.get(label)
        assert info.summary and info.symptoms and info.key_sign
        assert set(info.action_plan) == {"today", "this_week", "next_two_weeks"}
        assert set(info.treatment) == {"chemical", "organic", "cultural"}
        assert info.sources, f"{label} has no sources"
        assert all(s["url"].startswith("https://") for s in info.sources)
        assert info.healthy == (info.risk == "none")


def test_viruses_have_distinct_entries():
    kb = get_knowledge_base()
    tylcv = kb.get("Tomato___Tomato_Yellow_Leaf_Curl_Virus")
    mosaic = kb.get("Tomato___Tomato_mosaic_virus")
    assert tylcv.display_name != mosaic.display_name


def test_refinement_flips_result_with_strong_evidence():
    kb = get_knowledge_base()
    candidates = [("Tomato___Late_blight", 0.485), ("Tomato___Early_blight", 0.285)]
    question = select_question(kb, candidates)
    assert question is not None
    ranked = refine(kb, candidates, {"target_rings": "yes"})
    assert ranked[0][0] == "Tomato___Early_blight"
    assert abs(sum(p for _, p in ranked) - 1.0) < 1e-9
    unchanged = refine(kb, candidates, {"target_rings": "unsure"})
    assert unchanged[0][0] == "Tomato___Late_blight"


def test_corn_confusion_pair_has_discriminating_question():
    kb = get_knowledge_base()
    candidates = [("Corn_(maize)___Northern_Leaf_Blight", 0.6),
                  ("Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", 0.4)]
    assert select_question(kb, candidates).id in {"cigar_lesions", "rectangular_vein_limited"}
