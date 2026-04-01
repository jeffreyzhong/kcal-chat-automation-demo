import { sql } from "@/lib/db";
import { requireUserId } from "@/lib/auth/require-user";

// GET /api/conversations/:id/messages — load messages for a conversation
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  // Verify ownership via join
  const rows = await sql`
    SELECT m.id, m.role, m.parts, m.created_at
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.conversation_id = ${id} AND c.user_id = ${userId}
    ORDER BY m.created_at ASC
  `;
  return Response.json(rows);
}

// POST /api/conversations/:id/messages — save a message
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  // Verify ownership
  const conv = await sql`
    SELECT id FROM conversations WHERE id = ${id} AND user_id = ${userId}
  `;
  if (conv.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { role, parts } = await req.json();
  const rows = await sql`
    INSERT INTO messages (conversation_id, role, parts)
    VALUES (${id}, ${role}, ${JSON.stringify(parts)})
    RETURNING id, role, parts, created_at
  `;
  await sql`
    UPDATE conversations SET updated_at = now() WHERE id = ${id}
  `;
  return Response.json(rows[0]);
}
