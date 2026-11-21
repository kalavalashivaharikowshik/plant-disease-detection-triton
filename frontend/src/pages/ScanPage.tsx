import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UploadPanel } from "@/components/UploadPanel";
import { ResultView } from "@/components/result/ResultView";
import { api } from "@/lib/api";
import { analyzeOnDevice } from "@/lib/offline/analyze";
import { usePreferences } from "@/lib/preferences";

const STEPS = [
  ["Photograph one leaf", "Close up, in daylight, with the leaf filling the frame."],
  ["See what the AI sees", "A heatmap and outlines show which spots led to the answer."],
  ["Know how sure it is", "Confidence, a stability test and photo checks tell you when to double-check."],
  ["Act on sourced advice", "A dated plan with field, organic and chemical options from extension guides."],
];

export function ScanPage() {
  const { engineMode } = usePreferences();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const analysis = useMutation({
    mutationFn: (f: File) =>
      engineMode === "device" ? analyzeOnDevice(f, (p) => setProgress(p)) : api.analyze(f),
    onSettled: () => setProgress(null),
  });

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // A frame captured on the Live page arrives through navigation state.
  const location = useLocation();
  const navigate = useNavigate();
  const handled = useRef(false);
  useEffect(() => {
    const captured = (location.state as { file?: File } | null)?.file;
    if (captured && !handled.current) {
      handled.current = true;
      navigate(".", { replace: true, state: null });
      start(captured);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const start = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    analysis.mutate(f);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    analysis.reset();
    setFile(null);
    setPreview(null);
  };

  if (analysis.data) {
    return (
      <div className="page py-8">
        <ResultView key={analysis.data.id} result={analysis.data} file={file} onReset={reset} />
      </div>
    );
  }

  const busyLabel =
    progress !== null && progress < 1
      ? `Downloading the model for offline use… ${Math.round(progress * 100)}%`
      : "Checking the leaf…";

  return (
    <div className="page grid gap-10 py-8 lg:grid-cols-12 lg:py-14">
      <div className="lg:col-span-7">
        <UploadPanel previewUrl={preview} busy={analysis.isPending} busyLabel={busyLabel} onFile={start} />
        {analysis.isError && (
          <div role="alert" className="mt-4 rounded-lg bg-rust-soft px-4 py-3 text-rust">
            <p className="font-bold">The check did not finish.</p>
            <p className="text-sm">{(analysis.error as Error).message}</p>
          </div>
        )}
      </div>

      <div className="space-y-8 lg:col-span-5 lg:pt-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
            Is your crop sick? Check a leaf in seconds.
          </h1>
          <p className="mt-4 max-w-prose text-lg">
            LeafScan recognises 38 diseases and healthy leaves across 14 crops, including tomato, potato,
            corn, grape, apple and citrus, and tells you how sure it is before you spend money on treatment.
          </p>
        </div>
        <ol className="space-y-4">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink font-display font-bold text-ink">
                {i + 1}
              </span>
              <span>
                <span className="block font-bold text-ink">{title}</span>
                <span className="text-sm">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
