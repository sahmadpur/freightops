"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
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
    const { error } = await signIn.email({ email, password });
    setPending(false);
    if (error) {
      setError(error.message ?? "Sign-in failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mb-7">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-px w-4 bg-brand-accent" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">
            Sign in
          </span>
        </div>
        <h1 className="font-display text-[34px] font-light leading-[1.05] tracking-[-0.01em] text-brand-deep">
          Welcome back
        </h1>
        <p className="mt-2 text-[13.5px] text-ink-soft">
          Open your operations desk.
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
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
