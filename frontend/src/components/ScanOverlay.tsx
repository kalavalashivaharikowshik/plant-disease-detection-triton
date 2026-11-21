// The one orchestrated motion moment: a scan line sweeps the specimen while it is analysed.
export function ScanOverlay({ label = "Checking the leaf…" }: { label?: string }) {
  return (
    <div className="absolute inset-0 flex items-end justify-center overflow-hidden" role="status" aria-live="polite">
      <div className="absolute inset-0 bg-ink/25" />
      <div className="absolute inset-x-0 h-1 animate-sweep bg-turmeric shadow-[0_0_24px_6px_rgba(226,162,41,0.55)]" />
      <span className="relative mb-4 rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-paper">{label}</span>
    </div>
  );
}
