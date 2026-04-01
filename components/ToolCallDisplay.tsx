"use client";

import { useState } from "react";

/** Map raw Composio tool names to human-friendly labels */
function humanizeToolName(raw: string): string {
  const map: Record<string, string> = {
    COMPOSIO_SEARCH_TOOLS: "Searching tools",
    COMPOSIO_MANAGE_CONNECTIONS: "Managing connections",
    COMPOSIO_MULTI_EXECUTE_TOOL: "Running action",
    COMPOSIO_EXECUTE_TOOL: "Running action",
    COMPOSIO_GET_CONNECTIONS: "Checking connections",
    COMPOSIO_CREATE_CONNECTION: "Creating connection",
    COMPOSIO_GET_TOOL: "Loading tool",
  };

  if (map[raw]) return map[raw];

  // Fallback: strip COMPOSIO_ prefix, lowercase, replace underscores
  const cleaned = raw.replace(/^COMPOSIO_/, "").replace(/_/g, " ").toLowerCase();
  // Title case first word
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function ToolCallDisplay({
  toolName,
  input,
  output,
  isLoading,
}: {
  toolName: string;
  input: unknown;
  output?: unknown;
  isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = humanizeToolName(toolName);

  return (
    <div className="inline-block">
      <button
        onClick={() => !isLoading && setExpanded(!expanded)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all ${
          isLoading
            ? "border-border bg-surface text-muted cursor-default"
            : "border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground cursor-pointer"
        }`}
      >
        {isLoading ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-border-light border-t-muted" />
        ) : (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-green-500"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span className="font-medium">{label}</span>
        {!isLoading && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {expanded && !isLoading && (
        <pre className="mt-1.5 max-h-48 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-[#111] p-3 text-xs text-muted font-mono">
          {output != null
            ? String(JSON.stringify(output, null, 2))
            : String(JSON.stringify(input, null, 2))}
        </pre>
      )}
    </div>
  );
}
