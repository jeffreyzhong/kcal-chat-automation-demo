import { sql } from "@/lib/db";
import { requireUserId } from "@/lib/auth/require-user";

// DELETE /api/conversations/:id
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  await sql`DELETE FROM conversations WHERE id = ${id} AND user_id = ${userId}`;
  return new Response(null, { status: 204 });
}

// PATCH /api/conversations/:id — update title
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  const { id } = await params;
  const { title } = await req.json();
  const rows = await sql`
    UPDATE conversations SET title = ${title}, updated_at = now()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id, title, updated_at
  `;
  return Response.json(rows[0]);
}
