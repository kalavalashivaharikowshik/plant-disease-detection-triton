import { Aperture, Camera, CameraOff, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfidenceMeter } from "@/components/result/ResultHeader";
import { percent } from "@/lib/format";
import { cam, drawHeat, loadDeviceEngine, runDevice, toInput, topK, type DeviceEngine } from "@/lib/offline/engine";
import type { ClassScore } from "@/lib/types";

const INTERVAL_MS = 600;

export function LivePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<DeviceEngine | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [scores, setScores] = useState<ClassScore[]>([]);
  const [showHeat, setShowHeat] = useState(true);
  const navigate = useNavigate();

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => stop, [stop]);

  const start = async () => {
    setError(null);
    setStatus("loading");
    try {
      engineRef.current = await loadDeviceEngine(setProgress);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("running");
    } catch (e) {
      const message =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings and try again."
          : e instanceof Error
            ? e.message
            : "The camera could not be started.";
      setError(message);
      setStatus("error");
    }
  };

  useEffect(() => {
    if (status !== "running") return undefined;
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      const video = videoRef.current;
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (cancelled || !video || !engine || !canvas || video.readyState < 2) {
        timer = window.setTimeout(tick, INTERVAL_MS);
        return;
      }
      const out = await runDevice(engine, [toInput(video)]);
      if (cancelled) return;
      const ranked = topK(engine, out.probs[0], 3);
      setScores(ranked);
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (showHeat && out.features) {
          const index = engine.knowledge.labels.indexOf(ranked[0].class_id);
          drawHeat(ctx, cam(engine, out.features, index), canvas.width, canvas.height, 0.55);
        }
      }
      timer = window.setTimeout(tick, INTERVAL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [status, showHeat]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stop();
        navigate("/", { state: { file: new File([blob], "live-capture.jpg", { type: "image/jpeg" }) } });
      },
      "image/jpeg",
      0.92,
    );
  };

  const top = scores[0];

  return (
    <div className="page grid gap-8 py-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="specimen relative aspect-[3/4] overflow-hidden p-3 sm:aspect-[4/3]">
          <div className="relative h-full w-full overflow-hidden bg-ink">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted aria-label="Camera view" />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" aria-hidden="true" />
            {status !== "running" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-paper">
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                    <p role="status">
                      {progress > 0 && progress < 1 ? `Downloading the model… ${percent(progress)}` : "Starting the camera…"}
                    </p>
                  </>
                ) : (
                  <>
                    <Camera className="h-10 w-10 text-turmeric" aria-hidden="true" />
                    <p className="max-w-xs">Point your camera at a leaf. The check runs on this phone, so it works without internet.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {status === "running" ? (
            <>
              <button className="btn-primary" onClick={capture}>
                <Aperture className="h-5 w-5" aria-hidden="true" /> Capture for full report
              </button>
              <button className="btn-quiet" onClick={stop}>
                <CameraOff className="h-5 w-5" aria-hidden="true" /> Stop camera
              </button>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="accent-ink" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
                Show heatmap
              </label>
            </>
          ) : (
            <button className="btn-primary" onClick={start} disabled={status === "loading"}>
              <Camera className="h-5 w-5" aria-hidden="true" /> Start live scan
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rust-soft px-4 py-3 text-sm font-bold text-rust">
            {error}
          </p>
        )}
      </div>

      <div className="space-y-6 lg:col-span-5">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Live scan</h1>
          <p className="mt-2 max-w-prose">
            Move slowly over the plant. The answer updates about twice a second; capture a frame when it settles to get the full report.
          </p>
        </div>
        <div aria-live="polite" className="space-y-4">
          {top ? (
            <>
              <div>
                <p className="text-sm font-bold text-moss">{top.plant}</p>
                <p className="font-display text-2xl font-bold text-ink">{top.healthy ? "Looks healthy" : top.disease}</p>
              </div>
              <ConfidenceMeter value={top.confidence} />
              <ul className="space-y-1 text-sm">
                {scores.slice(1).map((s) => (
                  <li key={s.class_id}>
                    {s.display_name}: {percent(s.confidence)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm">Results appear here once the camera starts.</p>
          )}
        </div>
      </div>
    </div>
  );
}
