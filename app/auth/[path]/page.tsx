"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export default function AuthPage() {
  const params = useParams();
  const router = useRouter();
  const isSignUp = params.path === "sign-up";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        });
        if (error) {
          setError(error.message ?? "Sign up failed");
          return;
        }
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) {
          setError(error.message ?? "Sign in failed");
          return;
        }
      }
      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-foreground">
          {isSignUp ? "Create an account" : "Welcome back"}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {isSignUp && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-border-light transition-colors"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-border-light transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-border-light transition-colors"
          />

          {!isSignUp && (
            <a
              href="/auth/forgot-password"
              className="text-sm text-muted hover:text-accent transition-colors"
            >
              Forgot password?
            </a>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {loading
              ? "Loading..."
              : isSignUp
                ? "Sign up"
                : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <a href="/auth/sign-in" className="text-accent hover:underline">
                Sign in
              </a>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <a href="/auth/sign-up" className="text-accent hover:underline">
                Sign up
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
