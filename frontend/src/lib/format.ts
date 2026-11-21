export const percent = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`;

export function confidenceWords(value: number): string {
  if (value >= 0.9) return "Very sure";
  if (value >= 0.7) return "Fairly sure";
  if (value >= 0.5) return "Not sure";
  return "Guessing";
}

export const pathogenWords: Record<string, string> = {
  fungus: "Fungus",
  bacterium: "Bacteria",
  virus: "Virus",
  oomycete: "Water mould",
  mite: "Pest (mite)",
  none: "None",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Plain-text summary used for sharing and the printed report. */
export function shareText(display: string, plant: string, confidence: number, steps: string[]): string {
  return [
    `LeafScan result: ${display} (${plant}), ${percent(confidence)} confidence.`,
    steps.length ? `Do now: ${steps.slice(0, 3).join("; ")}.` : "",
    "Checked with LeafScan, an AI leaf disease checker. Confirm serious cases with your agriculture officer.",
  ]
    .filter(Boolean)
    .join("\n");
}
