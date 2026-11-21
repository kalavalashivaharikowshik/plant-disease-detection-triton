import type {
  AnalysisResult,
  ClassScore,
  ClassesResponse,
  DeepAnalysis,
  Explanation,
  KnowledgeExport,
  ModelInfo,
  ReadyStatus,
  RefineResult,
} from "./types";

// Same-origin by default (the API serves the app in production; Vite proxies /api in dev).
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (API_KEY) headers.set("X-API-Key", API_KEY);
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection, or switch to on-device mode.", 0, "network");
  }
  if (!response.ok) {
    let detail = `The server returned an error (${response.status}).`;
    let code = "error";
    try {
      const body = (await response.json()) as { detail?: string; code?: string };
      detail = body.detail ?? detail;
      code = body.code ?? code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail, response.status, code);
  }
  return (await response.json()) as T;
}

function imageForm(file: Blob, name = "leaf.jpg"): FormData {
  const form = new FormData();
  form.append("image", file, name);
  return form;
}

export const api = {
  analyze: (file: File) =>
    request<AnalysisResult>("/api/predict", { method: "POST", body: imageForm(file, file.name) }),

  deepAnalysis: (file: File) =>
    request<DeepAnalysis>("/api/predict/deep", { method: "POST", body: imageForm(file, file.name) }),

  refine: (candidates: ClassScore[], answers: Record<string, "yes" | "no" | "unsure">) =>
    request<RefineResult>("/api/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidates: candidates.map((c) => ({ class_id: c.class_id, confidence: c.confidence })),
        answers,
      }),
    }),

  explain: (params: {
    classId: string;
    confidence: number;
    language: string;
    alternatives: ClassScore[];
    image?: File | null;
  }) => {
    const form = new FormData();
    form.append("class_id", params.classId);
    form.append("confidence", String(params.confidence));
    form.append("language", params.language);
    form.append(
      "alternatives",
      JSON.stringify(params.alternatives.map((a) => ({ class_id: a.class_id, confidence: a.confidence }))),
    );
    if (params.image) form.append("image", params.image, params.image.name);
    return request<Explanation>("/api/explain", { method: "POST", body: form });
  },

  ready: () => request<ReadyStatus>("/api/ready"),
  classes: () => request<ClassesResponse>("/api/model/classes"),
  modelInfo: () => request<ModelInfo>("/api/model/info"),
  knowledge: () => request<KnowledgeExport>("/api/model/knowledge"),
};
