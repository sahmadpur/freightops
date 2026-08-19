/**
 * Presentation maps for audit-log rows, shared by the order History tab and the
 * admin Audit Log page so the two never drift.
 *
 * Actions are translated via the `auditAction` namespace, keyed by the exact
 * string `recordAudit` writes. Field names map into the shared `fields`
 * namespace. Anything unlisted falls back to the raw value, so a newly audited
 * action or field shows up readably instead of breaking the page.
 */
export const AUDIT_FIELD_LABELS: Record<string, string> = {
  title: "orderTitle",
  accountId: "client",
  carrierId: "carrier",
  transportType: "transportType",
  fromCountry: "fromCountry",
  toCountry: "toCountry",
  cargoItems: "cargoDescription",
  packages: "packages",
  weightKg: "weightKg",
  volumeM3: "volumeM3",
  incoterms: "incoterms",
  deliveryFormat: "deliveryFormat",
  currency: "currency",
  exchangeRate: "exchangeRate",
  status: "status",
  amountReceivable: "amountReceivable",
  amountPayable: "amountPayable",
  carrierInvoiceNumber: "carrierInvoiceNumber",
  carrierInvoiceDate: "carrierInvoiceDate",
  invoiceNumber: "invoiceNumber",
  actNumber: "actNumber",
  received: "received",
  paid: "paid",
  revenue: "revenue",
  cost: "cost",
  // Request fields (§19 History tab).
  contactId: "contactPerson",
  responsibleUserId: "responsibleManager",
  leadSource: "leadSource",
  sourceAgentAccountId: "sourceAgent",
  emailSubject: "emailSubject",
  transportFamily: "transportType",
  incotermPlace: "incotermPlace",
  cargoReadyDate: "cargoReadyDate",
  requestedDeliveryDate: "requestedDeliveryDate",
  receivedAt: "receivedAt",
};

/** Fields holding an ISO country code, rendered with a flag and localized name. */
export const AUDIT_COUNTRY_FIELDS = new Set(["fromCountry", "toCountry"]);
