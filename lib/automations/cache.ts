import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { kvGet, kvSet } from "../db/queries";

interface CachePayload {
  files: Record<string, unknown>;
  savedAt: string;
}

type LogFn = (message: string) => void;

const DEFAULT_TTL_DAYS = 7;

function getTtlMs(): number {
  const envVal = process.env.STAGEHAND_CACHE_TTL_DAYS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed * 24 * 60 * 60 * 1000;
    }
  }
  return DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Compute the cache directory path for an automation.
 *
 * - Local (ephemeral=false): project-relative `.cache/stagehand/<id>` — persists across runs
 * - Trigger.dev (ephemeral=true): `os.tmpdir()/stagehand-cache/<id>` — survives within a single run
 */
export function getCacheDir(automationId: string, ephemeral: boolean): string {
  if (ephemeral) {
    return join(tmpdir(), "stagehand-cache", automationId);
  }
  return resolve(process.cwd(), ".cache", "stagehand", automationId);
}

/**
 * Restore Stagehand cache files from the DB KV store to the filesystem.
 * Never throws — cache restore failure should not block automation execution.
 */
export async function restoreCacheFromDb(
  automationId: string,
  cacheDir: string,
  log: LogFn,
): Promise<void> {
  try {
    const raw = await kvGet(automationId, "stagehand_cache");
    if (!raw || typeof raw !== "object") {
      log("Cache: no cached agent data found, starting fresh");
      return;
    }

    const payload = raw as CachePayload;
    if (!payload.files || !payload.savedAt) {
      log("Cache: stored data is malformed (missing files or savedAt), starting fresh");
      return;
    }

    // Check TTL
    const ageMs = Date.now() - new Date(payload.savedAt).getTime();
    const ttlMs = getTtlMs();
    const ageDays = Math.round(ageMs / (24 * 60 * 60 * 1000));
    const ttlDays = Math.round(ttlMs / (24 * 60 * 60 * 1000));

    if (ageMs > ttlMs) {
      log(`Cache: expired (${ageDays}d old, TTL=${ttlDays}d), starting fresh`);
      return;
    }

    // Write files to cache directory
    mkdirSync(cacheDir, { recursive: true });

    const fileNames = Object.keys(payload.files);
    let restored = 0;

    for (const fileName of fileNames) {
      try {
        const filePath = join(cacheDir, fileName);
        writeFileSync(filePath, JSON.stringify(payload.files[fileName], null, 2));
        restored++;
      } catch (err) {
        log(`Cache: failed to write ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const sizeKb = (Buffer.byteLength(JSON.stringify(payload.files)) / 1024).toFixed(1);
    log(`Cache: restored ${restored} file(s) from DB (${sizeKb}kb, saved ${ageDays}d ago)`);
  } catch (err) {
    log(`Cache: restore failed: ${err instanceof Error ? err.message : String(err)}, continuing without cache`);
  }
}

/**
 * Save Stagehand cache files from the filesystem to the DB KV store.
 * Never throws — cache save failure should not block automation completion.
 */
export async function saveCacheToDb(
  automationId: string,
  cacheDir: string,
  log: LogFn,
): Promise<void> {
  try {
    if (!existsSync(cacheDir)) {
      return;
    }

    const entries = readdirSync(cacheDir).filter((f) => f.endsWith(".json"));
    if (entries.length === 0) {
      return;
    }

    const files: Record<string, unknown> = {};
    for (const fileName of entries) {
      try {
        const content = readFileSync(join(cacheDir, fileName), "utf-8");
        files[fileName] = JSON.parse(content);
      } catch (err) {
        log(`Cache: skipping corrupted file ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (Object.keys(files).length === 0) {
      return;
    }

    const serialized = JSON.stringify(files);
    const sizeKb = Buffer.byteLength(serialized) / 1024;
    const MAX_SIZE_KB = 500;

    if (sizeKb > MAX_SIZE_KB) {
      log(`Cache: too large (${sizeKb.toFixed(1)}kb > ${MAX_SIZE_KB}kb limit), skipping DB persistence`);
      return;
    }

    const payload: CachePayload = {
      files,
      savedAt: new Date().toISOString(),
    };

    await kvSet(automationId, "stagehand_cache", payload);
    log(`Cache: saved ${Object.keys(files).length} file(s) to DB (${sizeKb.toFixed(1)}kb)`);
  } catch (err) {
    log(`Cache: save failed: ${err instanceof Error ? err.message : String(err)}, cache will not persist across runs`);
  }
}
