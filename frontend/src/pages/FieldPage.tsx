import { LayoutGrid, Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { MAX_UPLOAD_MB } from "@/components/UploadPanel";
import { api } from "@/lib/api";
import { percent } from "@/lib/format";
import { analyzeOnDevice } from "@/lib/offline/analyze";
import { usePreferences } from "@/lib/usePreferences";
import type { AnalysisResult } from "@/lib/types";

const MAX_FILES = 20;

interface Row {
  file: File;
  thumb: string;
  status: "waiting" | "checking" | "done" | "error";
  result?: AnalysisResult;
  error?: string;
}

export function FieldPage() {
  const { engineMode } = usePreferences();
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxSize: MAX_UPLOAD_MB * 1024 * 1024,
    noClick: true,
    disabled: running,
    onDrop: (accepted, rejected) => {
      const room = MAX_FILES - rows.length;
      const added = accepted.slice(0, room).map((file) => ({ file, thumb: URL.createObjectURL(file), status: "waiting" as const }));
      setRows((r) => [...r, ...added]);
      const skipped = rejected.length + Math.max(0, accepted.length - room);
      setNote(skipped ? `${skipped} file(s) skipped: only JPEG/PNG/WebP under ${MAX_UPLOAD_MB} MB, up to ${MAX_FILES} photos.` : null);
    },
  });

  const run = async () => {
    setRunning(true);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].status === "done") continue;
      setRows((r) => r.map((row, j) => (j === i ? { ...row, status: "checking" } : row)));
      try {
        const result = engineMode === "device" ? await analyzeOnDevice(rows[i].file) : await api.analyze(rows[i].file);
        setRows((r) => r.map((row, j) => (j === i ? { ...row, status: "done", result } : row)));
      } catch (e) {
        setRows((r) => r.map((row, j) => (j === i ? { ...row, status: "error", error: (e as Error).message } : row)));
      }
    }
    setRunning(false);
  };

  const done = rows.filter((r) => r.result).map((r) => r.result as AnalysisResult);
  const summary = useMemo(() => {
    const groups = new Map<string, { name: string; count: number; color: string; level: number; healthy: boolean }>();
    for (const r of done) {
      const p = r.prediction;
      const g = groups.get(p.class_id) ?? { name: p.display_name, count: 0, color: p.risk.color, level: p.risk.level, healthy: p.healthy };
      g.count += 1;
      groups.set(p.class_id, g);
    }
    return [...groups.values()].sort((a, b) => b.level - a.level || b.count - a.count);
  }, [done]);
  const healthyShare = done.length ? done.filter((r) => r.prediction.healthy).length / done.length : 0;
  const uncertain = done.filter((r) => !r.reliable).length;

  return (
    <div className="page space-y-8 py-8">
      <div className="max-w-prose">
        <h1 className="font-display text-3xl font-extrabold">Field survey</h1>
        <p className="mt-2">
          Walk the field and photograph 10 to 20 leaves from different spots. LeafScan checks them all and tells you
          how much of the field is affected and what to treat first.
        </p>
      </div>

      <div {...getRootProps()} className="specimen flex flex-col items-center gap-3 p-8 text-center">
        <input {...getInputProps()} />
        <LayoutGrid className="h-8 w-8 text-moss" aria-hidden="true" />
        <p className="font-bold text-ink">Drop up to {MAX_FILES} leaf photos here</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-quiet" onClick={open} disabled={running || rows.length >= MAX_FILES}>
            Choose photos
          </button>
          <button className="btn-primary" onClick={run} disabled={running || !rows.some((r) => r.status !== "done")}>
            {running && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {running ? "Checking…" : `Check ${rows.filter((r) => r.status !== "done").length || ""} photos`}
          </button>
          {rows.length > 0 && !running && (
            <button className="btn-quiet" onClick={() => setRows([])}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear
            </button>
          )}
        </div>
        {note && <p className="text-sm text-rust">{note}</p>}
      </div>

      {done.length > 0 && (
        <section aria-labelledby="summary-heading" className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <h2 id="summary-heading" className="section-title">
              Field summary
            </h2>
            <p className="font-display text-4xl font-extrabold text-ink">{percent(healthyShare)} healthy</p>
            <p>
              {done.length} leaves checked{uncertain ? `, ${uncertain} need a second look (low confidence or unstable)` : ""}.
            </p>
            <div className="flex h-4 overflow-hidden rounded-full" aria-hidden="true">
              {summary.map((g) => (
                <div key={g.name} style={{ width: `${(g.count / done.length) * 100}%`, backgroundColor: g.color }} />
              ))}
            </div>
          </div>
          <div className="lg:col-span-7">
            <h3 className="font-display text-lg font-bold">Treat first</h3>
            <ol className="mt-2 space-y-2">
              {summary.map((g) => (
                <li key={g.name} className="flex items-center justify-between gap-3 border-b border-mist pb-2">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
                    {g.name}
                  </span>
                  <span className="tabular-nums">
                    {g.count} of {done.length} ({percent(g.count / done.length)})
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((row, i) => (
            <li key={i} className="flex gap-3 rounded-xl bg-sheet p-3">
              <img src={row.thumb} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 text-sm">
                {row.status === "done" && row.result ? (
                  <>
                    <p className="font-bold text-ink">{row.result.prediction.display_name}</p>
                    <p>
                      {percent(row.result.prediction.confidence)}
                      {!row.result.reliable && " · check again"}
                    </p>
                  </>
                ) : row.status === "error" ? (
                  <p className="text-rust">{row.error}</p>
                ) : (
                  <p className="text-moss">{row.status === "checking" ? "Checking…" : "Waiting"}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
