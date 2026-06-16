"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptInvitation } from "./actions";
import { Field, inputCls } from "@/components/ui/form";

function AcceptForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await acceptInvitation({ token, name, password });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/sign-in");
  }

  if (!token) return <p className="text-sm text-red-700">Missing invitation token.</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mb-7">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-px w-4 bg-brand-accent" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">
            New account
          </span>
        </div>
        <h1 className="font-display text-[34px] font-light leading-[1.05] tracking-[-0.01em] text-brand-deep">
          Set up your account
        </h1>
        <p className="mt-2 text-[13.5px] text-ink-soft">
          Choose a name and password to get started.
        </p>
      </div>
      <Field label="Full name" htmlFor="name">
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="Password (min 8 chars)" htmlFor="password">
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </Field>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptForm />
    </Suspense>
  );
}
