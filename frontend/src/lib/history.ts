// Scan history kept on this device only (localStorage). Nothing is uploaded.

export interface HistoryEntry {
  id: string;
  createdAt: string;
  plantTag: string; // user-chosen name, e.g. "Tomato row 3", to track one plant over time
  classId: string;
  displayName: string;
  plant: string;
  healthy: boolean;
  confidence: number;
  riskLabel: string;
  riskColor: string;
  thumbnail: string; // small JPEG data URL
}

const KEY = "leafscan.history.v1";
const LIMIT = 60;

function read(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
  } catch {
    // Storage full or blocked: drop the oldest half and retry once.
    try {
      localStorage.setItem(KEY, JSON.stringify(entries.slice(0, Math.floor(LIMIT / 2))));
    } catch {
      /* give up silently; history is a convenience */
    }
  }
}

export const history = {
  list: read,
  add(entry: HistoryEntry) {
    write([entry, ...read().filter((e) => e.id !== entry.id)]);
  },
  retag(id: string, plantTag: string) {
    write(read().map((e) => (e.id === id ? { ...e, plantTag } : e)));
  },
  remove(id: string) {
    write(read().filter((e) => e.id !== id));
  },
  clear() {
    write([]);
  },
};

/** Shrink a data URL or image file to a small square-ish thumbnail. */
export async function makeThumbnail(src: string, size = 120): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = size / Math.max(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}
