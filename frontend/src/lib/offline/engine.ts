// On-device inference with ONNX Runtime Web: the same model the server uses, running in the browser.
// Used for offline mode and the live camera. Model, weights and knowledge are kept in Cache Storage
// after the first download so the app keeps working without a connection.
import type { InferenceSession, Tensor } from "onnxruntime-web";
import { api } from "../api";
import type { ClassScore, KnowledgeExport } from "../types";

const MODEL_URL = "/model/plant_model.onnx";
const HEAD_URL = "/model/classifier_head.bin";
const CACHE_NAME = "leafscan-device-v1";
const KNOWLEDGE_KEY = "leafscan.knowledge.v1";
const SIZE = 224;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const CHANNELS = 1280;
const GRID = 7;

export interface DeviceEngine {
  session: InferenceSession;
  head: Float32Array;
  knowledge: KnowledgeExport;
  ort: typeof import("onnxruntime-web/wasm");
}

export interface DeviceOutput {
  probs: Float32Array[]; // one row per input
  features: Float32Array | null; // features of input 0, (1280, 7, 7)
  elapsedMs: number;
}

let enginePromise: Promise<DeviceEngine> | null = null;

async function cachedBytes(url: string, onProgress?: (fraction: number) => void): Promise<ArrayBuffer> {
  const cache = "caches" in window ? await caches.open(CACHE_NAME) : null;
  const hit = cache ? await cache.match(url) : undefined;
  if (hit) return hit.arrayBuffer();

  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Could not download ${url} (${response.status})`);
  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress?.(received / total);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  await cache?.put(url, new Response(bytes, { headers: { "Content-Type": "application/octet-stream" } }));
  return bytes.buffer;
}

async function loadKnowledge(): Promise<KnowledgeExport> {
  try {
    const fresh = await api.knowledge();
    try {
      localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(fresh));
    } catch {
      /* quota */
    }
    return fresh;
  } catch (error) {
    const stored = localStorage.getItem(KNOWLEDGE_KEY);
    if (stored) return JSON.parse(stored) as KnowledgeExport;
    throw error;
  }
}

export function isDeviceEngineCached(): Promise<boolean> {
  if (!("caches" in window)) return Promise.resolve(false);
  return caches
    .open(CACHE_NAME)
    .then((c) => c.match(MODEL_URL))
    .then((r) => Boolean(r) && localStorage.getItem(KNOWLEDGE_KEY) !== null);
}

export function loadDeviceEngine(onProgress?: (fraction: number) => void): Promise<DeviceEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const ort = await import("onnxruntime-web/wasm");
      ort.env.wasm.numThreads = 1; // threads need cross-origin isolation, which static hosts rarely set
      const [modelBytes, headBytes, knowledge] = await Promise.all([
        cachedBytes(MODEL_URL, onProgress),
        cachedBytes(HEAD_URL),
        loadKnowledge(),
      ]);
      const session = await ort.InferenceSession.create(modelBytes, { executionProviders: ["wasm"] });
      return { session, head: new Float32Array(headBytes), knowledge, ort };
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

/** Draw any image source onto a 224x224 canvas (stretched, matching the server) and normalise. */
export function toInput(source: CanvasImageSource, transform?: (ctx: CanvasRenderingContext2D) => void): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available");
  transform?.(ctx);
  ctx.drawImage(source, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const out = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * SIZE * SIZE + i] = (data[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return out;
}

export const mirror = (ctx: CanvasRenderingContext2D) => {
  ctx.translate(SIZE, 0);
  ctx.scale(-1, 1);
};
export const flip = (ctx: CanvasRenderingContext2D) => {
  ctx.translate(0, SIZE);
  ctx.scale(1, -1);
};

function softmaxRow(logits: Float32Array, offset: number, length: number): Float32Array {
  let max = -Infinity;
  for (let i = 0; i < length; i++) max = Math.max(max, logits[offset + i]);
  const out = new Float32Array(length);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    out[i] = Math.exp(logits[offset + i] - max);
    sum += out[i];
  }
  for (let i = 0; i < length; i++) out[i] /= sum;
  return out;
}

export async function runDevice(engine: DeviceEngine, inputs: Float32Array[]): Promise<DeviceOutput> {
  const start = performance.now();
  const batch = new Float32Array(inputs.length * 3 * SIZE * SIZE);
  inputs.forEach((input, i) => batch.set(input, i * input.length));
  const feeds = { input: new engine.ort.Tensor("float32", batch, [inputs.length, 3, SIZE, SIZE]) };
  const results = await engine.session.run(feeds);
  const logits = (results.output as Tensor).data as Float32Array;
  const classes = logits.length / inputs.length;
  const probs = inputs.map((_, i) => softmaxRow(logits, i * classes, classes));
  const featureTensor = results.features as Tensor | undefined;
  const features = featureTensor
    ? ((featureTensor.data as Float32Array).slice(0, CHANNELS * GRID * GRID) as Float32Array)
    : null;
  return { probs, features, elapsedMs: Math.round(performance.now() - start) };
}

export function topK(engine: DeviceEngine, probs: Float32Array, k = 3): ClassScore[] {
  return Array.from(probs)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p - a.p)
    .slice(0, k)
    .map(({ p, i }) => {
      const info = engine.knowledge.diseases[engine.knowledge.labels[i]];
      return {
        class_id: info.id,
        plant: info.plant,
        disease: info.disease,
        display_name: info.display_name,
        confidence: p,
        healthy: info.healthy,
      };
    });
}

/** Class activation map (7x7, 0..1) for one class, from the feature map and classifier weights. */
export function cam(engine: DeviceEngine, features: Float32Array, classIndex: number): Float32Array {
  const heat = new Float32Array(GRID * GRID);
  const w = engine.head.subarray(classIndex * CHANNELS, (classIndex + 1) * CHANNELS);
  for (let c = 0; c < CHANNELS; c++) {
    const weight = w[c];
    const base = c * GRID * GRID;
    for (let j = 0; j < GRID * GRID; j++) heat[j] += weight * features[base + j];
  }
  let max = 0;
  for (let j = 0; j < heat.length; j++) {
    heat[j] = Math.max(0, heat[j]);
    max = Math.max(max, heat[j]);
  }
  if (max > 0) for (let j = 0; j < heat.length; j++) heat[j] /= max;
  return heat;
}

// Same colour ramp as the server (black -> purple -> red -> orange -> pale yellow).
const STOPS: Array<[number, number, number, number]> = [
  [0, 0, 0, 4],
  [0.25, 87, 16, 110],
  [0.5, 188, 55, 84],
  [0.75, 249, 142, 9],
  [1, 252, 255, 164],
];

function ramp(t: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, r0, g0, b0] = STOPS[i - 1];
      const [t1, r1, g1, b1] = STOPS[i];
      const f = (t - t0) / (t1 - t0);
      return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f];
    }
  }
  return [252, 255, 164];
}

/** Paint a heat map onto a canvas over (or instead of) a photo. */
export function drawHeat(ctx: CanvasRenderingContext2D, heat: Float32Array, width: number, height: number, alpha = 0.6) {
  const small = document.createElement("canvas");
  small.width = GRID;
  small.height = GRID;
  const sctx = small.getContext("2d");
  if (!sctx) return;
  const img = sctx.createImageData(GRID, GRID);
  for (let j = 0; j < heat.length; j++) {
    const [r, g, b] = ramp(heat[j]);
    img.data[j * 4] = r;
    img.data[j * 4 + 1] = g;
    img.data[j * 4 + 2] = b;
    img.data[j * 4 + 3] = Math.round(255 * Math.min(1, heat[j] * 1.3) * alpha);
  }
  sctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, width, height);
}
