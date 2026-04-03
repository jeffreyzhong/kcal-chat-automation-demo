import { getDb } from "@/lib/db/client";
import { scrypt, randomBytes, type ScryptOptions } from "node:crypto";

/**
 * Promise wrapper for Node's scrypt that supports options.
 */
function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/**
 * Hash a password using the same scrypt parameters as Better Auth / Neon Auth.
 * Output format: `salt:key` (hex-encoded), identical to what Neon Auth stores.
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password.normalize("NFKC"), salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 128 * 16384 * 16 * 2,
  });
  return `${salt}:${key.toString("hex")}`;
}

export async function POST(request: Request) {
  try {
    const { token, newPassword } = (await request.json()) as {
      token?: string;
      newPassword?: string;
    };

    if (!token || !newPassword) {
      return Response.json(
        { error: "Token and new password are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const sql = getDb();

    // Look up the verification token (Better Auth format: identifier = "reset-password:{token}", value = userId)
    const identifier = `reset-password:${token}`;
    const verifications = await sql`
      SELECT id, value AS "userId", "expiresAt"
      FROM neon_auth.verification
      WHERE identifier = ${identifier}
      LIMIT 1
    `;

    if (verifications.length === 0) {
      return Response.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 },
      );
    }

    const verification = verifications[0];

    // Check expiry
    if (new Date(verification.expiresAt) < new Date()) {
      // Clean up expired token
      await sql`DELETE FROM neon_auth.verification WHERE id = ${verification.id}`;
      return Response.json(
        { error: "This reset link has expired. Please request a new one." },
        { status: 400 },
      );
    }

    const userId = verification.userId;

    // Find the credential account
    const accounts = await sql`
      SELECT a.id FROM neon_auth.account a
      WHERE a."userId" = ${userId}::uuid AND a."providerId" = 'credential'
      LIMIT 1
    `;

    if (accounts.length === 0) {
      return Response.json({ error: "Account not found" }, { status: 400 });
    }

    // Hash new password using the same scrypt parameters as Better Auth / Neon Auth
    const hashedPassword = await hashPassword(newPassword);

    // Update the credential account's password directly in the database
    await sql`
      UPDATE neon_auth.account
      SET password = ${hashedPassword}, "updatedAt" = NOW()
      WHERE id = ${accounts[0].id}
    `;

    // Mark email as verified (user proved ownership via the reset link)
    await sql`
      UPDATE neon_auth."user"
      SET "emailVerified" = true, "updatedAt" = NOW()
      WHERE id = ${userId}::uuid AND "emailVerified" = false
    `;

    // Delete the used verification token
    await sql`DELETE FROM neon_auth.verification WHERE id = ${verification.id}`;

    // Clean up any other reset tokens for this user
    await sql`
      DELETE FROM neon_auth.verification
      WHERE identifier LIKE 'reset-password:%' AND value = ${userId}
    `;

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[reset-password] Error:", err);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
