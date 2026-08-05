"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth-client";
import { Field, inputCls } from "@/components/ui/form";

function InvalidLink() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-red-700">
        This reset link is invalid or has expired.
      </p>
      <Link
        href="/forgot-password"
        className="text-[13px] text-ink-soft underline-offset-2 hover:underline"
      >
        Request a new link
      </Link>
    </div>
  );
}

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const errorParam = params.get("error");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invalidToken, setInvalidToken] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPending(true);
    setError(null);
    const { error } = await resetPassword({ newPassword: password, token });
    setPending(false);
    if (error) {
      if (error.code === "INVALID_TOKEN") {
        setInvalidToken(true);
      } else {
        setError(error.message ?? "Reset failed");
      }
      return;
    }
    router.push("/sign-in");
  }

  const showInvalid = !token || errorParam === "INVALID_TOKEN" || invalidToken;

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-[21px] font-medium tracking-[-0.02em] text-brand-deep">
          Choose a new password
        </h2>
        <p className="mt-1.5 text-[13px] text-ink-soft">
          Set a new password for your account.
        </p>
      </div>
      {showInvalid ? (
        <InvalidLink />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="New password (min 8 chars)" htmlFor="password">
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
            {pending ? "Saving…" : "Set new password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
