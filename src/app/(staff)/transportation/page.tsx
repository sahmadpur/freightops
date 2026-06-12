import { getTranslations } from "next-intl/server";

export default async function TransportationPage() {
  const t = await getTranslations("nav");
  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-2">{t("transportation")}</h1>
      <p className="text-sm text-slate-500">Coming in Phase 2.</p>
    </div>
  );
}
