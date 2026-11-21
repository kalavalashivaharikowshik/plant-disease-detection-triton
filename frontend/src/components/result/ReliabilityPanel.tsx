import { Check, X } from "lucide-react";
import { percent } from "@/lib/format";
import type { AnalysisResult } from "@/lib/types";

function Row({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span
        className={
          ok
            ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-moss text-paper"
            : "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rust text-paper"
        }
      >
        {ok ? <Check className="h-4 w-4" aria-label="Passed" /> : <X className="h-4 w-4" aria-label="Failed" />}
      </span>
      <span>
        <span className="block font-bold text-ink">{title}</span>
        <span className="text-sm">{detail}</span>
      </span>
    </li>
  );
}

export function ReliabilityPanel({ result }: { result: AnalysisResult }) {
  const { prediction, stability, quality, meta } = result;
  const onDevice = meta.engine.startsWith("browser");
  return (
    <section aria-labelledby="reliability-heading" className="space-y-3">
      <h2 id="reliability-heading" className="section-title">
        Can I trust this?
      </h2>
      <ul className="space-y-3">
        <Row
          ok={prediction.confidence >= 0.7}
          title={`Confidence ${percent(prediction.confidence)}`}
          detail={prediction.confidence >= 0.7 ? "Above the 70% reliability line." : "Below 70%. Retake the photo or ask an expert."}
        />
        <Row
          ok={stability.stable}
          title={`Same answer in ${stability.agreement} of ${stability.total} checks`}
          detail="The photo was mirrored, flipped, rotated and re-lit; a reliable result should not change."
        />
        {!onDevice && (
          <Row
            ok={quality.ok}
            title={quality.ok ? "Photo quality is good" : "Photo quality problems"}
            detail={quality.ok ? "Sharp, well lit and a leaf fills the frame." : quality.issues.map((i) => i.message).join(" ")}
          />
        )}
      </ul>
    </section>
  );
}
