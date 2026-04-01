import { Stagehand } from "@browserbasehq/stagehand";
import { Composio } from "@composio/core";
import { kvGet, kvSet } from "../db/queries";
import type { AutomationContext } from "./types";

export async function buildContext(
  userId: string,
  automationId: string,
): Promise<{ context: AutomationContext; cleanup: () => Promise<void> }> {
  // Composio session for API-based tools (OneDrive, Gmail, etc.)
  const composio = new Composio();
  const session = await composio.create(userId);

  // Stagehand browser automation via Browserbase cloud
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    model: "google/gemini-3-flash-preview",
    verbose: 0,
    usePino: false,
    logger: () => {},
  });
  await stagehand.init();

  const context: AutomationContext = {
    composio: {
      execute: (toolSlug, args) => session.execute(toolSlug, args),
    },
    stagehand,
    log: () => {}, // overridden by engine at runtime
    store: {
      get: (key) => kvGet(automationId, key),
      set: (key, value) => kvSet(automationId, key, value),
    },
  };

  return {
    context,
    cleanup: () => stagehand.close(),
  };
}
