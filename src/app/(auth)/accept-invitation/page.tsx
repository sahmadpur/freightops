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
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
          Set up your account
        </h1>
        <p className="mt-1 text-sm text-slate-500">
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
