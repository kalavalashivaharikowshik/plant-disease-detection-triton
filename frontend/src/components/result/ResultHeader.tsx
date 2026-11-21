import { CheckCircle2, ShieldAlert } from "lucide-react";
import { confidenceWords, pathogenWords, percent } from "@/lib/format";
import type { AnalysisResult } from "@/lib/types";

export function ConfidenceMeter({ value, threshold = 0.7 }: { value: number; threshold?: number }) {
  const low = value < threshold;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-bold text-ink">{confidenceWords(value)}</span>
        <span className="font-display text-lg font-bold text-ink">{percent(value)}</span>
      </div>
      <div
        className="relative mt-1 h-2.5 rounded-full bg-mist"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-label="Confidence"
      >
        <div
          className={low ? "h-full rounded-full bg-rust" : "h-full rounded-full bg-moss"}
          style={{ width: `${Math.max(2, value * 100)}%` }}
        />
        <div
          className="absolute -top-1 h-4.5 w-0.5 bg-ink"
          style={{ left: `${threshold * 100}%`, height: "1.1rem" }}
          title={`Reliability threshold ${percent(threshold)}`}
        />
      </div>
    </div>
  );
}

export function ResultHeader({ result }: { result: AnalysisResult }) {
  const { prediction, knowledge, reliable } = result;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-moss">{prediction.plant}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
          {prediction.healthy ? "Looks healthy" : prediction.disease}
        </h1>
        {!prediction.healthy && (
          <p className="mt-2 text-sm">
            {pathogenWords[knowledge.pathogen_type] ?? knowledge.pathogen_type}: <em>{knowledge.pathogen}</em>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold text-white"
          style={{ backgroundColor: prediction.risk.color }}
          title={prediction.risk.description}
        >
          {prediction.risk.label}
        </span>
        {reliable ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-sm font-bold text-ink">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Reliable result
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-turmeric-soft px-3 py-1 text-sm font-bold text-ink">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Check before treating
          </span>
        )}
      </div>

      <ConfidenceMeter value={prediction.confidence} />
      <p className="max-w-prose">{prediction.risk.description}</p>
    </div>
  );
}
