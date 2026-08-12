import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { COMPANY_ROLES, type CompanyRole } from "@/lib/company-roles";
import { AccountForm } from "@/modules/accounts/account-form";

export default async function NewAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const t = await getTranslations("accounts");
  // "/accounts/new?role=carrier" — how /carriers/new pre-selects the role.
  const roles: CompanyRole[] = (COMPANY_ROLES as readonly string[]).includes(role ?? "")
    ? [role as CompanyRole]
    : ["client"];
  return (
    <div>
      <PageHeader title={t("newAccount")} />
      <AccountForm
        initial={{
          title: "",
          roles,
          taxId: "",
          address: "",
          country: "",
          city: "",
          phones: [],
          emailDomains: [],
          notes: "",
          contacts: [],
        }}
      />
    </div>
  );
}
