"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { homeFor, isRole } from "@/lib/roles";
import { Field, inputCls } from "@/components/ui/form";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { data, error } = await signIn.email({ email, password });
    setPending(false);
    if (error) {
      setError(error.message ?? "Sign-in failed");
      return;
    }
    // Go straight to the role's home. `/` only exists to work that out, and
    // routing through it costs an extra round trip on every sign-in. The role
    // isn't in the auth client's user type (it's a server-set field), hence the
    // guard — an unexpected value falls back to `/`.
    const role = (data?.user as { role?: unknown } | undefined)?.role;
    router.push(isRole(role) ? homeFor(role) : "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mb-6">
        <h2 className="font-display text-[21px] font-medium tracking-[-0.02em] text-brand-deep">
          Welcome back
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-soft">
          Sign in to your operations desk.
        </p>
      </div>
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
      <Field label="Password" htmlFor="password">
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </Field>
      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-[13px] text-ink-soft underline-offset-2 hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
