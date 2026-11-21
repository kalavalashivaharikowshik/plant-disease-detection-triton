import { BookmarkPlus, Check, FileDown, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { shareText } from "@/lib/format";
import { history, makeThumbnail } from "@/lib/history";
import type { AnalysisResult } from "@/lib/types";

export function SharePanel({ result, file }: { result: AnalysisResult; file: File | null }) {
  const [tag, setTag] = useState(result.prediction.plant);
  const [saved, setSaved] = useState(false);
  const steps = [...result.knowledge.action_plan.today, ...result.knowledge.action_plan.this_week];
  const text = shareText(result.prediction.display_name, result.prediction.plant, result.prediction.confidence, steps);
  const canShareFile = Boolean(file && navigator.canShare?.({ files: [file] }));

  const save = async () => {
    const p = result.prediction;
    history.add({
      id: result.id,
      createdAt: result.created_at,
      plantTag: tag.trim() || p.plant,
      classId: p.class_id,
      displayName: p.display_name,
      plant: p.plant,
      healthy: p.healthy,
      confidence: p.confidence,
      riskLabel: p.risk.label,
      riskColor: p.risk.color,
      thumbnail: await makeThumbnail(result.visuals.image),
    });
    setSaved(true);
  };

  return (
    <section aria-labelledby="share-heading" className="no-print space-y-4 rounded-2xl border border-mist p-5">
      <h2 id="share-heading" className="section-title">
        Keep or share this result
      </h2>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          Plant name, to track it over time
          <input
            value={tag}
            onChange={(e) => {
              setTag(e.target.value);
              setSaved(false);
            }}
            className="w-56 rounded-lg border border-mist bg-sheet px-3 py-2 font-normal"
            placeholder="e.g. Tomato row 3"
          />
        </label>
        <button className="btn-primary" onClick={save} disabled={saved}>
          {saved ? <Check className="h-4 w-4" aria-hidden="true" /> : <BookmarkPlus className="h-4 w-4" aria-hidden="true" />}
          {saved ? "Saved to history" : "Save to history"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-quiet" onClick={() => window.print()}>
          <FileDown className="h-4 w-4" aria-hidden="true" /> Download report (PDF)
        </button>
        <a
          className="btn-quiet"
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> Send on WhatsApp
        </a>
        {canShareFile && file && (
          <button
            className="btn-quiet"
            onClick={() => navigator.share({ title: "LeafScan result", text, files: [file] }).catch(() => undefined)}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" /> Share with photo
          </button>
        )}
      </div>
    </section>
  );
}
