import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";
import { confidenceWords, percent, shareText } from "./format";
import { history, type HistoryEntry } from "./history";
import { buildActionPlanIcs } from "./ics";

describe("format", () => {
  it("formats percentages and plain-language confidence", () => {
    expect(percent(0.4851)).toBe("49%");
    expect(percent(0.4851, 1)).toBe("48.5%");
    expect(confidenceWords(0.95)).toBe("Very sure");
    expect(confidenceWords(0.75)).toBe("Fairly sure");
    expect(confidenceWords(0.3)).toBe("Guessing");
  });

  it("builds a share message with the first steps", () => {
    const text = shareText("Tomato late blight", "Tomato", 0.9, ["Remove leaves", "Spray", "Wait", "Extra"]);
    expect(text).toContain("Tomato late blight (Tomato), 90% confidence");
    expect(text).toContain("Remove leaves; Spray; Wait");
    expect(text).not.toContain("Extra");
  });
});

describe("calendar export", () => {
  it("creates one event per non-empty stage with escaped text", () => {
    const ics = buildActionPlanIcs(
      "Late blight",
      { today: ["Remove, bag; burn"], this_week: [], next_two_weeks: ["Re-check"] },
      new Date(2026, 0, 30),
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260130");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260209"); // +10 days crosses the month
    expect(ics).toContain("Remove\\, bag\\; burn");
  });
});

describe("history", () => {
  const entry = (id: string, tag = "Row 1"): HistoryEntry => ({
    id,
    createdAt: new Date().toISOString(),
    plantTag: tag,
    classId: "Tomato___healthy",
    displayName: "Healthy tomato leaf",
    plant: "Tomato",
    healthy: true,
    confidence: 0.9,
    riskLabel: "No disease",
    riskColor: "#16a34a",
    thumbnail: "data:image/jpeg;base64,",
  });

  it("adds newest first, retags and removes", () => {
    history.clear();
    history.add(entry("a"));
    history.add(entry("b"));
    expect(history.list().map((e) => e.id)).toEqual(["b", "a"]);
    history.retag("a", "Row 9");
    expect(history.list().find((e) => e.id === "a")?.plantTag).toBe("Row 9");
    history.remove("b");
    expect(history.list()).toHaveLength(1);
  });
});

describe("api client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("surfaces the server's error message and code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Use a JPEG, PNG or WebP photo.", code: "unsupported_format" }), {
        status: 415,
      }),
    );
    await expect(api.ready()).rejects.toMatchObject({ status: 415, code: "unsupported_format" });
  });

  it("explains network failures in plain words", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await api.ready().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toMatch(/Cannot reach the server/);
  });
});
