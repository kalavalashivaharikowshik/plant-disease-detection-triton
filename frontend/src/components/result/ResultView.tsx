import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { usePreferences } from "@/lib/preferences";
import type { AnalysisResult, RefineResult } from "@/lib/types";
import { ActionPlan } from "./ActionPlan";
import { ComparePanel } from "./ComparePanel";
import { ExplanationPanel } from "./ExplanationPanel";
import { HeatmapCompare, ZoomPanel } from "./HeatmapCompare";
import { NoticeList } from "./NoticeList";
import { ReliabilityPanel } from "./ReliabilityPanel";
import { ResultHeader } from "./ResultHeader";
import { SharePanel } from "./SharePanel";
import { TechPanel } from "./TechPanel";
import { TopPredictions } from "./TopPredictions";
import { TreatmentPanel } from "./TreatmentPanel";

interface Props {
  result: AnalysisResult;
  file: File | null;
  onReset: () => void;
}

export function ResultView({ result: original, file, onReset }: Props) {
  const { techMode } = usePreferences();
  const [refined, setRefined] = useState<RefineResult | null>(null);
  const online = !original.meta.engine.startsWith("browser");

  // Follow-up answers can change the diagnosis; visuals and checks stay from the photo.
  const result: AnalysisResult = useMemo(() => {
    if (!refined) return original;
    const p = refined.prediction;
    return {
      ...original,
      prediction: p,
      knowledge: refined.knowledge,
      top_k: refined.ranked,
      confidence_level: p.confidence >= 0.9 ? "high" : p.confidence >= 0.7 ? "medium" : p.confidence >= 0.5 ? "low" : "uncertain",
      warnings: [
        ...original.warnings.filter((w) => !["low_confidence", "ambiguous"].includes(w.code)),
        { code: "refined", severity: "info", message: "Updated using your answers to the follow-up question." },
      ],
    };
  }, [original, refined]);

  const { prediction, knowledge } = result;
  const alternatives = result.top_k.filter((s) => s.class_id !== prediction.class_id).slice(0, 2);

  return (
    <article className="space-y-10" aria-label="Diagnosis result">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Checked {formatDate(result.created_at)}</p>
        <button className="btn-quiet" onClick={onReset}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Check another leaf
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <HeatmapCompare visuals={result.visuals} healthy={prediction.healthy} />
          {result.visuals.zoom && !prediction.healthy && (
            <div className="grid gap-4 sm:grid-cols-2">
              <ZoomPanel zoom={result.visuals.zoom} />
              <div className="space-y-2 text-sm">
                <h3 className="font-display text-lg font-bold">What to look for</h3>
                <p>{knowledge.key_sign}</p>
                <ul className="list-disc space-y-1 pl-5">
                  {knowledge.symptoms.slice(0, 3).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-8 lg:col-span-5">
          <ResultHeader result={result} />
          <NoticeList notices={result.warnings} />
          <ReliabilityPanel result={result} />
          <TopPredictions scores={result.top_k} selected={prediction.class_id} />
        </div>
      </div>

      {original.comparison && original.comparison.candidates.length > 1 && (
        <ComparePanel
          comparison={original.comparison}
          evidence={original.visuals.evidence}
          candidates={original.top_k}
          onRefined={setRefined}
        />
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <ActionPlan plan={knowledge.action_plan} title={prediction.display_name} scanId={`${result.id}:${prediction.class_id}`} />
        <ExplanationPanel
          classId={prediction.class_id}
          confidence={prediction.confidence}
          alternatives={alternatives}
          file={file}
          fallback={refined ? { ...original.explanation, text: knowledge.summary } : original.explanation}
          online={online}
        />
      </div>

      <TreatmentPanel knowledge={knowledge} healthy={prediction.healthy} />
      <SharePanel result={result} file={file} />
      {techMode && <TechPanel result={original} file={file} online={online} />}
    </article>
  );
}
