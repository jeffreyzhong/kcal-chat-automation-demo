import { tool } from "ai";
import { z } from "zod";
import { schedules } from "@trigger.dev/sdk/v3";
import {
  insertAutomation,
  setScheduleId,
  getAutomation,
  listAutomations,
  updateAutomationCode,
  updateAutomationStatus,
  resetFailures,
  deleteAutomation,
  getAutomationRuns,
} from "../db/queries";

export function buildAutomationTools(userId: string) {
  return {
    save_automation: tool({
      description:
        "Save a new automation. Only call this after the user confirms the code. The source_code must be plain JavaScript (no TypeScript). It runs as an async function body with ctx and z as globals. For browser automation, use ctx.stagehand.agent({mode:'dom'}) — do NOT use ctx.stagehand.page (it does not exist in Stagehand v3) and do NOT chain multiple act() calls.",
      inputSchema: z.object({
        name: z.string().describe("Short name for the automation"),
        description: z
          .string()
          .optional()
          .describe("What this automation does"),
        schedule_cron: z
          .string()
          .describe('Cron expression, e.g. "*/15 * * * *"'),
        source_code: z
          .string()
          .describe(
            "Plain JavaScript async function body. Has access to ctx (AutomationContext) and z (Zod). No TypeScript, no imports, no return statements. Use agent() for browser flows, extract() for data.",
          ),
      }),
      execute: async ({ name, description, schedule_cron, source_code }) => {
        const auto = await insertAutomation({
          userId,
          name,
          description: description ?? null,
          scheduleCron: schedule_cron,
          sourceCode: source_code,
        });

        // Create dynamic schedule on Trigger.dev
        const schedule = await schedules.create({
          task: "run-automation",
          cron: schedule_cron,
          externalId: auto.id as string,
          deduplicationKey: auto.id as string,
        });

        await setScheduleId(auto.id as string, schedule.id);

        return {
          automation_id: auto.id,
          schedule_id: schedule.id,
          status: "active",
          message: `Automation "${name}" created and scheduled (${schedule_cron}).`,
        };
      },
    }),

    get_automation: tool({
      description:
        "Get the full details of an automation including its source code. Use this before editing.",
      inputSchema: z.object({
        automation_id: z.string().describe("The automation UUID"),
      }),
      execute: async ({ automation_id }) => {
        const auto = await getAutomation(automation_id);
        if (!auto) return { error: "Automation not found" };
        return {
          id: auto.id,
          name: auto.name,
          description: auto.description,
          schedule_cron: auto.schedule_cron,
          source_code: auto.source_code,
          status: auto.status,
          consecutive_failures: auto.consecutive_failures,
          created_at: auto.created_at,
          updated_at: auto.updated_at,
        };
      },
    }),

    update_automation_code: tool({
      description:
        "Update the source code (and optionally the cron schedule) of an existing automation. Show the diff to the user first.",
      inputSchema: z.object({
        automation_id: z.string().describe("The automation UUID"),
        source_code: z.string().describe("The updated plain JavaScript source code. Same rules as save_automation: no TypeScript, no imports, no return statements."),
        schedule_cron: z
          .string()
          .optional()
          .describe("New cron expression if the schedule is changing"),
      }),
      execute: async ({ automation_id, source_code, schedule_cron }) => {
        const auto = await getAutomation(automation_id);
        if (!auto) return { error: "Automation not found" };

        await updateAutomationCode(automation_id, source_code, schedule_cron);

        // Update Trigger.dev schedule if cron changed
        if (schedule_cron && auto.schedule_id) {
          await schedules.update(auto.schedule_id as string, {
            task: "run-automation",
            cron: schedule_cron,
          });
        }

        return {
          automation_id,
          message: `Automation updated.${schedule_cron ? ` Schedule changed to ${schedule_cron}.` : ""}`,
        };
      },
    }),

    list_automations: tool({
      description: "List all automations for the current user with their status, schedule, and last run info.",
      inputSchema: z.object({}),
      execute: async () => {
        const automations = await listAutomations(userId);
        return {
          count: automations.length,
          automations: automations.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            schedule_cron: a.schedule_cron,
            status: a.status,
            consecutive_failures: a.consecutive_failures,
            last_run: a.last_run,
          })),
        };
      },
    }),

    toggle_automation: tool({
      description: "Pause, resume, or delete an automation.",
      inputSchema: z.object({
        automation_id: z.string().describe("The automation UUID"),
        action: z.enum(["pause", "resume", "delete"]),
      }),
      execute: async ({ automation_id, action }) => {
        const auto = await getAutomation(automation_id);
        if (!auto) return { error: "Automation not found" };

        switch (action) {
          case "pause":
            await updateAutomationStatus(automation_id, "paused");
            if (auto.schedule_id) {
              await schedules.deactivate(auto.schedule_id as string);
            }
            return { message: `Automation "${auto.name}" paused.` };

          case "resume":
            await resetFailures(automation_id);
            if (auto.schedule_id) {
              await schedules.activate(auto.schedule_id as string);
            }
            return { message: `Automation "${auto.name}" resumed.` };

          case "delete":
            if (auto.schedule_id) {
              await schedules.del(auto.schedule_id as string);
            }
            await deleteAutomation(automation_id);
            return { message: `Automation "${auto.name}" deleted.` };
        }
      },
    }),

    get_automation_logs: tool({
      description: "Get recent execution logs for an automation.",
      inputSchema: z.object({
        automation_id: z.string().describe("The automation UUID"),
        limit: z
          .number()
          .optional()
          .describe("Number of recent runs to return (default 10)"),
      }),
      execute: async ({ automation_id, limit }) => {
        const runs = await getAutomationRuns(automation_id, limit ?? 10);
        return {
          automation_id,
          runs: runs.map((r) => ({
            id: r.id,
            status: r.status,
            started_at: r.started_at,
            completed_at: r.completed_at,
            duration_ms: r.duration_ms,
            error: r.error,
            logs: r.logs,
          })),
        };
      },
    }),
  };
}
