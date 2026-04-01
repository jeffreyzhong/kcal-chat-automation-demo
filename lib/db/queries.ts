import { getDb } from "./client";

// ── Automations ──

export async function insertAutomation(params: {
  userId: string;
  name: string;
  description: string | null;
  scheduleCron: string;
  sourceCode: string;
}) {
  const sql = getDb();
  const [row] = await sql`
    INSERT INTO automations (user_id, name, description, schedule_cron, source_code)
    VALUES (${params.userId}, ${params.name}, ${params.description}, ${params.scheduleCron}, ${params.sourceCode})
    RETURNING *
  `;
  return row;
}

export async function setScheduleId(automationId: string, scheduleId: string) {
  const sql = getDb();
  await sql`
    UPDATE automations SET schedule_id = ${scheduleId} WHERE id = ${automationId}
  `;
}

export async function getAutomation(automationId: string) {
  const sql = getDb();
  const [row] = await sql`SELECT * FROM automations WHERE id = ${automationId}`;
  return row ?? null;
}

export async function getActiveAutomation(automationId: string) {
  const sql = getDb();
  const [row] = await sql`
    SELECT * FROM automations WHERE id = ${automationId} AND status = 'active'
  `;
  return row ?? null;
}

export async function listAutomations(userId: string) {
  const sql = getDb();
  return sql`
    SELECT a.*,
      (SELECT row_to_json(r) FROM (
        SELECT id, status, started_at, completed_at, duration_ms, error
        FROM automation_runs WHERE automation_id = a.id ORDER BY started_at DESC LIMIT 1
      ) r) AS last_run
    FROM automations a
    WHERE a.user_id = ${userId}
    ORDER BY a.created_at DESC
  `;
}

export async function updateAutomationCode(
  automationId: string,
  sourceCode: string,
  scheduleCron?: string,
) {
  const sql = getDb();
  if (scheduleCron) {
    await sql`
      UPDATE automations
      SET source_code = ${sourceCode}, schedule_cron = ${scheduleCron}, updated_at = now()
      WHERE id = ${automationId}
    `;
  } else {
    await sql`
      UPDATE automations SET source_code = ${sourceCode}, updated_at = now()
      WHERE id = ${automationId}
    `;
  }
}

export async function updateAutomationStatus(automationId: string, status: string) {
  const sql = getDb();
  await sql`UPDATE automations SET status = ${status}, updated_at = now() WHERE id = ${automationId}`;
}

export async function resetFailures(automationId: string) {
  const sql = getDb();
  await sql`
    UPDATE automations SET consecutive_failures = 0, status = 'active', updated_at = now()
    WHERE id = ${automationId}
  `;
}

export async function incrementFailures(automationId: string, currentFailures: number) {
  const sql = getDb();
  const newCount = currentFailures + 1;
  const newStatus = newCount >= 3 ? "error" : "active";
  await sql`
    UPDATE automations
    SET consecutive_failures = ${newCount}, status = ${newStatus}, updated_at = now()
    WHERE id = ${automationId}
  `;
  return { newCount, newStatus };
}

export async function clearFailures(automationId: string) {
  const sql = getDb();
  await sql`
    UPDATE automations SET consecutive_failures = 0, updated_at = now()
    WHERE id = ${automationId}
  `;
}

export async function deleteAutomation(automationId: string) {
  const sql = getDb();
  await sql`DELETE FROM automations WHERE id = ${automationId}`;
}

// ── Automation Runs ──

export async function insertRun(automationId: string, triggerRunId?: string) {
  const sql = getDb();
  const [row] = await sql`
    INSERT INTO automation_runs (automation_id, trigger_run_id)
    VALUES (${automationId}, ${triggerRunId ?? null})
    RETURNING id
  `;
  return row;
}

export async function completeRun(
  runId: string,
  result: { logs: unknown[]; error?: string; durationMs: number },
) {
  const sql = getDb();
  await sql`
    UPDATE automation_runs SET
      status = ${result.error ? "failed" : "completed"},
      logs = ${JSON.stringify(result.logs)},
      error = ${result.error ?? null},
      completed_at = now(),
      duration_ms = ${result.durationMs}
    WHERE id = ${runId}
  `;
}

export async function getAutomationRuns(automationId: string, limit = 10) {
  const sql = getDb();
  return sql`
    SELECT * FROM automation_runs
    WHERE automation_id = ${automationId}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
}

// ── KV Store ──

export async function kvGet(automationId: string, key: string) {
  const sql = getDb();
  const [row] = await sql`
    SELECT kv_store->${key} AS val FROM automations WHERE id = ${automationId}
  `;
  return row?.val ?? null;
}

export async function kvSet(automationId: string, key: string, value: unknown) {
  const sql = getDb();
  await sql`
    UPDATE automations
    SET kv_store = jsonb_set(COALESCE(kv_store, '{}'), ${`{${key}}`}::text[], ${JSON.stringify(value)}::jsonb)
    WHERE id = ${automationId}
  `;
}
