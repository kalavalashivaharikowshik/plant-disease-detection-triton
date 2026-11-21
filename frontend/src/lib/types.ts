// Mirrors backend/app/schemas.py

export interface ClassScore {
  class_id: string;
  plant: string;
  disease: string;
  display_name: string;
  confidence: number;
  healthy: boolean;
}

export interface Risk {
  key: string;
  label: string;
  level: number;
  color: string;
  description: string;
}

export interface Prediction extends ClassScore {
  risk: Risk;
}

export interface Notice {
  code: string;
  message: string;
  severity: "info" | "warning" | "danger";
}

export interface Quality {
  sharpness: number;
  brightness: number;
  leaf_coverage: number;
  ok: boolean;
  issues: Notice[];
}

export interface StabilityVariant {
  name: string;
  class_id: string;
  confidence: number;
  agrees: boolean;
}

export interface Stability {
  agreement: number;
  total: number;
  stable: boolean;
  mean_confidence: number;
  variants: StabilityVariant[];
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  area: number;
}

export interface Evidence {
  class_id: string;
  display_name: string;
  confidence: number;
  image: string;
}

export interface Visuals {
  image: string;
  heatmap?: string | null;
  zoom?: string | null;
  regions: Region[];
  evidence: Evidence[];
}

export interface Source {
  title: string;
  url: string;
}

export interface ActionPlan {
  today: string[];
  this_week: string[];
  next_two_weeks: string[];
}

export interface Treatment {
  chemical: string[];
  organic: string[];
  cultural: string[];
}

export interface Knowledge {
  summary: string;
  pathogen: string;
  pathogen_type: string;
  symptoms: string[];
  key_sign: string;
  favourable_conditions: string;
  spread: string;
  action_plan: ActionPlan;
  treatment: Treatment;
  prevention: string[];
  sources: Source[];
}

export interface Question {
  id: string;
  text: string;
  help: string;
}

export interface Candidate extends ClassScore {
  key_sign: string;
  symptoms: string[];
}

export interface Comparison {
  candidates: Candidate[];
  question: Question | null;
}

export interface Explanation {
  text: string;
  provider: string;
  language: string;
  model?: string | null;
  photo_aware: boolean;
  translated: boolean;
  cached: boolean;
}

export interface Timings {
  preprocess_ms: number;
  inference_ms: number;
  visuals_ms: number;
  total_ms: number;
}

export interface Meta {
  engine: string;
  model_version: string;
  timings: Timings;
  all_scores: ClassScore[];
}

export type ConfidenceLevel = "high" | "medium" | "low" | "uncertain";

export interface AnalysisResult {
  id: string;
  created_at: string;
  prediction: Prediction;
  top_k: ClassScore[];
  confidence_level: ConfidenceLevel;
  reliable: boolean;
  warnings: Notice[];
  quality: Quality;
  stability: Stability;
  visuals: Visuals;
  knowledge: Knowledge;
  comparison: Comparison | null;
  explanation: Explanation;
  meta: Meta;
}

export interface RefineResult {
  ranked: ClassScore[];
  prediction: Prediction;
  knowledge: Knowledge;
  next_question: Question | null;
}

export interface GridCell {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  class_id: string;
  display_name: string;
  confidence: number;
  healthy: boolean;
}

export interface DeepAnalysis {
  class_id: string;
  occlusion: string;
  grid: GridCell[];
  elapsed_ms: number;
}

export interface ReadyStatus {
  status: "ready" | "degraded";
  version: string;
  engine: string;
  engines: Record<string, boolean>;
  cache: string;
  explanation_provider: string;
  photo_explanations: boolean;
  classes: number;
}

export interface ClassInfo {
  class_id: string;
  plant: string;
  disease: string;
  display_name: string;
  healthy: boolean;
  pathogen: string;
  pathogen_type: string;
  risk: Risk;
}

export interface ClassesResponse {
  total: number;
  plants: string[];
  classes: ClassInfo[];
}

export interface ModelInfo {
  name: string;
  version: string;
  architecture: string;
  input_shape: number[];
  num_classes: number;
  engine: string;
  dataset: string;
  evaluation: Record<string, number | string>;
  languages: Record<string, string>;
}

export interface DiseaseEntry {
  id: string;
  plant: string;
  disease: string;
  display_name: string;
  healthy: boolean;
  pathogen: string;
  pathogen_type: string;
  risk: string;
  summary: string;
  symptoms: string[];
  key_sign: string;
  favourable_conditions: string;
  spread: string;
  action_plan: ActionPlan;
  treatment: Treatment;
  prevention: string[];
  look_alikes: string[];
  questions: string[];
  sources: Source[];
}

export interface KnowledgeExport {
  labels: string[];
  risk_levels: Record<string, Risk>;
  diseases: Record<string, DiseaseEntry>;
}
