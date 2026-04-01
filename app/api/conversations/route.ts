import { sql } from "@/lib/db";
import { requireUserId } from "@/lib/auth/require-user";

// GET /api/conversations — list user's conversations
export async function GET() {
  const userId = await requireUserId();
  const rows = await sql`
    SELECT id, title, updated_at
    FROM conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return Response.json(rows);
}

// POST /api/conversations — create a new conversation
export async function POST() {
  const userId = await requireUserId();
  const rows = await sql`
    INSERT INTO conversations (title, user_id)
    VALUES ('New chat', ${userId})
    RETURNING id, title, updated_at
  `;
  return Response.json(rows[0]);
}
