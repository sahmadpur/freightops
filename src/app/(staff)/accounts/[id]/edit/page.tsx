import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { AccountForm } from "@/modules/accounts/account-form";
import { getAccount } from "@/modules/accounts/queries";

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("accounts");
  const data = await getAccount(id);
  if (!data) notFound();

  return (
    <div>
      <PageHeader title={t("editAccount")} />
      <AccountForm
        initial={{
          id: data.account.id,
          title: data.account.title,
          roles: data.account.roles,
          taxId: data.account.taxId ?? "",
          address: data.account.address ?? "",
          country: data.account.country ?? "",
          city: data.account.city ?? "",
          phones: data.account.phones,
          emailDomains: data.account.emailDomains,
          notes: data.account.notes ?? "",
          contacts: data.contacts.map((c) => ({
            id: c.id,
            name: c.name,
            position: c.position ?? "",
            phones: c.phones.length ? c.phones : [""],
            emails: c.emails.length ? c.emails : [""],
            whatsapp: c.whatsapp ?? "",
            preferredChannel: c.preferredChannel ?? "",
            notes: c.notes ?? "",
          })),
        }}
      />
    </div>
  );
}
