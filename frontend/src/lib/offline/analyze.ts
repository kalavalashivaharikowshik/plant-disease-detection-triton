// Builds a full AnalysisResult on the device so the result screen works the same offline.
import type { AnalysisResult, ClassScore, Notice } from "../types";
import { cam, drawHeat, flip, loadDeviceEngine, mirror, runDevice, toInput, topK } from "./engine";

const THRESHOLD = 0.7;

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

function toDataUrl(img: HTMLImageElement, maxSide = 640, heat?: Float32Array): string {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (heat) drawHeat(ctx, heat, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export async function analyzeOnDevice(file: File, onProgress?: (fraction: number) => void): Promise<AnalysisResult> {
  const start = performance.now();
  const engine = await loadDeviceEngine(onProgress);
  const img = await loadImage(file);
  const prepStart = performance.now();
  const inputs = [toInput(img), toInput(img, mirror), toInput(img, flip)];
  const preprocessMs = Math.round(performance.now() - prepStart);
  const out = await runDevice(engine, inputs);

  const main = out.probs[0];
  const ranked = topK(engine, main, engine.knowledge.labels.length);
  const top = ranked[0];
  const topIndex = engine.knowledge.labels.indexOf(top.class_id);
  const info = engine.knowledge.diseases[top.class_id];
  const risk = engine.knowledge.risk_levels[info.risk];
  const names = ["original", "mirrored", "flipped"];
  const variants = out.probs.map((p, i) => {
    const best = topK(engine, p, 1)[0];
    return { name: names[i], class_id: best.class_id, confidence: best.confidence, agrees: best.class_id === top.class_id };
  });
  const agreement = variants.filter((v) => v.agrees).length;

  const visStart = performance.now();
  const heat = out.features ? cam(engine, out.features, topIndex) : undefined;
  const image = toDataUrl(img);
  const heatmap = heat ? toDataUrl(img, 640, heat) : null;
  const visualsMs = Math.round(performance.now() - visStart);

  const ambiguous = top.confidence - ranked[1].confidence < 0.25 || top.confidence < THRESHOLD;
  const warnings: Notice[] = [
    {
      code: "on_device",
      severity: "info",
      message: "Checked on this device. Photo quality checks and AI explanations need a connection.",
    },
  ];
  if (top.confidence < THRESHOLD)
    warnings.push({
      code: "low_confidence",
      severity: "danger",
      message: `The AI is only ${Math.round(top.confidence * 100)}% sure. Retake the photo or confirm with an expert before treating.`,
    });
  if (agreement < variants.length)
    warnings.push({
      code: "unstable",
      severity: "warning",
      message: `The answer changed in ${variants.length - agreement} of ${variants.length} slightly altered copies of the photo.`,
    });

  const candidates = (ranked.slice(0, 2) as ClassScore[]).map((c) => {
    const d = engine.knowledge.diseases[c.class_id];
    return { ...c, key_sign: d.key_sign, symptoms: d.symptoms };
  });
  const steps = [...info.action_plan.today, ...info.action_plan.this_week];

  return {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    created_at: new Date().toISOString(),
    prediction: { ...top, risk },
    top_k: ranked.slice(0, 3),
    confidence_level: top.confidence >= 0.9 ? "high" : top.confidence >= 0.7 ? "medium" : top.confidence >= 0.5 ? "low" : "uncertain",
    reliable: top.confidence >= THRESHOLD && agreement === variants.length,
    warnings,
    quality: { sharpness: 0, brightness: 0, leaf_coverage: 0, ok: true, issues: [] },
    stability: {
      agreement,
      total: variants.length,
      stable: agreement === variants.length,
      mean_confidence: out.probs.reduce((s, p) => s + p[topIndex], 0) / out.probs.length,
      variants,
    },
    visuals: { image, heatmap, zoom: null, regions: [], evidence: [] },
    knowledge: {
      summary: info.summary,
      pathogen: info.pathogen,
      pathogen_type: info.pathogen_type,
      symptoms: info.symptoms,
      key_sign: info.key_sign,
      favourable_conditions: info.favourable_conditions,
      spread: info.spread,
      action_plan: info.action_plan,
      treatment: info.treatment,
      prevention: info.prevention,
      sources: info.sources,
    },
    comparison: ambiguous ? { candidates, question: null } : null,
    explanation: {
      text: `1. What is happening\n${info.summary}\n\n2. What to do now\n${steps.map((s) => `- ${s}`).join("\n")}`,
      provider: "device",
      language: "en",
      photo_aware: false,
      translated: true,
      cached: false,
    },
    meta: {
      engine: "browser (ONNX Runtime Web)",
      model_version: "efficientnet-b0-plantvillage-38@1",
      timings: {
        preprocess_ms: preprocessMs,
        inference_ms: out.elapsedMs,
        visuals_ms: visualsMs,
        total_ms: Math.round(performance.now() - start),
      },
      all_scores: ranked,
    },
  };
}
