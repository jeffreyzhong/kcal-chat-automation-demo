"use client";

import { useState, useEffect, useCallback } from "react";
import { cronToHuman } from "@/lib/cron";
import type { AutomationSummary } from "./AutomationsSidebar";

type Run = {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error: string | null;
  logs: { timestamp: string; level: string; message: string }[] | null;
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-400/15", text: "text-emerald-400", label: "Active" },
  paused: { bg: "bg-yellow-400/15", text: "text-yellow-400", label: "Paused" },
  error: { bg: "bg-red-400/15", text: "text-red-400", label: "Error" },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return `${minutes}m ${remainSeconds}s`;
}

export function AutomationDetail({
  automation,
  onStatusChange,
}: {
  automation: AutomationSummary;
  onStatusChange: (id: string, newStatus: string) => void;
}) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    setRuns([]);
    setExpandedRun(null);
    fetch(`/api/automations/${automation.id}/runs`)
      .then((r) => r.json())
      .then(setRuns);
  }, [automation.id]);

  const handleToggle = useCallback(async () => {
    setToggling(true);
    const action = automation.status === "active" ? "pause" : "resume";
    const res = await fetch(`/api/automations/${automation.id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const data = await res.json();
      onStatusChange(automation.id, data.status);
    }
    setToggling(false);
  }, [automation.id, automation.status, onStatusChange]);

  const badge = STATUS_BADGE[automation.status] ?? STATUS_BADGE.error;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {automation.name}
            </h2>
            {automation.description && (
              <p className="mt-1 text-sm text-muted">{automation.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
            >
              {badge.label}
            </span>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              {toggling
                ? "..."
                : automation.status === "active"
                  ? "Pause"
                  : "Resume"}
            </button>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <InfoCard
            label="Schedule"
            value={cronToHuman(automation.schedule_cron)}
          />
          <InfoCard
            label="Last run"
            value={
              automation.last_run
                ? relativeTime(automation.last_run.started_at)
                : "Never"
            }
          />
          <InfoCard
            label="Last duration"
            value={
              automation.last_run
                ? formatDuration(automation.last_run.duration_ms)
                : "-"
            }
          />
        </div>

        {/* Run history */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">
            Run History
          </h3>
          {runs.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">
              No runs yet
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              {runs.map((run, i) => (
                <RunRow
                  key={run.id}
                  run={run}
                  isExpanded={expandedRun === run.id}
                  onToggle={() =>
                    setExpandedRun(expandedRun === run.id ? null : run.id)
                  }
                  isLast={i === runs.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function RunRow({
  run,
  isExpanded,
  onToggle,
  isLast,
}: {
  run: Run;
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  const isSuccess = run.status === "completed";
  return (
    <div className={isLast ? "" : "border-b border-border"}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
      >
        {/* Status icon */}
        {isSuccess ? (
          <svg
            className="shrink-0 text-emerald-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            className="shrink-0 text-red-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}

        <span className="flex-1 text-sm text-foreground">
          {relativeTime(run.started_at)}
        </span>

        <span className="text-xs text-muted">
          {formatDuration(run.duration_ms)}
        </span>

        {run.error && (
          <span className="text-xs text-red-400 max-w-[200px] truncate">
            {run.error}
          </span>
        )}

        {/* Expand chevron */}
        <svg
          className={`shrink-0 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          {run.error && (
            <div className="mb-3 rounded-md bg-red-400/10 border border-red-400/20 px-3 py-2">
              <p className="text-xs font-medium text-red-400 mb-1">Error</p>
              <p className="text-xs text-red-300 font-mono whitespace-pre-wrap">
                {run.error}
              </p>
            </div>
          )}

          {run.logs && run.logs.length > 0 ? (
            <div className="rounded-md bg-[#1e1e1e] border border-border p-3 max-h-60 overflow-y-auto">
              {run.logs.map((log, i) => (
                <div key={i} className="flex gap-2 text-xs font-mono mb-1 last:mb-0">
                  <span className="shrink-0 text-muted">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={
                      log.level === "error" ? "text-red-400" : "text-foreground"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">No logs for this run</p>
          )}
        </div>
      )}
    </div>
  );
}
