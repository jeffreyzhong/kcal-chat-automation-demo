import Browserbase from "@browserbasehq/sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import { Composio } from "@composio/core";
import { kvGet, kvSet } from "../db/queries";
import type { AutomationContext } from "./types";

/**
 * Get or create a persistent Browserbase context for this automation.
 * Contexts persist cookies, localStorage, and session state across runs
 * so the browser looks like a returning user, not a fresh bot.
 */
async function getOrCreateBrowserbaseContext(
  automationId: string,
): Promise<string> {
  const existing = await kvGet(automationId, "browserbase_context_id");
  if (existing && typeof existing === "string") {
    return existing;
  }

  const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  const ctx = await bb.contexts.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });

  await kvSet(automationId, "browserbase_context_id", ctx.id);
  return ctx.id;
}

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
    // Get or create a persistent browser context for this automation
    const browserbaseContextId =
      await getOrCreateBrowserbaseContext(automationId);

    stagehand = new Stagehand({
      env: "BROWSERBASE",
      model: "google/gemini-3-flash-preview",
      verbose: 0,
      disablePino: true,
      logger: () => {},
      waitForCaptchaSolves: true,
      browserbaseSessionCreateParams: {
        proxies: true,
        browserSettings: {
          solveCaptchas: true,
          blockAds: true,
          context: {
            id: browserbaseContextId,
            persist: true, // save cookies/state back after each run
          },
        },
      },
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
