"use client";

import { cronToHuman } from "@/lib/cron";

export type AutomationSummary = {
  id: string;
  name: string;
  description: string | null;
  schedule_cron: string;
  status: "active" | "paused" | "error";
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
  last_run: {
    id: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
    error: string | null;
  } | null;
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-400",
  paused: "bg-yellow-400",
  error: "bg-red-400",
};

export function AutomationsSidebar({
  automations,
  activeId,
  onSelect,
}: {
  automations: AutomationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-2 py-2 pb-3">
        {automations.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted">
            No automations yet. Create one via chat.
          </p>
        ) : (
          automations.map((a) => (
            <div
              key={a.id}
              className={`flex flex-col gap-1 rounded-lg px-3 py-2.5 cursor-pointer transition-colors mb-0.5 ${
                a.id === activeId
                  ? "bg-surface text-foreground"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
              onClick={() => onSelect(a.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`shrink-0 h-2 w-2 rounded-full ${STATUS_DOT[a.status] ?? "bg-gray-400"}`}
                />
                <span className="flex-1 truncate text-sm font-medium">
                  {a.name}
                </span>
              </div>
              <span className="text-xs text-muted pl-4 truncate">
                {cronToHuman(a.schedule_cron)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
