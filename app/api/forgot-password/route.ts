import { randomBytes, randomUUID } from "crypto";
import { getDb } from "@/lib/db/client";
import { sendPasswordResetEmail } from "@/lib/email";

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

    // Check if user exists — don't reveal result to client
    const users = await sql`
      SELECT id FROM neon_auth."user" WHERE email = ${email} LIMIT 1
    `;
    if (users.length === 0) {
      return Response.json({ success: true });
    }

    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const identifier = `reset-password:${email}`;

    // Remove any existing reset tokens for this email
    await sql`
      DELETE FROM neon_auth.verification WHERE identifier = ${identifier}
    `;

    // Insert new verification token
    await sql`
      INSERT INTO neon_auth.verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${identifier}, ${token}, ${expiresAt.toISOString()}, ${now.toISOString()}, ${now.toISOString()})
    `;

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch (emailError) {
      // Log email failure but don't reveal to client
      console.error("[forgot-password] Email send failed:", emailError);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
