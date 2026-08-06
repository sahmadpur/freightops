import type { DocLanguage } from "./types";

/**
 * All human-readable wording printed on the generated documents. Independent of
 * the staff UI locale (next-intl) — the document language is chosen per document
 * in the generate form. Wording is transcribed from the company's real Word
 * templates: Azerbaijani from the AZN pair, Russian from the RUB pair, English
 * from the USD/EUR pair.
 */

export type CommonStrings = {
  taxId: string;
  address: string;
  city: string;
  date: string;
  bank: string;
  account: string;
  bankCode: string;
  bankTaxId: string;
  swift: string;
  correspondentBank: string;
  correspondentAccount: string;
  correspondentSwift: string;
  orderRef: string;
  rollbackRef: string;
  route: string;
  cargo: string;
  packages: string;
  weightKg: string;
  volumeM3: string;
  incoterms: string;
  colNo: string;
  colDescription: string;
  colQuantity: string;
  /** Base amount-column label; the currency code is appended by the template. */
  colAmount: string;
  total: string;
  /** "VAT 18%" and its translations; the rate is passed in. */
  vat: (percent: number) => string;
  grandTotal: string;
  amountInWordsLabel: string;
  serviceForOrder: (orderNumber: string) => string;
  signature: string;
  stamp: string;
  director: string;
};

export type InvoiceStrings = CommonStrings & {
  docTitle: string;
  numberLine: (number: string) => string;
  issuedBy: string;
  buyer: string;
  paymentTerms: string;
};

export type ActStrings = CommonStrings & {
  docTitle: string;
  numberLine: (number: string) => string;
  /** The line above the title, naming both parties and the document's purpose. */
  heading: (issuer: string, client: string) => string;
  executor: string;
  customer: string;
  body: (d: {
    issuer: string;
    signatory: string;
    client: string;
    orderNumber: string;
    amount: string;
    amountInWords: string;
  }) => string;
  noClaims: string;
  handedOverBy: string;
  acceptedBy: string;
};

export const COMMON_STRINGS: Record<DocLanguage, CommonStrings> = {
  en: {
    taxId: "TIN",
    address: "Address",
    city: "Baku city",
    date: "Date",
    bank: "Bank",
    account: "Account",
    bankCode: "Code",
    bankTaxId: "Bank TIN",
    swift: "SWIFT",
    correspondentBank: "Correspondent Bank",
    correspondentAccount: "Correspondent account",
    correspondentSwift: "Correspondent SWIFT",
    orderRef: "Order",
    rollbackRef: "Rollback number",
    route: "Route",
    cargo: "Cargo",
    packages: "Packages",
    weightKg: "Weight, kg",
    volumeM3: "Volume, m³",
    incoterms: "Incoterms",
    colNo: "No.",
    colDescription: "Description of work",
    colQuantity: "Quantity (units)",
    colAmount: "Total amount",
    total: "Total",
    vat: (p) => `VAT ${p}%`,
    grandTotal: "Grand total",
    amountInWordsLabel: "Amount in words",
    serviceForOrder: (n) => `Freight forwarding services for order ${n}`,
    signature: "signature",
    stamp: "Stamp",
    director: "Director",
  },
  ru: {
    taxId: "ИНН",
    address: "Адрес",
    city: "г. Баку",
    date: "Дата",
    bank: "Банк",
    account: "Р/с",
    bankCode: "Код",
    bankTaxId: "ИНН банка",
    swift: "SWIFT",
    correspondentBank: "Банк-корреспондент",
    correspondentAccount: "Корр. счёт",
    correspondentSwift: "SWIFT корреспондента",
    orderRef: "Заказ",
    rollbackRef: "Номер отката",
    route: "Маршрут",
    cargo: "Груз",
    packages: "Мест",
    weightKg: "Вес, кг",
    volumeM3: "Объём, м³",
    incoterms: "Инкотермс",
    colNo: "№",
    colDescription: "Наименование работы",
    colQuantity: "Количество (ед.)",
    colAmount: "Общая сумма",
    total: "Итого",
    vat: (p) => `НДС ${p}%`,
    grandTotal: "Всего",
    amountInWordsLabel: "Сумма прописью",
    serviceForOrder: (n) => `Транспортно-экспедиторские услуги по заказу ${n}`,
    signature: "подпись",
    stamp: "М.П.",
    director: "Директор",
  },
  az: {
    taxId: "VÖEN",
    address: "Ünvan",
    city: "Bakı şəhəri",
    date: "Tarix",
    bank: "Bank",
    account: "H/h",
    bankCode: "Kod",
    bankTaxId: "Bank VÖEN",
    swift: "SWIFT",
    correspondentBank: "Müxbir bank",
    correspondentAccount: "Müxbir h",
    correspondentSwift: "Müxbir SWIFT",
    orderRef: "Sifariş",
    rollbackRef: "Rollback nömrəsi",
    route: "Marşrut",
    cargo: "Yük",
    packages: "Yer sayı",
    weightKg: "Çəki, kq",
    volumeM3: "Həcm, m³",
    incoterms: "İnkoterms",
    colNo: "№",
    colDescription: "İşin adı",
    colQuantity: "Sayı (Ədəd)",
    colAmount: "Ümumi Məbləğ",
    total: "Cəmi",
    vat: (p) => `ƏDV ${p}%`,
    grandTotal: "Toplam",
    amountInWordsLabel: "Məbləğ (yazı ilə)",
    serviceForOrder: (n) => `${n} nömrəli sifariş üzrə beynəlxalq yükdaşıma xidməti`,
    signature: "imza",
    stamp: "M.Y.",
    director: "Direktor",
  },
};

