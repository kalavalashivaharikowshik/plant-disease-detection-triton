import clsx from "clsx";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import type { Notice } from "@/lib/types";

const STYLE = {
  danger: { icon: OctagonAlert, className: "bg-rust-soft text-rust" },
  warning: { icon: AlertTriangle, className: "bg-turmeric-soft text-ink" },
  info: { icon: Info, className: "bg-mist text-ink" },
} as const;

export function NoticeList({ notices }: { notices: Notice[] }) {
  if (!notices.length) return null;
  const order = { danger: 0, warning: 1, info: 2 };
  return (
    <ul className="space-y-2" aria-label="Things to know about this result">
      {[...notices]
        .sort((a, b) => order[a.severity] - order[b.severity])
        .map((notice) => {
          const { icon: Icon, className } = STYLE[notice.severity];
          return (
            <li key={notice.code} className={clsx("flex gap-3 rounded-lg px-4 py-3 text-sm", className)}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{notice.message}</span>
            </li>
          );
        })}
    </ul>
  );
}
