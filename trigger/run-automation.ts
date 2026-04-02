import { schedules } from "@trigger.dev/sdk/v3";
import {
  getActiveAutomation,
  insertRun,
  completeRun,
  incrementFailures,
  clearFailures,
} from "../lib/db/queries";
import { executeAutomation } from "../lib/automations/engine";
import { buildContext } from "../lib/automations/context";

export const runAutomation = schedules.task({
  id: "run-automation",
  // No static cron — schedules are created dynamically per automation via schedules.create()
  run: async (payload) => {
    const automationId = payload.externalId;
    if (!automationId) return;

    // Load automation from DB
    const auto = await getActiveAutomation(automationId);
    if (!auto) return;

    // Create run record
    const run = await insertRun(automationId, payload.scheduleId);

    // Only create a Browserbase session if the automation uses ctx.stagehand
    const sourceCode = auto.source_code as string;
    const needsBrowser = sourceCode.includes("stagehand");

    const { context, stagehand, cleanup } = await buildContext(
      auto.user_id as string,
      automationId,
      { needsBrowser },
    );

    try {
      const result = await executeAutomation(sourceCode, context);

      // Capture a final screenshot if a browser was used
      let screenshotBase64: string | undefined;
      if (stagehand) {
        try {
          const page = stagehand.context.activePage();
          if (page) {
            const buffer = await page.screenshot({ type: "jpeg", quality: 70 });
            screenshotBase64 = buffer.toString("base64");
          }
        } catch {
          // Screenshot is best-effort — don't fail the run if it errors
        }
      }

      // Record result
      await completeRun(run.id as string, result, screenshotBase64);

      // Track failures
      if (result.error) {
        const { newStatus } = await incrementFailures(
          automationId,
          auto.consecutive_failures as number,
        );
        // Auto-deactivate Trigger.dev schedule after 3 consecutive failures
        if (newStatus === "error" && auto.schedule_id) {
          await schedules.deactivate(auto.schedule_id as string);
        }
      } else {
        await clearFailures(automationId);
      }
    } finally {
      await cleanup();
    }
  },
});
