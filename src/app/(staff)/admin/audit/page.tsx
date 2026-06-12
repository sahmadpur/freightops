import { getTranslations } from "next-intl/server";

export default async function AuditPage() {
  const t = await getTranslations("nav");
  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-2">{t("audit")}</h1>
      <p className="text-sm text-slate-500">Coming in Phase 5.</p>
    </div>
  );
}
