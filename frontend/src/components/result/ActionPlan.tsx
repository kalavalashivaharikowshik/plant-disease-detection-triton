import { CalendarPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { buildActionPlanIcs, downloadFile } from "@/lib/ics";
import type { ActionPlan as Plan } from "@/lib/types";

const STAGES: Array<[keyof Plan, string]> = [
  ["today", "Today"],
  ["this_week", "This week"],
  ["next_two_weeks", "Next two weeks"],
];

export function ActionPlan({ plan, title, scanId }: { plan: Plan; title: string; scanId: string }) {
  const storageKey = `leafscan.plan.${scanId}`;
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(done));
    } catch {
      /* ignore */
    }
  }, [done, storageKey]);

  return (
    <section aria-labelledby="plan-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="plan-heading" className="section-title">
          What to do
        </h2>
        <button
          className="btn-quiet no-print text-sm"
          onClick={() => downloadFile(buildActionPlanIcs(title, plan), "leafscan-action-plan.ics")}
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add reminders to calendar
        </button>
      </div>
      {/* A real sequence, so numbered stages are meaningful here. */}
      <ol className="relative space-y-6 border-l-2 border-mist pl-6">
        {STAGES.map(([key, label], index) =>
          plan[key].length ? (
            <li key={key} className="relative">
              <span className="absolute -left-[2.1rem] flex h-7 w-7 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-paper">
                {index + 1}
              </span>
              <h3 className="font-display text-lg font-bold">{label}</h3>
              <ul className="mt-2 space-y-2">
                {plan[key].map((step) => {
                  const id = `${key}:${step}`;
                  return (
                    <li key={step}>
                      <label className="flex cursor-pointer gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0 accent-moss"
                          checked={Boolean(done[id])}
                          onChange={(e) => setDone((d) => ({ ...d, [id]: e.target.checked }))}
                        />
                        <span className={done[id] ? "text-body/60 line-through" : ""}>{step}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </li>
          ) : null,
        )}
      </ol>
    </section>
  );
}