export const INVOICE_STRINGS: Record<DocLanguage, InvoiceStrings> = {
  en: {
    ...COMMON_STRINGS.en,
    docTitle: "INVOICE",
    numberLine: (number) => `No. ${number}`,
    issuedBy: "Issued by",
    buyer: "Buyer (Payer)",
    paymentTerms: "Payment is due within 10 banking days from the invoice date.",
  },
  ru: {
    ...COMMON_STRINGS.ru,
    docTitle: "СЧЕТ-ФАКТУРА",
    numberLine: (number) => `№ ${number}`,
    issuedBy: "Поставщик",
    buyer: "Покупатель (Плательщик)",
    paymentTerms: "Оплата в течение 10 банковских дней с даты выставления счёта.",
  },
  az: {
    ...COMMON_STRINGS.az,
    docTitle: "HESAB-FAKTURA",
    numberLine: (number) => `№ ${number}`,
    issuedBy: "Təqdim edən",
    buyer: "Alıcı (Ödəyən)",
    paymentTerms: "Ödəniş hesab-faktura tarixindən etibarən 10 bank günü ərzində edilməlidir.",
  },
};

export const ACT_STRINGS: Record<DocLanguage, ActStrings> = {
  en: {
    ...COMMON_STRINGS.en,
    docTitle: "ACT",
    numberLine: (number) => `No. ${number}`,
    heading: (issuer, client) =>
      `${issuer} and ${client} regarding the acceptance and transfer of completed works and rendered services`,
    executor: "Executor",
    customer: "Customer",
    body: (d) =>
      `We, the undersigned, Director ${d.signatory} of ${d.issuer}, on the one hand, and the authorised representative of ${d.client}, on the other hand, have drawn up this Act confirming that the value of the works performed and services rendered upon order ${d.orderNumber} of ${d.client} amounts to ${d.amount} (${d.amountInWords}).`,
    noClaims: "The parties have no claims against each other.",
    handedOverBy: "Handed over by",
    acceptedBy: "Accepted by",
  },
  ru: {
    ...COMMON_STRINGS.ru,
    docTitle: "Акт",
    numberLine: (number) => `№ ${number}`,
    heading: (issuer, client) =>
      `${issuer} и ${client} о приеме-передаче выполненных работ и оказанных услуг`,
    executor: "Исполнитель",
    customer: "Заказчик",
    body: (d) =>
      `Мы, нижеподписавшиеся, Директор ${d.issuer} ${d.signatory}, с одной стороны, и уполномоченный представитель ${d.client}, с другой стороны, составили настоящий акт о том, что стоимость выполненных работ и оказанных услуг по заказу ${d.orderNumber} компании ${d.client} составляет ${d.amount} (${d.amountInWords}).`,
    noClaims: "Стороны претензий друг к другу не имеют.",
    handedOverBy: "Передал",
    acceptedBy: "Принял",
  },
  az: {
    ...COMMON_STRINGS.az,
    docTitle: "Akt",
    numberLine: (number) => `№ ${number}`,
    heading: (issuer, client) =>
      `${issuer} və ${client} arasında görülən iş və göstərilmiş xidmətlərin təhvil-təslimi haqqında`,
    executor: "İcraçı",
    customer: "Sifarişçi",
    body: (d) =>
      `Biz, aşağıda imza edənlər, ${d.issuer}-nin Direktoru ${d.signatory} bir tərəfdən və ${d.client} şirkətinin səlahiyyətli nümayəndəsi digər tərəfdən bu aktı ondan ötəri tərtib etdik ki, ${d.client} şirkətinin ${d.orderNumber} nömrəli sifarişi əsasında görülən işlərin və göstərilmiş xidmətlərin dəyəri ${d.amount} (${d.amountInWords}) təşkil edir.`,
    noClaims: "Tərəflərin bir-birinə qarşı maddi və digər iddiası yoxdur.",
    handedOverBy: "Təhvil verdi",
    acceptedBy: "Təhvil aldı",
  },
};
