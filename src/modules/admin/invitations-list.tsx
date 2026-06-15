"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { revokeInvitation } from "./actions";

export function RevokeButton({ id }: { id: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await revokeInvitation(id);
          if (r.ok) router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="text-xs text-red-700 hover:underline disabled:opacity-40"
    >
      {t("revoke")}
    </button>
  );
}
