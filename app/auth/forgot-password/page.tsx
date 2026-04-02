"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {submitted ? (
          <>
            <h1 className="mb-4 text-center text-2xl font-semibold text-foreground">
              Check your email
            </h1>
            <p className="mb-6 text-center text-sm text-muted">
              If an account exists with that email, we&apos;ve sent a password
              reset link. The link expires in 15 minutes.
            </p>
            <a
              href="/auth/sign-in"
              className="block text-center text-sm text-accent hover:underline"
            >
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-center text-2xl font-semibold text-foreground">
              Reset your password
            </h1>
            <p className="mb-6 text-center text-sm text-muted">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-border-light transition-colors"
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-muted">
              <a
                href="/auth/sign-in"
                className="text-accent hover:underline"
              >
                Back to sign in
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
