import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionRule, DefRow } from "@/components/ui/record";
import { OrderDetailTabs } from "@/modules/orders/order-detail-tabs";
import { OrderHistory } from "@/modules/orders/order-history";
import { StatusControl } from "@/modules/orders/status-control";
import { ArchiveButton } from "@/components/ui/archive-button";
import { archiveOrder, restoreOrder } from "@/modules/orders/actions";
import { getOrder } from "@/modules/orders/queries";
import { orderFinance } from "@/modules/finance/queries";
import { FinanceTab } from "@/modules/finance/finance-tab";
import { listOrderDocuments } from "@/modules/documents/queries";
import { DocumentsTab } from "@/modules/documents/documents-tab";
import { peekNextDocSeq } from "@/modules/docgen/queries";
import { GenerateDocumentSection } from "@/modules/docgen/generate-document-section";
import { listOrderComments } from "@/modules/comments/queries";
import { CommentsTab } from "@/modules/comments/comments-tab";
import { addComment } from "@/modules/comments/actions";
import { requireArea } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { routeLabel } from "@/lib/countries";
import { ORDER_STATUS_RANK } from "@/lib/order-status";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const { session } = await requireArea("staff");
  const t = await getTranslations();
  const locale = await getLocale();
  const data = await getOrder(id);
  if (!data) notFound();
  // Independent of each other — fetch in parallel.
  const currentYear = new Date().getFullYear();
  const [finance, orderDocuments, orderComments, nextInvoiceSeq, nextActSeq] =
    await Promise.all([
      orderFinance(id),
      listOrderDocuments(id),
      listOrderComments(id),
      peekNextDocSeq("invoice", currentYear),
      peekNextDocSeq("act", currentYear),
    ]);
  const { order, accountTitle, carrierTitle, history } = data;
  const route = routeLabel(order.fromCountry, order.toCountry, locale);
  // Arrival is the trigger to bill the client (requirement #13).
  const invoiceDue =
    ORDER_STATUS_RANK[order.status] >= ORDER_STATUS_RANK.arrived && !order.invoiceNumber;

  const info = (
    <div className="space-y-7">
      <section>
        <SectionRule>{t("orders.sectionConsignment")}</SectionRule>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
          <DefRow label={t("fields.client")} value={accountTitle} />
          <DefRow label={t("fields.rollbackNumber")} value={order.rollbackNumber} />
          <DefRow label={t("fields.carrier")} value={carrierTitle} />
          <DefRow label={t("fields.route")} value={route} />
          <DefRow
            label={t("fields.transportType")}
            value={order.transportType ? t(`transportTypes.${order.transportType}`) : null}
          />
          <DefRow label={t("fields.incoterms")} value={order.incoterms} />
        </dl>
      </section>
      <section>
        <SectionRule>{t("orders.sectionCargo")}</SectionRule>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
          <DefRow
            label={t("fields.cargoDescription")}
            value={order.cargoItems.length ? order.cargoItems.join(", ") : null}
            className="sm:col-span-3"
          />
          <DefRow label={t("fields.packages")} value={order.packages != null ? String(order.packages) : null} />
          <DefRow label={t("fields.weightKg")} value={order.weightKg} />
          <DefRow label={t("fields.volumeM3")} value={order.volumeM3} />
        </dl>
      </section>
      <section>
        <SectionRule>{t("orders.sectionBilling")}</SectionRule>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
          <DefRow label={t("fields.invoiceNumber")} value={order.invoiceNumber} />
          <DefRow label={t("fields.invoiceDate")} value={order.invoiceDate} />
          <DefRow label={t("fields.carrierInvoiceNumber")} value={order.carrierInvoiceNumber} />
          <DefRow label={t("fields.carrierInvoiceDate")} value={order.carrierInvoiceDate} />
          <DefRow label={t("fields.currency")} value={order.currency} />
          <DefRow label={t("fields.exchangeRate")} value={order.exchangeRate} />
          <DefRow label={t("fields.deliveryFormat")} value={order.deliveryFormat} />
          <DefRow label={t("fields.actNumber")} value={order.actNumber} />
          <DefRow label={t("fields.actDate")} value={order.actDate} />
        </dl>
      </section>
    </div>
  );

  const meta = (label: string, value: React.ReactNode) => (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-ink">{value || "—"}</span>
    </span>
  );
  const metaDot = <span className="text-edge-chip" aria-hidden="true">·</span>;

  const payPill = (status: "paid" | "partly_paid" | "not_paid" | null) => {
    if (!status) return <span className="text-ink-soft">—</span>;
    const cls =
      status === "paid"
        ? "bg-[rgb(var(--approval-approved-bg))] text-[rgb(var(--approval-approved-fg))]"
        : status === "partly_paid"
          ? "bg-[rgb(var(--approval-pending-bg))] text-[rgb(var(--approval-pending-fg))]"
          : "bg-[rgb(var(--approval-rejected-bg))] text-[rgb(var(--approval-rejected-fg))]";
    return (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
        {t(`payStatus.${status}`)}
      </span>
    );
  };

  const snap = (label: string, value: string, tone?: "neg" | "strong") => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-ink-soft">{label}</span>
      <span
        className={`tabular-nums ${
          tone === "strong" ? "font-semibold text-ink" : tone === "neg" ? "text-rose-600" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header band */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2">
              <span className="eyebrow">
                {t("nav.orders")} · {order.number}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-[27px] font-medium leading-[1.1] tracking-[-0.03em] text-brand-deep">
                {order.title}
              </h1>
              <StatusBadge status={order.status} />
            </div>
          </div>
          <Link href={`/orders/${order.id}/edit`} className="btn-secondary">
            {t("actions.edit")}
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1.5 border-t border-edge-soft pt-3 text-[12px]">
          {meta(t("fields.client"), accountTitle)}
          {metaDot}
          {meta(t("fields.route"), route)}
          {metaDot}
          {meta(
            t("fields.transportType"),
            order.transportType ? t(`transportTypes.${order.transportType}`) : "—",
          )}
        </div>
      </div>

      {invoiceDue && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[rgb(var(--approval-pending-edge))] bg-[rgb(var(--approval-pending-bg))] px-4 py-3">
          <p className="text-[13px] text-[rgb(var(--approval-pending-fg))]">
            {t("orders.invoiceRequired")}
          </p>
          <Link href={`/orders/${order.id}?tab=documents`} className="btn-primary">
            {t("docgen.createInvoice")}
          </Link>
        </div>
      )}

      {/* Two-column workspace */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <OrderDetailTabs
            initialTab={tab}
            info={info}
            finance={
              finance ? (
                <FinanceTab orderId={order.id} currency={order.currency} finance={finance} />
              ) : null
            }
            documents={
              <div className="space-y-6">
                <DocumentsTab orderId={order.id} documents={orderDocuments} />
                <GenerateDocumentSection
                  orderId={order.id}
                  nextSeqs={{ invoice: nextInvoiceSeq, act: nextActSeq }}
                />
              </div>
            }
            comments={
              <CommentsTab
                orderId={id}
                comments={orderComments}
                currentUserId={session.user.id}
                sendAction={addComment}
              />
            }
            history={<OrderHistory entries={history} />}
          />
        </div>

        <aside className="space-y-7 lg:sticky lg:top-4 lg:self-start">
          <div>
            <SectionRule>{t("orders.updateStatus")}</SectionRule>
            <StatusControl orderId={order.id} current={order.status} />
            <div className="mt-3">
              {order.deletedAt ? (
                <ArchiveButton
                  mode="restore"
                  label={t("actions.restore")}
                  action={restoreOrder.bind(null, order.id)}
                />
              ) : (
                <ArchiveButton
                  mode="archive"
                  label={t("actions.archive")}
                  confirm={t("actions.confirmArchive")}
                  redirectTo="/orders"
                  action={archiveOrder.bind(null, order.id)}
                />
              )}
            </div>
          </div>
          {finance && (
            <div>
              <SectionRule>{t("finance.tab")}</SectionRule>
              <dl className="text-[13px]">
                {snap(t("finance.revenue"), formatMoney(finance.clientChargeCents, order.currency))}
                {snap(t("finance.carrierCost"), `− ${formatMoney(finance.carrierCostCents, order.currency)}`, "neg")}
                <div className="my-1.5 border-t border-edge-soft" />
                {snap(t("finance.expectedProfit"), formatMoney(finance.expectedProfitCents, order.currency), "strong")}
                {snap(t("finance.actualProfit"), formatMoney(finance.settledProfitCents, order.currency), "strong")}
              </dl>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-ink-soft">{t("finance.receivable")}</span>
                  {payPill(finance.receivable.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-ink-soft">{t("finance.payable")}</span>
                  {payPill(finance.payable.status)}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
