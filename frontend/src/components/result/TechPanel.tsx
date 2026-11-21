import { useMutation } from "@tanstack/react-query";
import { Cpu, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { percent } from "@/lib/format";
import type { AnalysisResult } from "@/lib/types";
import { ScoreBars } from "./TopPredictions";

export function TechPanel({ result, file, online }: { result: AnalysisResult; file: File | null; online: boolean }) {
  const deep = useMutation({ mutationFn: (f: File) => api.deepAnalysis(f) });
  const { meta, stability, quality } = result;

  return (
    <section aria-labelledby="tech-heading" className="no-print space-y-6 rounded-2xl bg-ink p-5 text-paper sm:p-6">
      <div className="flex items-center gap-2">
        <Cpu className="h-5 w-5 text-turmeric" aria-hidden="true" />
        <h2 id="tech-heading" className="font-display text-xl font-bold text-paper">
          Tech mode
        </h2>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        {[
          ["Engine", meta.engine],
          ["Model", meta.model_version],
          ["Inference", `${meta.timings.inference_ms} ms`],
          ["Total", `${meta.timings.total_ms} ms`],
          ["Preprocess", `${meta.timings.preprocess_ms} ms`],
          ["Visuals", `${meta.timings.visuals_ms} ms`],
          ["Sharpness", quality.sharpness ? quality.sharpness.toFixed(0) : "n/a"],
          ["Leaf coverage", quality.leaf_coverage ? percent(quality.leaf_coverage) : "n/a"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-paper/70">{label}</dt>
            <dd className="font-bold break-words">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-paper p-4 text-body">
          <h3 className="mb-3 font-display text-lg font-bold">All {meta.all_scores.length} class scores</h3>
          <div className="max-h-80 overflow-y-auto pr-2">
            <ScoreBars scores={meta.all_scores} highlight={result.prediction.class_id} />
          </div>
        </div>
        <div className="rounded-xl bg-paper p-4 text-body">
          <h3 className="mb-3 font-display text-lg font-bold">Stability variants</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="pb-2">Variant</th>
                <th className="pb-2">Answer</th>
                <th className="pb-2 text-right">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {stability.variants.map((v) => (
                <tr key={v.name} className={v.agrees ? "" : "text-rust"}>
                  <td className="py-1">{v.name}</td>
                  <td className="py-1">{v.class_id.replace("___", ": ").replaceAll("_", " ")}</td>
                  <td className="py-1 text-right tabular-nums">{percent(v.confidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-paper">Deep analysis</h3>
            <p className="text-sm text-paper/80">
              Occlusion test (hide one patch at a time) and a 3×3 patch grid. Experimental: single patches lack context.
            </p>
          </div>
          <button
            className="btn rounded-full bg-turmeric text-ink hover:bg-turmeric-soft"
            disabled={!file || !online || deep.isPending}
            onClick={() => file && deep.mutate(file)}
          >
            {deep.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {deep.isPending ? "Running…" : "Run deep analysis"}
          </button>
        </div>
        {!online && <p className="text-sm text-paper/80">Deep analysis needs the online engine.</p>}
        {deep.isError && <p className="text-sm font-bold text-turmeric">{(deep.error as Error).message}</p>}
        {deep.data && (
          <div className="grid gap-4 sm:grid-cols-2">
            <figure>
              <img src={deep.data.occlusion} alt="Occlusion sensitivity map" className="w-full rounded-lg" />
              <figcaption className="mt-1 text-sm text-paper/80">
                Bright = hiding this area lowers confidence most. Highlights on the background mean the model leans on it.
              </figcaption>
            </figure>
            <figure>
              <div className="relative">
                <img src={result.visuals.image} alt="Patch grid over the leaf" className="w-full rounded-lg" />
                {deep.data.grid.map((cell) => (
                  <div
                    key={`${cell.row}-${cell.col}`}
                    className="absolute flex items-end border border-paper/70 p-1"
                    style={{
                      left: `${(cell.col / 3) * 100}%`,
                      top: `${(cell.row / 3) * 100}%`,
                      width: "33.333%",
                      height: "33.333%",
                      background: cell.healthy ? "rgba(79,122,90,0.35)" : "rgba(178,58,38,0.35)",
                    }}
                  >
                    <span className="rounded bg-ink/80 px-1 text-[0.65rem] leading-tight text-paper">
                      {cell.display_name} {percent(cell.confidence)}
                    </span>
                  </div>
                ))}
              </div>
              <figcaption className="mt-1 text-sm text-paper/80">
                Each square classified on its own (green = healthy, red = disease). Took {deep.data.elapsed_ms} ms.
              </figcaption>
            </figure>
          </div>
        )}
      </div>
    </section>
  );
}
