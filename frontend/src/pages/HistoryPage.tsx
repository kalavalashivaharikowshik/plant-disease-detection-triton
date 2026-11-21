import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDate, percent } from "@/lib/format";
import { history, type HistoryEntry } from "@/lib/history";

export function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => history.list());
  const refresh = () => setEntries(history.list());

  const groups = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const e of entries) map.set(e.plantTag, [...(map.get(e.plantTag) ?? []), e]);
    return [...map.entries()];
  }, [entries]);

  if (!entries.length) {
    return (
      <div className="page max-w-prose py-16">
        <h1 className="font-display text-3xl font-extrabold">History</h1>
        <p className="mt-3">
          Saved results appear here, grouped by plant name so you can see whether a plant is getting better or worse
          after treatment. They stay on this device only.
        </p>
        <Link to="/" className="btn-primary mt-6">
          Check a leaf
        </Link>
      </div>
    );
  }

  return (
    <div className="page space-y-10 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-prose">
          <h1 className="font-display text-3xl font-extrabold">History</h1>
          <p className="mt-2">Grouped by plant name, newest first. Stored only on this device.</p>
        </div>
        <button
          className="btn-quiet"
          onClick={() => {
            if (window.confirm("Delete all saved results from this device?")) {
              history.clear();
              refresh();
            }
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete all
        </button>
      </div>

      {groups.map(([tag, items]) => {
        const chronological = [...items].reverse();
        const latest = items[0];
        const first = chronological[0];
        const trend =
          items.length < 2
            ? null
            : latest.healthy && !first.healthy
              ? "Recovered since the first check."
              : !latest.healthy && first.healthy
                ? "Was healthy at the first check; now showing disease."
                : latest.classId === first.classId && !latest.healthy
                  ? "Same problem as the first check. If you have treated it, check new leaves for fresh spots."
                  : "The diagnosis has changed between checks.";
        return (
          <section key={tag} aria-label={tag} className="space-y-4">
            <div>
              <h2 className="section-title">{tag}</h2>
              <p className="text-sm">
                {items.length} check{items.length > 1 ? "s" : ""}
                {trend ? `. ${trend}` : ""}
              </p>
            </div>
            {items.length > 1 && (
              <ol className="flex items-center gap-1" aria-label="Checks over time, oldest first">
                {chronological.map((e) => (
                  <li
                    key={e.id}
                    title={`${formatDate(e.createdAt)}: ${e.displayName}`}
                    className="h-3 flex-1 rounded-full"
                    style={{ backgroundColor: e.riskColor, opacity: 0.4 + e.confidence * 0.6 }}
                  />
                ))}
              </ol>
            )}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((e) => (
                <li key={e.id} className="flex gap-3 rounded-xl bg-sheet p-3">
                  <img src={e.thumbnail} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-bold text-ink">{e.displayName}</p>
                    <p>
                      <span className="font-bold" style={{ color: e.riskColor }}>
                        {e.riskLabel}
                      </span>{" "}
                      · {percent(e.confidence)}
                    </p>
                    <p className="text-moss">{formatDate(e.createdAt)}</p>
                    <div className="mt-1 flex gap-3">
                      <button
                        className="underline underline-offset-2"
                        onClick={() => {
                          const name = window.prompt("Plant name", e.plantTag);
                          if (name?.trim()) {
                            history.retag(e.id, name.trim());
                            refresh();
                          }
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="text-rust underline underline-offset-2"
                        onClick={() => {
                          history.remove(e.id);
                          refresh();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
