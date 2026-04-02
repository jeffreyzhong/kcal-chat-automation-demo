import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: "Reset your password",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #e5e5e5; font-size: 20px; margin-bottom: 16px;">Reset your password</h2>
        <p style="color: #a3a3a3; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset your password. Click the button below to choose a new one. This link expires in 15 minutes.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Reset password
        </a>
        <p style="color: #737373; font-size: 12px; line-height: 1.5; margin-top: 32px;">
          If you didn't request this, you can safely ignore this email. Your password won't be changed.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[email] Failed to send password reset email:", error);
    throw error;
  }
}
