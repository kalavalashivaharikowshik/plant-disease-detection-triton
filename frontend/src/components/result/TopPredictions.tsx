import { percent } from "@/lib/format";
import type { ClassScore } from "@/lib/types";

export function ScoreBars({ scores, highlight }: { scores: ClassScore[]; highlight?: string }) {
  return (
    <ol className="space-y-2">
      {scores.map((s) => (
        <li key={s.class_id}>
          <div className="flex justify-between gap-3 text-sm">
            <span className={s.class_id === highlight ? "font-bold text-ink" : ""}>{s.display_name}</span>
            <span className="tabular-nums">{percent(s.confidence, 1)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-mist">
            <div
              className={s.class_id === highlight ? "h-full rounded-full bg-ink" : "h-full rounded-full bg-moss/60"}
              style={{ width: `${Math.max(1, s.confidence * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TopPredictions({ scores, selected }: { scores: ClassScore[]; selected: string }) {
  return (
    <section aria-labelledby="top-heading" className="space-y-3">
      <h2 id="top-heading" className="section-title">
        Other possibilities
      </h2>
      <ScoreBars scores={scores} highlight={selected} />
    </section>
  );
}
