"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptInvitation } from "./actions";

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
      <h1 className="text-lg font-semibold text-slate-900">Set up your account</h1>
      <div>
        <label className="block text-xs text-slate-500 mb-1" htmlFor="name">Full name</label>
        <input
          id="name" required value={name} onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1" htmlFor="password">Password (min 8 chars)</label>
        <input
          id="password" type="password" required minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit" disabled={pending}
        className="w-full rounded-lg bg-[#1a3a5c] text-white py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Creating account..." : "Create account"}
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
