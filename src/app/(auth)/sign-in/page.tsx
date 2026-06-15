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
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to your operations workspace.
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
