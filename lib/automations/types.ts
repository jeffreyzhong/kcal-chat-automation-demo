import type { Stagehand } from "@browserbasehq/stagehand";

export interface AutomationContext {
  /** Composio API integrations (OneDrive, Gmail, Slack, GitHub, etc.) */
  composio: {
    execute: (
      toolSlug: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: Record<string, unknown>; error?: string | null }>;
  };

  /**
   * Stagehand browser automation (backed by Browserbase cloud browsers).
   *
   * Core methods:
   *   stagehand.act(instruction)              — atomic browser action
   *   stagehand.observe(instruction)          — find available actions → Action[]
   *   stagehand.extract(instruction, schema)  — extract structured data
   *   stagehand.agent({ mode, model })        — multi-step agent
   *   stagehand.page                          — Playwright Page (goto, reload, etc.)
   *
   * Best practices:
   *   - Keep act() calls atomic: "Click the Sign In button"
   *   - Use observe() + act(action) for reliability
   *   - Use Zod schemas with .describe() for extract accuracy
   *   - Use variables for sensitive data: act("type %pw%", { variables: { pw } })
   */
  stagehand: Stagehand;

  /** Structured logging — captured in automation_runs.logs */
  log: (message: string) => void;

  /** Key-value store persisted between runs (backed by automations.kv_store) */
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  };
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "error";
  message: string;
}
