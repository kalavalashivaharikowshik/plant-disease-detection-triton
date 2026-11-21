// Builds an iCalendar (.ics) file with reminders for each step of an action plan.
import type { ActionPlan } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

function icsDate(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** One all-day event per stage: today, in 3 days, and in 10 days. */
export function buildActionPlanIcs(title: string, plan: ActionPlan, now = new Date()): string {
  const stages: Array<[string, string[], number]> = [
    ["Today", plan.today, 0],
    ["This week", plan.this_week, 3],
    ["Next two weeks", plan.next_two_weeks, 10],
  ];
  const stamp = `${icsDate(now)}T000000Z`;
  const events = stages
    .filter(([, steps]) => steps.length > 0)
    .map(([label, steps, offset], i) => {
      const day = new Date(now);
      day.setDate(day.getDate() + offset);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return [
        "BEGIN:VEVENT",
        `UID:${stamp}-${i}@leafscan`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(day)}`,
        `DTEND;VALUE=DATE:${icsDate(next)}`,
        `SUMMARY:${escapeText(`${title}: ${label}`)}`,
        `DESCRIPTION:${escapeText(steps.map((s) => `- ${s}`).join("\n"))}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(`${title}: ${label}`)}`,
        "TRIGGER:PT8H",
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LeafScan//Action plan//EN", ...events, "END:VCALENDAR"].join(
    "\r\n",
  );
}

export function downloadFile(content: string | Blob, filename: string, type = "text/calendar") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
