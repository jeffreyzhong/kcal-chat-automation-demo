import { Stagehand } from "@browserbasehq/stagehand";
import { Composio } from "@composio/core";
import { kvGet, kvSet } from "../db/queries";
import type { AutomationContext } from "./types";

export async function buildContext(
  userId: string,
  automationId: string,
  options?: { needsBrowser?: boolean },
): Promise<{
  context: AutomationContext;
  stagehand: Stagehand | null;
  cleanup: () => Promise<void>;
}> {
  // Composio session for API-based tools (OneDrive, Gmail, etc.)
  const composio = new Composio();
  const session = await composio.create(userId);

  // Only spin up a Browserbase browser when the automation actually needs one
  let stagehand: Stagehand | null = null;
  if (options?.needsBrowser) {
    stagehand = new Stagehand({
      env: "BROWSERBASE",
      model: "google/gemini-3-flash-preview",
      verbose: 0,
      usePino: false,
      logger: () => {},
    });
    await stagehand.init();
  }

  const stagehandOrThrow = stagehand ??
    (new Proxy({} as Stagehand, {
      get() {
        throw new Error(
          "This automation does not have browser access. " +
          "Use ctx.composio.execute() for API integrations, " +
          "or include ctx.stagehand in your code to enable browser automation.",
        );
      },
    }));

  const context: AutomationContext = {
    composio: {
      execute: (toolSlug, args) => session.execute(toolSlug, args),
    },
    stagehand: stagehandOrThrow,
    log: () => {}, // overridden by engine at runtime
    store: {
      get: (key) => kvGet(automationId, key),
      set: (key, value) => kvSet(automationId, key, value),
    },
  };

  return {
    context,
    stagehand,
    cleanup: async () => {
      if (stagehand) await stagehand.close();
    },
  };
}
