import clsx from "clsx";
import { Camera, ImageUp } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { usePreferences } from "@/lib/usePreferences";
import { ScanOverlay } from "./ScanOverlay";

export const MAX_UPLOAD_MB = 8;

const ACCEPT = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] };

function rejectionMessage(rejections: FileRejection[]): string {
  const error = rejections[0]?.errors[0];
  if (!error) return "That file could not be used.";
  if (error.code === "file-too-large") return `That photo is larger than ${MAX_UPLOAD_MB} MB. Use a smaller photo.`;
  if (error.code === "file-invalid-type") return "Use a JPEG, PNG or WebP photo.";
  if (error.code === "too-many-files") return "Choose one photo at a time.";
  return error.message;
}

interface Props {
  previewUrl: string | null;
  busy: boolean;
  busyLabel?: string;
  onFile: (file: File) => void;
}

export function UploadPanel({ previewUrl, busy, busyLabel, onFile }: Props) {
  const [rejection, setRejection] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const { engineMode, setEngineMode } = usePreferences();

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length) {
        setRejection(rejectionMessage(rejected));
        return;
      }
      setRejection(null);
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: false,
    maxSize: MAX_UPLOAD_MB * 1024 * 1024,
    noClick: true,
    disabled: busy,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={clsx(
          "specimen flex aspect-[4/3] w-full items-center justify-center overflow-hidden p-3 transition-colors",
          isDragActive && "bg-turmeric-soft",
        )}
      >
        <input {...getInputProps()} aria-label="Leaf photo" />
        {previewUrl ? (
          <img src={previewUrl} alt="The leaf you uploaded" className="h-full w-full object-contain" />
        ) : (
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <ImageUp className="h-10 w-10 text-moss" aria-hidden="true" />
            <p className="font-display text-lg font-bold text-ink">
              {isDragActive ? "Drop the photo to check it" : "Photograph one leaf, close up, in daylight"}
            </p>
            <p className="text-sm">Fill the frame with a single leaf. Both sides help if you are unsure.</p>
          </div>
        )}
        {busy && <ScanOverlay label={busyLabel} />}
      </div>
      <div className="ruler h-2 w-full" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => cameraInput.current?.click()} disabled={busy}>
          <Camera className="h-5 w-5" aria-hidden="true" /> Take photo
        </button>
        <button type="button" className="btn-quiet" onClick={open} disabled={busy}>
          <ImageUp className="h-5 w-5" aria-hidden="true" /> Choose photo
        </button>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onDrop([file], []);
            e.target.value = "";
          }}
        />
      </div>

      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <legend className="sr-only">Where to run the check</legend>
        {(
          [
            ["server", "Check online (full report)"],
            ["device", "Check on this phone (works offline)"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="engine"
              value={value}
              checked={engineMode === value}
              onChange={() => setEngineMode(value)}
              className="accent-ink"
            />
            {label}
          </label>
        ))}
      </fieldset>

      {rejection && (
        <p role="alert" className="rounded-lg bg-rust-soft px-4 py-3 text-sm font-bold text-rust">
          {rejection}
        </p>
      )}
    </div>
  );
}
