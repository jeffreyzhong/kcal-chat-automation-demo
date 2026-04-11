import { z } from "zod";
import type { Stagehand } from "@browserbasehq/stagehand";
import type { AutomationContext, LogEntry } from "./types";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export async function executeAutomation(
  sourceCode: string,
  context: AutomationContext,
  options?: { allStagehandInstances?: Stagehand[]; cacheLogs?: string[] },
): Promise<{ logs: LogEntry[]; error?: string; durationMs: number }> {
  const start = Date.now();
  const logs: LogEntry[] = [];

  // Prepend any cache logs collected during buildContext (before ctx.log was wired up)
  if (options?.cacheLogs) {
    for (const msg of options.cacheLogs) {
      logs.push({
        timestamp: new Date().toISOString(),
        level: "info",
        message: msg,
      });
    }
  }

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
    const fn = new AsyncFunction("ctx", "z", sourceCode);
    await fn(ctx, z);

    // Aggregate token usage across all Stagehand instances
    const instances = options?.allStagehandInstances ?? [];
    if (instances.length > 0) {
      try {
        let totalPrompt = 0;
        let totalCompletion = 0;
        let totalReasoning = 0;
        let totalCachedInput = 0;

        for (const instance of instances) {
          const m = await instance.metrics;
          totalPrompt += m.totalPromptTokens;
          totalCompletion += m.totalCompletionTokens;
          totalReasoning += m.totalReasoningTokens;
          totalCachedInput += m.totalCachedInputTokens;
        }

        const totalTokens = totalPrompt + totalCompletion;
        logs.push({
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Token usage: ${totalTokens.toLocaleString()} total (${totalPrompt.toLocaleString()} prompt, ${totalCompletion.toLocaleString()} completion, ${totalReasoning.toLocaleString()} reasoning, ${totalCachedInput.toLocaleString()} cached input) across ${instances.length} browser(s)`,
        });
      } catch {
        // Metrics read failed — not critical, skip
      }
    }

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
