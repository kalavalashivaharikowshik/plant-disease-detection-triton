import { useState } from "react";
import type { Region, Visuals } from "@/lib/types";

/** Drag-to-compare: photo on the left of the handle, heatmap on the right. Keyboard accessible. */
export function HeatmapCompare({ visuals, healthy }: { visuals: Visuals; healthy: boolean }) {
  const [split, setSplit] = useState(50);
  const [showRegions, setShowRegions] = useState(true);
  const hasHeat = Boolean(visuals.heatmap);

  return (
    <figure className="space-y-3">
      <div className="specimen p-3">
        <div className="relative overflow-hidden bg-mist">
          <img src={visuals.image} alt="Your leaf photo" className="block w-full select-none" draggable={false} />
          {hasHeat && (
            <img
              src={visuals.heatmap ?? ""}
              alt="Heatmap of the areas the AI used for its decision"
              className="absolute inset-0 block h-full w-full animate-reveal select-none"
              style={{ clipPath: `inset(0 0 0 ${split}%)` }}
              draggable={false}
            />
          )}
          {showRegions && !healthy && <RegionBoxes regions={visuals.regions} />}
          {hasHeat && (
            <>
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-sheet shadow" style={{ left: `${split}%` }} />
              <input
                type="range"
                min={0}
                max={100}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                aria-label="Slide between the photo and the heatmap"
                className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
              />
            </>
          )}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>
          {hasHeat
            ? "Drag across the photo. Bright areas are what the AI looked at to decide."
            : "Heatmap not available for this result."}
        </span>
        {!healthy && visuals.regions.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="accent-ink"
              checked={showRegions}
              onChange={(e) => setShowRegions(e.target.checked)}
            />
            Outline suspicious areas
          </label>
        )}
      </figcaption>
    </figure>
  );
}

function RegionBoxes({ regions }: { regions: Region[] }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {regions.map((r, i) => (
        <g key={i}>
          <rect
            x={r.x * 100}
            y={r.y * 100}
            width={r.width * 100}
            height={r.height * 100}
            fill="none"
            stroke="#e2a229"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: 2.5 }}
          />
          <text x={r.x * 100 + 1} y={r.y * 100 + 4} fill="#e2a229" fontSize="3.4" fontWeight="700">
            Area {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function ZoomPanel({ zoom }: { zoom: string }) {
  return (
    <figure className="space-y-2">
      <img src={zoom} alt="Close-up of the most suspicious part of the leaf" className="w-full rounded-lg border border-mist" />
      <figcaption className="text-sm">Close-up of the area the AI found most suspicious, from your full-resolution photo.</figcaption>
    </figure>
  );
}
