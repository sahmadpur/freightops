import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { requireArea } from "@/lib/session";
import { toLocalInput } from "@/lib/datetime";
import { RequestForm } from "@/modules/requests/request-form";
import { blankRequestInitial } from "@/modules/requests/request-form-initial";
import { requestFormData } from "@/modules/requests/queries";

export default async function NewRequestPage() {
  const { session } = await requireArea("staff");
  const [t, { accountOpts, agentOpts, staffOpts }] = await Promise.all([
    getTranslations("requests"),
    requestFormData(),
  ]);

  // Seeded server-side so the field renders filled rather than flashing empty,
  // and in desk time so "now" means the same thing wherever the manager is.
  const initial = blankRequestInitial(session.user.id, toLocalInput(new Date()));

  return (
    <div>
      <PageHeader title={t("newRequest")} />
      <RequestForm initial={initial} accountOpts={accountOpts} agentOpts={agentOpts} staffOpts={staffOpts} contactOpts={[]} />
    </div>
  );
}
