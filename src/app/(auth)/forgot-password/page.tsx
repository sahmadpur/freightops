"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth-client";
import { Field, inputCls } from "@/components/ui/form";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await requestPasswordReset({ email, redirectTo: "/reset-password" });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-[21px] font-medium tracking-[-0.02em] text-brand-deep">
          Forgot your password?
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-soft">
          Enter your email and we&rsquo;ll send you a reset link.
        </p>
      </div>
      {submitted ? (
        <div className="space-y-4">
          <p className="text-[13.5px] text-ink">
            If an account exists for {email}, we&rsquo;ve sent a password reset
            link. Check your inbox.
          </p>
          <Link
            href="/sign-in"
            className="text-[13px] text-ink-soft underline-offset-2 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </Field>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Sending…" : "Send reset link"}
          </button>
          <div className="flex justify-center">
            <Link
              href="/sign-in"
              className="text-[13px] text-ink-soft underline-offset-2 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
