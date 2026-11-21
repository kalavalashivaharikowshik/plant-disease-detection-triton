import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { pathogenWords, percent } from "@/lib/format";
import type { ClassInfo } from "@/lib/types";

const PIPELINE = [
  ["Check the photo", "Blur, exposure and whether a leaf fills the frame are measured before the result is trusted."],
  ["Classify", "An EfficientNet-B0 network trained on PlantVillage scores all 38 classes in one pass."],
  ["Stress-test", "The same photo is mirrored, flipped, rotated and re-lit; a reliable answer does not change."],
  ["Explain", "A heatmap from the network's own feature map shows which parts of the leaf drove the answer."],
  ["Advise", "Curated, sourced guidance is attached, and an AI writes a plain-language summary in your language."],
];

export function AboutPage() {
  const info = useQuery({ queryKey: ["model-info"], queryFn: api.modelInfo });
  const ready = useQuery({ queryKey: ["ready"], queryFn: api.ready });
  const classes = useQuery({ queryKey: ["classes"], queryFn: api.classes });

  const byPlant = new Map<string, ClassInfo[]>();
  for (const c of classes.data?.classes ?? []) byPlant.set(c.plant, [...(byPlant.get(c.plant) ?? []), c]);

  return (
    <div className="page space-y-14 py-10">
      <section className="max-w-prose space-y-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">How LeafScan works</h1>
        <p className="text-lg">
          LeafScan is a second opinion for farmers, gardeners and extension workers. It is honest about uncertainty:
          when it is not sure, it says so and helps you check, instead of guessing.
        </p>
      </section>

      <section aria-labelledby="pipeline-heading" className="space-y-4">
        <h2 id="pipeline-heading" className="section-title">
          What happens to your photo
        </h2>
        <ol className="grid gap-6 md:grid-cols-5">
          {PIPELINE.map(([title, text], i) => (
            <li key={title} className="space-y-2 border-t-2 border-ink pt-3">
              <span className="font-display text-2xl font-extrabold text-moss">{i + 1}</span>
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="text-sm">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="model-heading" className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 id="model-heading" className="section-title">
            Model card
          </h2>
          {info.data ? (
            <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="font-bold text-ink">Architecture</dt>
              <dd>{info.data.architecture}</dd>
              <dt className="font-bold text-ink">Classes</dt>
              <dd>{info.data.num_classes}</dd>
              <dt className="font-bold text-ink">Training data</dt>
              <dd>{info.data.dataset}</dd>
              <dt className="font-bold text-ink">Measured accuracy</dt>
              <dd>
                {percent(Number(info.data.evaluation.top1_accuracy), 1)} on {String(info.data.evaluation.images)} images (
                {String(info.data.evaluation.dataset)})
              </dd>
              <dt className="font-bold text-ink">Caveat</dt>
              <dd>{String(info.data.evaluation.note)}</dd>
              <dt className="font-bold text-ink">Version</dt>
              <dd>{info.data.version}</dd>
            </dl>
          ) : (
            <p className="text-sm">{info.isError ? "Model details are unavailable offline." : "Loading…"}</p>
          )}
        </div>
        <div className="space-y-3">
          <h2 className="section-title">Service status</h2>
          {ready.data ? (
            <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="font-bold text-ink">Status</dt>
              <dd>{ready.data.status === "ready" ? "Ready" : "Running with reduced features"}</dd>
              <dt className="font-bold text-ink">Inference</dt>
              <dd>
                {Object.entries(ready.data.engines)
                  .map(([name, ok]) => `${name === "onnx" ? "ONNX Runtime (CPU)" : "NVIDIA Triton"}: ${ok ? "up" : "down"}`)
                  .join(", ")}
              </dd>
              <dt className="font-bold text-ink">Explanations</dt>
              <dd>
                {ready.data.explanation_provider === "static" ? "Built-in summaries" : ready.data.explanation_provider}
                {ready.data.photo_explanations ? ", photo-aware" : ""}
              </dd>
              <dt className="font-bold text-ink">Cache</dt>
              <dd>{ready.data.cache}</dd>
              <dt className="font-bold text-ink">API version</dt>
              <dd>{ready.data.version}</dd>
            </dl>
          ) : (
            <p className="text-sm">{ready.isError ? "Server unreachable. On-device mode still works." : "Checking…"}</p>
          )}
        </div>
      </section>

      <section aria-labelledby="classes-heading" className="space-y-4">
        <h2 id="classes-heading" className="section-title">
          {classes.data ? `All ${classes.data.total} supported results across ${classes.data.plants.length} crops` : "Supported crops"}
        </h2>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...byPlant.entries()].map(([plant, items]) => (
            <div key={plant}>
              <h3 className="font-display text-lg font-bold">{plant}</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {items.map((c) => (
                  <li key={c.class_id} className="flex items-start gap-2">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.risk.color }} aria-hidden="true" />
                    <span>
                      {c.healthy ? "Healthy" : c.disease}
                      {!c.healthy && <span className="text-moss"> ({pathogenWords[c.pathogen_type] ?? c.pathogen_type})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-prose rounded-2xl bg-turmeric-soft p-6">
        <h2 className="section-title">Use it as a second opinion</h2>
        <p className="mt-2">
          The model was trained on photos of single leaves on plain backgrounds. Field photos with several leaves,
          soil or harsh light are harder, which is why LeafScan checks photo quality and stability. For high-risk or
          incurable diseases, confirm with your agriculture officer or Krishi Vigyan Kendra before acting.
        </p>
      </section>
    </div>
  );
}
