/**
 * Sync automations between Neon database and local files.
 *
 * Usage:
 *   npx tsx scripts/sync-automations.ts pull [--user <userId>]
 *   npx tsx scripts/sync-automations.ts push [automationId...]
 *
 * pull  — Fetch all automations from DB and write to automations/<slug>/
 * push  — Read local files and update DB (+ Trigger.dev schedule if cron changed)
 *
 * Requires DATABASE_URL in .env.local (or environment).
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";
import { schedules } from "@trigger.dev/sdk/v3";

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

const AUTOMATIONS_DIR = join(ROOT, "automations");
const sql = neon(process.env.DATABASE_URL!);

// ── Helpers ──

function slugify(name: string, id: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // Append first 8 chars of UUID for uniqueness
  return `${slug}-${id.slice(0, 8)}`;
}

function readMeta(dir: string) {
  const metaPath = join(dir, "meta.json");
  if (!existsSync(metaPath)) return null;
  return JSON.parse(readFileSync(metaPath, "utf-8"));
}

function readCode(dir: string): string | null {
  const codePath = join(dir, "code.js");
  if (!existsSync(codePath)) return null;
  return readFileSync(codePath, "utf-8");
}

function writeAutomationFiles(dir: string, automation: Record<string, unknown>, sourceCode: string) {
  mkdirSync(dir, { recursive: true });

  const meta = {
    id: automation.id,
    name: automation.name,
    description: automation.description,
    schedule_cron: automation.schedule_cron,
    status: automation.status,
    schedule_id: automation.schedule_id,
    created_at: automation.created_at,
    updated_at: automation.updated_at,
  };

  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  writeFileSync(join(dir, "code.js"), sourceCode);
}

// ── Pull: DB → Files ──

async function pull(userId?: string) {
  let rows: Record<string, unknown>[];
  if (userId) {
    rows = await sql`SELECT * FROM automations WHERE user_id = ${userId} ORDER BY created_at DESC`;
  } else {
    rows = await sql`SELECT * FROM automations ORDER BY created_at DESC`;
  }

  if (rows.length === 0) {
    console.log("No automations found in database.");
    return;
  }

  mkdirSync(AUTOMATIONS_DIR, { recursive: true });

  // Build a set of expected slugs so we can report stale dirs
  const slugs = new Set<string>();

  for (const row of rows) {
    const slug = slugify(row.name as string, row.id as string);
    slugs.add(slug);
    const dir = join(AUTOMATIONS_DIR, slug);
    writeAutomationFiles(dir, row, row.source_code as string);
    console.log(`  ✓ ${slug}`);
  }

  console.log(`\nPulled ${rows.length} automation(s) to automations/`);

  // Check for local dirs that no longer exist in DB
  if (existsSync(AUTOMATIONS_DIR)) {
    for (const entry of readdirSync(AUTOMATIONS_DIR)) {
      if (!slugs.has(entry)) {
        const meta = readMeta(join(AUTOMATIONS_DIR, entry));
        if (meta?.id) {
          console.log(`  ⚠ ${entry}/ — not in DB (may have been deleted)`);
        }
      }
    }
  }
}

// ── Push: Files → DB ──

async function push(ids?: string[]) {
  if (!existsSync(AUTOMATIONS_DIR)) {
    console.error("No automations/ directory found. Run 'pull' first.");
    process.exit(1);
  }

  const dirs = readdirSync(AUTOMATIONS_DIR).filter((d) => {
    const meta = readMeta(join(AUTOMATIONS_DIR, d));
    if (!meta?.id) return false;
    if (ids && ids.length > 0) return ids.includes(meta.id);
    return true;
  });

  if (dirs.length === 0) {
    console.log("No automations to push.");
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const dirName of dirs) {
    const dir = join(AUTOMATIONS_DIR, dirName);
    const meta = readMeta(dir);
    const localCode = readCode(dir);

    if (!meta?.id || localCode === null) {
      console.log(`  ⚠ ${dirName}/ — missing meta.json or code.js, skipping`);
      skipped++;
      continue;
    }

    // Fetch current state from DB
    const [dbRow] = await sql`SELECT * FROM automations WHERE id = ${meta.id}`;
    if (!dbRow) {
      console.log(`  ⚠ ${dirName}/ — automation ${meta.id} not found in DB, skipping`);
      skipped++;
      continue;
    }

    const codeChanged = localCode !== dbRow.source_code;
    const cronChanged = meta.schedule_cron !== dbRow.schedule_cron;

    if (!codeChanged && !cronChanged) {
      console.log(`  · ${dirName} — no changes`);
      skipped++;
      continue;
    }

    // Update DB
    if (cronChanged) {
      await sql`
        UPDATE automations
        SET source_code = ${localCode}, schedule_cron = ${meta.schedule_cron}, updated_at = now()
        WHERE id = ${meta.id}
      `;
    } else {
      await sql`
        UPDATE automations SET source_code = ${localCode}, updated_at = now()
        WHERE id = ${meta.id}
      `;
    }

    // Update Trigger.dev schedule if cron changed
    if (cronChanged && dbRow.schedule_id) {
      try {
        await schedules.update(dbRow.schedule_id as string, {
          task: "run-automation",
          cron: meta.schedule_cron,
        });
        console.log(`  ✓ ${dirName} — code + schedule updated`);
      } catch (err) {
        console.log(`  ✓ ${dirName} — code updated (schedule sync failed: ${err})`);
      }
    } else {
      console.log(`  ✓ ${dirName} — code updated`);
    }

    updated++;
  }

  console.log(`\nPushed: ${updated} updated, ${skipped} skipped`);
}

// ── CLI ──

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "pull": {
      const userIdx = args.indexOf("--user");
      const userId = userIdx >= 0 ? args[userIdx + 1] : undefined;
      await pull(userId);
      break;
    }
    case "push": {
      const ids = args.filter((a) => !a.startsWith("--"));
      await push(ids.length > 0 ? ids : undefined);
      break;
    }
    default:
      console.log(`Usage:
  npx tsx scripts/sync-automations.ts pull [--user <userId>]
  npx tsx scripts/sync-automations.ts push [automationId...]

pull  — Download all automations from DB to automations/
push  — Upload local code/cron changes back to DB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
