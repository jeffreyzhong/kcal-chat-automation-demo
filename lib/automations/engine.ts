import { transform } from "esbuild";
import { z } from "zod";
import type { AutomationContext, LogEntry } from "./types";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export async function executeAutomation(
  sourceCode: string,
  context: AutomationContext,
): Promise<{ logs: LogEntry[]; error?: string; durationMs: number }> {
  const start = Date.now();
  const logs: LogEntry[] = [];

  const ctx: AutomationContext = {
    ...context,
    log: (msg: string) => {
      logs.push({
        timestamp: new Date().toISOString(),
        level: "info",
        message: msg,
      });
    },
  };

  try {
    // Transpile TS → JS
    const { code } = await transform(sourceCode, {
      loader: "ts",
      target: "es2022",
    });

    // Execute with ctx and z (Zod) as the only available bindings
    const fn = new AsyncFunction("ctx", "z", code);
    await fn(ctx, z);

    return { logs, durationMs: Date.now() - start };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logs.push({
      timestamp: new Date().toISOString(),
      level: "error",
      message: error,
    });
    return { logs, error, durationMs: Date.now() - start };
  }
}
