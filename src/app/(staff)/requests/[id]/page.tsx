import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArchiveButton } from "@/components/ui/archive-button";
import { DefRow, SectionRule } from "@/components/ui/record";
import { EntityHistory } from "@/components/entity-history";
import { DocumentsTab } from "@/modules/documents/documents-tab";
import { listRequestDocuments } from "@/modules/documents/queries";
import { requireArea } from "@/lib/session";
import { formatDateTime } from "@/lib/datetime";
import { QuotationTab } from "@/modules/quotations/quotation-tab";
import { CommunicationTab } from "@/modules/communications/communication-tab";
import { listRequestMessages } from "@/modules/communications/queries";
import { listQuotations } from "@/modules/quotations/queries";
import { isClosedRequestStatus, type RequestStatus } from "@/lib/request-status";
import { archiveRequest, restoreRequest } from "@/modules/requests/actions";
import { getRequest } from "@/modules/requests/queries";
import { RequestDetailTabs } from "@/modules/requests/request-detail-tabs";
import { ShipmentView } from "@/modules/requests/shipment-view";
import { RequestStatusControl } from "@/modules/requests/request-status-control";
import { ConvertControl } from "@/modules/requests/convert-control";
import { accountPickerOptions } from "@/modules/accounts/queries";
import { TasksTab } from "@/modules/tasks/tasks-tab";
import { listTasks, taskAssigneeOptions } from "@/modules/tasks/queries";

const dl = "grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3 lg:grid-cols-4";

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireArea("staff");
  const { id } = await params;
  const { tab } = await searchParams;
  const [t, locale, data] = await Promise.all([getTranslations(), getLocale(), getRequest(id)]);
  if (!data) notFound();

  const r = data.request;
  const [documents, quotations, carrierOpts, messages, tasks, assigneeOpts] = await Promise.all([
    listRequestDocuments(id),
    listQuotations(id),
    accountPickerOptions("carrier"),
    listRequestMessages(id),
    listTasks("request", id),
    taskAssigneeOptions(),
  ]);
  // A decided request keeps its commercial record, but read-only: the numbers
  // the client saw are what the KPIs are computed from.
  const decided = isClosedRequestStatus(r.status as RequestStatus);

  const overview = (
    <div className="space-y-7">
      <section>
        <SectionRule>{t("requests.sectionEnquiry")}</SectionRule>
        <dl className={dl}>
          <DefRow label={t("fields.client")} value={data.accountTitle} />
          <DefRow label={t("fields.contactPerson")} value={data.contact?.name} />
          <DefRow label={t("fields.responsibleManager")} value={data.responsibleName} />
          <DefRow label={t("fields.leadSource")} value={t(`leadSource.${r.leadSource}`)} />
          <DefRow label={t("fields.receivedAt")} value={formatDateTime(r.receivedAt, locale)} />
          <DefRow label={t("fields.createdAt")} value={formatDateTime(r.createdAt, locale)} />
          {data.sourceAgentTitle && (
            <DefRow label={t("fields.sourceAgent")} value={data.sourceAgentTitle} />
          )}
          {r.emailSubject && <DefRow label={t("fields.emailSubject")} value={r.emailSubject} />}
          {r.sourceNote && (
            <DefRow label={t("fields.sourceNote")} value={r.sourceNote} className="col-span-full" />
          )}
        </dl>
      </section>

      <ShipmentView legs={data.legs} cargo={data.cargo} />

      <section>
        <SectionRule>{t("requests.sectionTerms")}</SectionRule>
        <dl className={dl}>
          <DefRow
            label={t("fields.incoterms")}
            value={[r.incoterms, r.incotermPlace].filter(Boolean).join(" ")}
          />
          <DefRow label={t("fields.cargoReadyDate")} value={r.cargoReadyDate} />
          <DefRow label={t("fields.requestedDeliveryDate")} value={r.requestedDeliveryDate} />
          <DefRow
            label={t("fields.specialInstructions")}
            value={r.specialInstructions}
            className="col-span-full"
          />
        </dl>
      </section>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow={r.number}
        title={r.title}
        action={
          <div className="flex items-center gap-3">
            <Link href={`/requests/${r.id}/edit`} className="btn-secondary">
              {t("actions.edit")}
            </Link>
            {r.deletedAt ? (
              <ArchiveButton mode="restore" label={t("actions.restore")} action={restoreRequest.bind(null, r.id)} />
            ) : (
              <ArchiveButton
                mode="archive"
                label={t("actions.archive")}
                confirm={t("actions.confirmArchive")}
                hasOrdersError={t("requests.hasOrder")}
                redirectTo="/requests"
                action={archiveRequest.bind(null, r.id)}
              />
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <RequestDetailTabs
            initialTab={tab}
            overview={overview}
            quotation={<QuotationTab requestId={r.id} versions={quotations} readOnly={decided} />}
            emails={<CommunicationTab requestId={r.id} messages={messages} />}
            documents={<DocumentsTab orderId={r.id} parentType="request" documents={documents} />}
            tasks={
              <TasksTab parentType="request" parentId={r.id} tasks={tasks} assigneeOpts={assigneeOpts} />
            }
            history={
              <EntityHistory
                entries={data.history}
                title={t("requests.tabHistory")}
                empty={t("orders.noHistory")}
              />
            }
          />
        </div>

        <aside className="w-full shrink-0 space-y-5 lg:sticky lg:top-6 lg:h-fit lg:w-80">
          <div>
            <SectionRule>{t("fields.status")}</SectionRule>
            <div className="mb-3">
              <StatusBadge status={r.status} />
            </div>
            <RequestStatusControl
              requestId={r.id}
              current={r.status}
              lostReason={r.lostReason}
              lostReasonNote={r.lostReasonNote}
            />
            {r.lostReason && (
              <dl className="mt-3">
                <DefRow label={t("fields.lostReason")} value={t(`lostReason.${r.lostReason}`)} />
                {r.lostReasonNote && (
                  <DefRow label={t("fields.lostReasonNote")} value={r.lostReasonNote} />
                )}
              </dl>
            )}
          </div>

          <div>
            <SectionRule>{t("requests.linkedOrder")}</SectionRule>
            {r.orderId && data.orderNumber ? (
              <Link href={`/orders/${r.orderId}`} className="text-[13px] font-medium text-brand hover:underline">
                {data.orderNumber}
              </Link>
            ) : (
              // Available from any undecided status: a client can confirm at any
              // point, including before a quotation was ever sent (§2 path B).
              !decided && (
                <ConvertControl
                  requestId={r.id}
                  hasQuotation={quotations.length > 0}
                  carrierOpts={carrierOpts}
                />
              )
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
