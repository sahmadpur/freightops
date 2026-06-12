import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { AccountForm } from "@/modules/accounts/account-form";

export default async function NewAccountPage() {
  const t = await getTranslations("accounts");
  return (
    <div>
      <PageHeader title={t("newAccount")} />
      <AccountForm initial={{ title: "", taxId: "", address: "", notes: "", contacts: [] }} />
    </div>
  );
}
