import { rmSync } from "fs";
import Browserbase from "@browserbasehq/sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import { Composio } from "@composio/core";
import { kvGet, kvSet } from "../db/queries";
import { getCacheDir, restoreCacheFromDb, saveCacheToDb } from "./cache";
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
  options?: { needsBrowser?: boolean; ephemeral?: boolean; persistBrowserContext?: boolean },
): Promise<{
  context: AutomationContext;
  stagehand: Stagehand | null;
  allStagehandInstances: Stagehand[];
  cleanup: () => Promise<void>;
  cacheLogs: string[];
}> {
  // Composio session for API-based tools (OneDrive, Gmail, etc.)
  const composio = new Composio();
  const session = await composio.create(userId);

  // Collect cache-related logs before ctx.log is wired up by the engine
  const cacheLogs: string[] = [];
  const cacheLog = (msg: string) => { cacheLogs.push(msg); };

  // Shared Stagehand config and instance tracking
  let stagehandConfig: ConstructorParameters<typeof Stagehand>[0] | null = null;
  const allInstances: Stagehand[] = [];
  let stagehand: Stagehand | null = null;

  if (options?.needsBrowser) {
    const ephemeral = options?.ephemeral ?? false;
    const cacheDir = getCacheDir(automationId, ephemeral);

    // Restore cache from DB for ephemeral environments (Trigger.dev)
    if (ephemeral) {
      await restoreCacheFromDb(automationId, cacheDir, cacheLog);
    }

    // Build browser settings — optionally persist cookies across runs
    const browserSettings: Record<string, unknown> = {
      solveCaptchas: true,
      blockAds: true,
    };

    if (options?.persistBrowserContext) {
      const browserbaseContextId =
        await getOrCreateBrowserbaseContext(automationId);
      browserSettings.context = {
        id: browserbaseContextId,
        persist: true,
      };
    }

    stagehandConfig = {
      env: "BROWSERBASE",
      model: "google/gemini-3-flash-preview",
      experimental: true,
      disableAPI: true,
      selfHeal: true,
      cacheDir,
      verbose: 0,
      disablePino: true,
      logger: () => {},
      waitForCaptchaSolves: true,
      browserbaseSessionCreateParams: {
        proxies: true,
        browserSettings,
      },
    };

  }

  // Factory to create browser instances (used by both ctx.stagehand and ctx.createStagehand)
  const createStagehand = async (): Promise<Stagehand> => {
    if (!stagehandConfig) {
      throw new Error(
        "Cannot create browser instances — this automation does not have browser access.",
      );
    }
    const instance = new Stagehand(stagehandConfig!);
    await instance.init();
    allInstances.push(instance);
    return instance;
  };

  const stagehandProxy = new Proxy({} as Stagehand, {
    get() {
      throw new Error(
        "ctx.stagehand is not available — use ctx.createStagehand() to create browser instances.",
      );
    },
  });

  const context: AutomationContext = {
    composio: {
      execute: (toolSlug, args) => session.execute(toolSlug, args),
    },
    stagehand: stagehandProxy,
    createStagehand,
    clearCache: () => {
      if (stagehandConfig && stagehandConfig.cacheDir) {
        try {
          rmSync(stagehandConfig.cacheDir as string, { recursive: true, force: true });
        } catch {
          // best-effort
        }
      }
    },
    log: () => {}, // overridden by engine at runtime
    store: {
      get: (key) => kvGet(automationId, key),
      set: (key, value) => kvSet(automationId, key, value),
    },
  };

  return {
    context,
    stagehand,
    allStagehandInstances: allInstances,
    cacheLogs,
    cleanup: async () => {
      // Persist cache to DB for ephemeral environments before closing browsers
      if (options?.ephemeral && options?.needsBrowser) {
        const cacheDir = getCacheDir(automationId, true);
        await saveCacheToDb(automationId, cacheDir, cacheLog);
      }
      // Close all browser instances (default + any created via factory)
      await Promise.allSettled(allInstances.map((s) => s.close()));
    },
  };
}
