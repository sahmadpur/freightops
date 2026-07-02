import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, getFormatter } from "next-intl/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionRule, DefRow } from "@/components/ui/record";
import { OrderDetailTabs } from "@/modules/orders/order-detail-tabs";
import { StatusControl } from "@/modules/orders/status-control";
import { getOrder } from "@/modules/orders/queries";
import { orderFinance } from "@/modules/finance/queries";
import { FinanceTab } from "@/modules/finance/finance-tab";
import { listOrderDocuments } from "@/modules/documents/queries";
import { DocumentsTab } from "@/modules/documents/documents-tab";
import { peekNextDocNumber } from "@/modules/docgen/queries";
import { GenerateDocumentSection } from "@/modules/docgen/generate-document-section";
import { listOrderComments } from "@/modules/comments/queries";
import { CommentsTab } from "@/modules/comments/comments-tab";
import { addComment } from "@/modules/comments/actions";
import { requireArea } from "@/lib/session";
import { formatMoney } from "@/lib/money";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session } = await requireArea("staff");
  const t = await getTranslations();
  const format = await getFormatter();
  const data = await getOrder(id);
  if (!data) notFound();
  // Independent of each other — fetch in parallel.
  const currentYear = new Date().getFullYear();
  const [finance, orderDocuments, orderComments, nextInvoiceNumber, nextActNumber] =
    await Promise.all([
      orderFinance(id),
      listOrderDocuments(id),
      listOrderComments(id),
      peekNextDocNumber("invoice", currentYear),
      peekNextDocNumber("act", currentYear),
    ]);
  const { order, accountTitle, carrierTitle, transportNumber, transportModeType, history } = data;

  const info = (
    <div className="space-y-7">
      <section>
        <SectionRule>{t("orders.sectionConsignment")}</SectionRule>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
          <DefRow label={t("fields.client")} value={accountTitle} />
          <DefRow label={t("fields.clientOrderId")} value={order.clientOrderId} />
          <DefRow label={t("fields.carrier")} value={carrierTitle} />
          <DefRow label={t("fields.route")} value={order.route} />
          <DefRow
            label={t("fields.transport")}
            value={transportNumber ? `${transportNumber} (${transportModeType})` : null}
          />
          <DefRow label={t("fields.incoterms")} value={order.incoterms} />
        </dl>
      </section>
      <section>
        <SectionRule>{t("orders.sectionCargo")}</SectionRule>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
          <DefRow
            label={t("fields.cargoDescription")}
            value={order.cargoDescription}
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
          <DefRow label={t("fields.deliveryFormat")} value={order.deliveryFormat} />
          <DefRow label={t("fields.actNumber")} value={order.actNumber} />
          <DefRow label={t("fields.actDate")} value={order.actDate} />
        </dl>
      </section>
    </div>
  );

  const historyNode = (
    <section>
      <SectionRule>{t("orders.deliveryHistory")}</SectionRule>
      {history.length === 0 ? (
        <p className="text-sm text-ink-soft">{t("orders.noHistory")}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {history.map((h) => (
            <li
              key={h.id}
              className="flex items-baseline justify-between border-b border-edge-soft pb-2 last:border-0"
            >
              <span>
                <span className="font-medium">{h.action}</span>
                {h.field ? ` · ${h.field}: ${h.oldValue ?? "∅"} → ${h.newValue ?? "∅"}` : ""}
              </span>
              <span className="whitespace-nowrap font-mono text-[11px] text-ink-soft">
                {format.dateTime(h.createdAt, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const meta = (label: string, value: React.ReactNode) => (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="uppercase tracking-[0.14em] text-ink-soft">{label}</span>
      <span className="text-ink">{value || "—"}</span>
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
      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${cls}`}>
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
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-px w-4 bg-brand-accent" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                {t("nav.orders")} · {order.number}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-[26px] font-medium leading-[1.05] tracking-[-0.01em] text-brand-deep">
                {order.title}
              </h1>
              <StatusBadge status={order.status} />
            </div>
          </div>
          <Link href={`/orders/${order.id}/edit`} className="btn-secondary">
            {t("actions.edit")}
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1.5 border-t border-edge-soft pt-3 font-mono text-[11px]">
          {meta(t("fields.client"), accountTitle)}
          {metaDot}
          {meta(t("fields.route"), order.route)}
          {metaDot}
          {meta(t("fields.transport"), transportNumber ?? "—")}
        </div>
      </div>

      {/* Two-column workspace */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <OrderDetailTabs
            info={info}
            finance={finance ? <FinanceTab orderId={order.id} finance={finance} /> : null}
            documents={
              <div className="space-y-6">
                <DocumentsTab orderId={order.id} documents={orderDocuments} />
                <GenerateDocumentSection
                  orderId={order.id}
                  nextNumbers={{ invoice: nextInvoiceNumber, act: nextActNumber }}
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
            history={historyNode}
          />
        </div>

        <aside className="space-y-7 lg:sticky lg:top-4 lg:self-start">
          <div>
            <SectionRule>{t("orders.updateStatus")}</SectionRule>
            <StatusControl orderId={order.id} current={order.status} />
          </div>
          {finance && (
            <div>
              <SectionRule>{t("finance.tab")}</SectionRule>
              <dl className="text-[13px]">
                {snap(t("fields.clientCharge"), formatMoney(finance.clientChargeCents))}
                {snap(t("fields.carrierCost"), `− ${formatMoney(finance.carrierCostCents)}`, "neg")}
                {snap(t("fields.additionalCosts"), `− ${formatMoney(finance.additionalCostsCents)}`, "neg")}
                <div className="my-1.5 border-t border-edge-soft" />
                {snap(t("finance.actualProfit"), formatMoney(finance.actualProfitCents), "strong")}
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
