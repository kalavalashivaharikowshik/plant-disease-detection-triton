import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Knowledge } from "@/lib/types";

const TABS = [
  ["cultural", "Field practices"],
  ["organic", "Organic options"],
  ["chemical", "Chemical options"],
] as const;

export function TreatmentPanel({ knowledge, healthy }: { knowledge: Knowledge; healthy: boolean }) {
  const available = TABS.filter(([key]) => knowledge.treatment[key].length > 0);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>(available[0]?.[0] ?? "cultural");

  return (
    <section aria-labelledby="treatment-heading" className="space-y-4">
      <h2 id="treatment-heading" className="section-title">
        {healthy ? "Keep it healthy" : "Treatment and prevention"}
      </h2>

      {!healthy && available.length > 0 && (
        <div>
          <div role="tablist" aria-label="Treatment type" className="flex flex-wrap gap-2">
            {available.map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={clsx(
                  "rounded-full px-4 py-1.5 text-sm font-bold",
                  tab === key ? "bg-ink text-paper" : "bg-mist text-ink",
                )}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <ul role="tabpanel" className="mt-3 list-disc space-y-2 pl-5">
            {knowledge.treatment[tab].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {tab === "chemical" && (
            <p className="mt-3 rounded-lg bg-turmeric-soft px-4 py-3 text-sm text-ink">
              Use only products registered for this crop in your area, and follow the label for dose,
              interval and safety gear. Your local agriculture officer or KVK can recommend a product.
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="font-display text-lg font-bold">Prevention</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {knowledge.prevention.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      {!healthy && (
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="font-bold text-ink">Symptoms</dt>
            <dd className="mt-1">
              <ul className="list-disc space-y-1 pl-5">
                {knowledge.symptoms.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div className="space-y-3">
            <div>
              <dt className="font-bold text-ink">When it spreads</dt>
              <dd>{knowledge.favourable_conditions}</dd>
            </div>
            <div>
              <dt className="font-bold text-ink">How it spreads</dt>
              <dd>{knowledge.spread}</dd>
            </div>
          </div>
        </dl>
      )}

      <div>
        <h3 className="font-display text-lg font-bold">Sources</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {knowledge.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-moss underline underline-offset-2 hover:text-ink">
                {s.title} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
