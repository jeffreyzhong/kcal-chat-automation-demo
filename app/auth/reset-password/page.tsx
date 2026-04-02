"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [token] = useState<string | null>(() => searchParams.get("token"));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Clear token from URL to prevent leaking via history/referrer
    if (token) {
      window.history.replaceState({}, "", "/auth/reset-password");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token: token!,
      });

      if (resetError) {
        setError(
          resetError.message ||
            "This reset link has expired or has already been used."
        );
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-2xl font-semibold text-foreground">
          Password reset!
        </h1>
        <p className="mb-6 text-center text-sm text-muted">
          Your password has been updated. You can now sign in with your new
          password.
        </p>
        <a
          href="/auth/sign-in"
          className="block rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-2xl font-semibold text-foreground">
          Invalid reset link
        </h1>
        <p className="mb-6 text-center text-sm text-muted">
          This password reset link is invalid or has expired.
        </p>
        <a
          href="/auth/forgot-password"
          className="block text-center text-sm text-accent hover:underline"
        >
          Request a new reset link
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-2 text-center text-2xl font-semibold text-foreground">
        Set new password
      </h1>
      <p className="mb-6 text-center text-sm text-muted">
        Enter your new password below.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-border-light transition-colors"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-border-light transition-colors"
        />

        {error && (
          <div>
            <p className="text-sm text-red-400">{error}</p>
            {error.includes("expired") || error.includes("already been used") ? (
              <a
                href="/auth/forgot-password"
                className="mt-1 block text-sm text-accent hover:underline"
              >
                Request a new reset link
              </a>
            ) : null}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex h-full items-center justify-center bg-background px-4">
      <Suspense
        fallback={
          <div className="w-full max-w-sm">
            <p className="text-center text-sm text-muted">Loading...</p>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
