/**
 * Run an automation locally for development/testing.
 *
 * Usage:
 *   npx tsx scripts/run-local.ts <automationId or alias>
 *   npx tsx scripts/run-local.ts mercury --rows 2-5,8
 *   npx tsx scripts/run-local.ts progressive --no-browser
 *
 * Aliases: mercury, safeco, progressive
 *
 * Requires DATABASE_URL (and BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, COMPOSIO_API_KEY
 * if the automation uses browser/composio features) in .env.local.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local ──
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const envPath = join(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

import { neon } from "@neondatabase/serverless";
import { executeAutomation } from "../lib/automations/engine";
import { buildContext } from "../lib/automations/context";

const sql = neon(process.env.DATABASE_URL!);

const ALIASES: Record<string, string> = {
  mercury: "26c8311a-3409-41c7-b8df-bbe28fb57451",
  safeco: "f32a6315-34a4-4d7a-b484-c1243b596eac",
  progressive: "4fd8f411-3e3a-4d57-a807-90a96bd2563d",
};

async function main() {
  const args = process.argv.slice(2);
  const noBrowser = args.includes("--no-browser");
  const rowsIdx = args.indexOf("--rows");
  const rowsOverride = rowsIdx >= 0 ? args[rowsIdx + 1] : undefined;
  const rawId = args.find((a) => !a.startsWith("--") && (rowsIdx < 0 || a !== args[rowsIdx + 1]));

  if (!rawId) {
    console.error("Usage: npx tsx scripts/run-local.ts <automationId or alias> [--rows 2-5,8] [--no-browser]");
    console.error(`Aliases: ${Object.keys(ALIASES).join(", ")}`);
    process.exit(1);
  }

  const automationId = ALIASES[rawId.toLowerCase()] || rawId;

  // Load automation from DB
  const [auto] = await sql`SELECT * FROM automations WHERE id = ${automationId}`;
  if (!auto) {
    console.error(`Automation ${automationId} not found in database.`);
    process.exit(1);
  }

  let sourceCode = auto.source_code as string;

  // Override ROW_SPEC if --rows was provided
  if (rowsOverride) {
    sourceCode = sourceCode.replace(
      /^(const ROW_SPEC\s*=\s*)".+?"/m,
      `$1"${rowsOverride}"`,
    );
  }

  const needsBrowser = !noBrowser && (sourceCode.includes("stagehand") || sourceCode.includes("Stagehand"));
  const persistBrowserContext = sourceCode.includes("PERSIST_BROWSER_CONTEXT = true");

  console.log(`Running: ${auto.name}`);
  console.log(`ID: ${automationId}`);
  if (rowsOverride) console.log(`Rows: ${rowsOverride}`);
  console.log(`Browser: ${needsBrowser ? "yes" : "no"}`);
  console.log("─".repeat(60));

  const { context, allStagehandInstances, cacheLogs, cleanup } = await buildContext(
    auto.user_id as string,
    automationId,
    { needsBrowser, persistBrowserContext },
  );

  try {
    const result = await executeAutomation(sourceCode, context, {
      allStagehandInstances,
      cacheLogs,
    });

    // Print logs as they were captured
    for (const entry of result.logs) {
      const prefix = entry.level === "error" ? "ERROR" : "LOG";
      console.log(`[${prefix}] ${entry.message}`);
    }

    console.log("─".repeat(60));
    console.log(`Duration: ${(result.durationMs / 1000).toFixed(1)}s`);

    if (result.error) {
      console.error(`Failed: ${result.error}`);
      process.exit(1);
    } else {
      console.log("Done.");
    }
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
