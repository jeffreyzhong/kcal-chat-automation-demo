import { getDb } from "@/lib/db/client";

/**
 * After a successful password reset, mark the user's email as verified.
 * They proved ownership by clicking the emailed reset link.
 */
export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const sql = getDb();
    await sql`
      UPDATE neon_auth."user"
      SET "emailVerified" = true, "updatedAt" = NOW()
      WHERE email = ${email} AND "emailVerified" = false
    `;
    return Response.json({ success: true });
  } catch (error) {
    console.error("[verify-email-on-reset] Error:", error);
    return Response.json({ error: "Failed to verify email" }, { status: 500 });
  }
}
