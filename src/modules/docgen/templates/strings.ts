import type { DocLanguage } from "./types";

/**
 * All human-readable wording printed on the generated documents. Independent
 * of the staff UI locale (next-intl) — the document language is chosen per
 * document in the generate form. Wording is provisional until the client's
 * real templates arrive; only this file and the template markup should need
 * to change then.
 */

export type CommonStrings = {
  taxId: string;
  address: string;
  phone: string;
  email: string;
  bankDetails: string;
  bank: string;
  account: string;
  bankCode: string;
  bankTaxId: string;
  correspondentAccount: string;
  swift: string;
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
  /** Base amount-column label; the currency code is appended by the template. */
  colAmount: string;
  total: string;
  vatNote: string;
  amountInWordsLabel: string;
  serviceForOrder: (orderNumber: string) => string;
  additionalCharges: string;
  signature: string;
  stamp: string;
};

export type InvoiceStrings = CommonStrings & {
  docTitle: string;
  numberDate: (number: string, date: string) => string;
  seller: string;
  buyer: string;
  paymentTerms: string;
};

export type ActStrings = CommonStrings & {
  docTitle: string;
  numberDate: (number: string, date: string) => string;
  executor: string;
  customer: string;
  body: (orderNumber: string) => string;
  noClaims: string;
};

export const COMMON_STRINGS: Record<DocLanguage, CommonStrings> = {
  en: {
    taxId: "Tax ID",
    address: "Address",
    phone: "Phone",
    email: "Email",
    bankDetails: "Bank details",
    bank: "Bank",
    account: "Account / IBAN",
    bankCode: "Bank code",
    bankTaxId: "Bank VÖEN",
    correspondentAccount: "Correspondent account",
    swift: "SWIFT",
    orderRef: "Order",
    rollbackRef: "Rollback number",
    route: "Route",
    cargo: "Cargo",
    packages: "Packages",
    weightKg: "Weight, kg",
    volumeM3: "Volume, m³",
    incoterms: "Incoterms",
    colNo: "#",
    colDescription: "Description",
    colAmount: "Amount",
    total: "Total",
    vatNote: "VAT 0%",
    amountInWordsLabel: "Amount in words",
    serviceForOrder: (n) => `Freight forwarding services for order ${n}`,
    additionalCharges: "Additional charges",
    signature: "Signature",
    stamp: "Stamp",
  },
  ru: {
    taxId: "ИНН/VÖEN",
    address: "Адрес",
    phone: "Телефон",
    email: "Эл. почта",
    bankDetails: "Банковские реквизиты",
    bank: "Банк",
    account: "Счёт / IBAN",
    bankCode: "Код банка",
    bankTaxId: "VÖEN банка",
    correspondentAccount: "Корр. счёт",
    swift: "SWIFT",
    orderRef: "Заказ",
    rollbackRef: "Номер отката",
    route: "Маршрут",
    cargo: "Груз",
    packages: "Мест",
    weightKg: "Вес, кг",
    volumeM3: "Объём, м³",
    incoterms: "Инкотермс",
    colNo: "№",
    colDescription: "Наименование услуги",
    colAmount: "Сумма",
    total: "Итого",
    vatNote: "НДС 0%",
    amountInWordsLabel: "Сумма прописью",
    serviceForOrder: (n) => `Транспортно-экспедиторские услуги по заказу ${n}`,
    additionalCharges: "Дополнительные расходы",
    signature: "Подпись",
    stamp: "М.П.",
  },
  az: {
    taxId: "VÖEN",
    address: "Ünvan",
    phone: "Telefon",
    email: "E-poçt",
    bankDetails: "Bank rekvizitləri",
    bank: "Bank",
    account: "H/h",
    bankCode: "Kod",
    bankTaxId: "Bank VÖEN",
    correspondentAccount: "M/h",
    swift: "SWIFT",
    orderRef: "Sifariş",
    rollbackRef: "Rollback nömrəsi",
    route: "Marşrut",
    cargo: "Yük",
    packages: "Yer sayı",
    weightKg: "Çəki, kq",
    volumeM3: "Həcm, m³",
    incoterms: "İnkoterms",
    colNo: "№",
    colDescription: "Xidmətin təsviri",
    colAmount: "Məbləğ",
    total: "Yekun",
    vatNote: "ƏDV 0%",
    amountInWordsLabel: "Cəm (yazı ilə)",
    serviceForOrder: (n) => `${n} nömrəli sifariş üzrə beynəlxalq yükdaşıma xidməti`,
    additionalCharges: "Əlavə xərclər",
    signature: "İmza",
    stamp: "M.Y.",
  },
};

export const INVOICE_STRINGS: Record<DocLanguage, InvoiceStrings> = {
  en: {
    ...COMMON_STRINGS.en,
    docTitle: "INVOICE",
    numberDate: (number, date) => `No. ${number} dated ${date}`,
    seller: "Seller (Executor)",
    buyer: "Bill to (Customer)",
    paymentTerms: "Payment is due within 10 banking days from the invoice date.",
  },
  ru: {
    ...COMMON_STRINGS.ru,
    docTitle: "СЧЁТ (ИНВОЙС)",
    numberDate: (number, date) => `№ ${number} от ${date}`,
    seller: "Исполнитель",
    buyer: "Плательщик (Заказчик)",
    paymentTerms: "Оплата в течение 10 банковских дней с даты выставления счёта.",
  },
  az: {
    ...COMMON_STRINGS.az,
    docTitle: "Hesab Faktura",
    numberDate: (number, date) => `${number}, ${date}`,
    seller: "İcraçı",
    buyer: "Ödəyən (Sifarişçi)",
    paymentTerms: "Ödəniş hesab-faktura tarixindən etibarən 10 bank günü ərzində edilməlidir.",
  },
};

export const ACT_STRINGS: Record<DocLanguage, ActStrings> = {
  en: {
    ...COMMON_STRINGS.en,
    docTitle: "ACCEPTANCE CERTIFICATE (ACT)",
    numberDate: (number, date) => `No. ${number} dated ${date}`,
    executor: "Executor",
    customer: "Customer",
    body: (n) =>
      `The Executor has rendered, and the Customer has accepted, freight forwarding services under order ${n}. The services have been rendered in full, on time, and with due quality.`,
    noClaims: "The parties have no claims against each other.",
  },
  ru: {
    ...COMMON_STRINGS.ru,
    docTitle: "АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)",
    numberDate: (number, date) => `№ ${number} от ${date}`,
    executor: "Исполнитель",
    customer: "Заказчик",
    body: (n) =>
      `Исполнитель оказал, а Заказчик принял транспортно-экспедиторские услуги по заказу ${n}. Услуги оказаны полностью, в срок и с надлежащим качеством.`,
    noClaims: "Стороны претензий друг к другу не имеют.",
  },
  az: {
    ...COMMON_STRINGS.az,
    docTitle: "Yükdaşıma xidmətinin göstərilməsi barədə AKT",
    numberDate: (number, date) => `${number}, ${date}`,
    executor: "İcraçı",
    customer: "Sifarişçi",
    body: (n) =>
      `Biz, aşağıda imza edənlər — bir tərəfdən İcraçı, digər tərəfdən Sifarişçi — bu aktı ondan ötrü tərtib etdik ki, ${n} nömrəli sifariş üzrə aşağıda göstərilən beynəlxalq yükdaşıma xidmətləri həqiqətən tam həcmdə, vaxtında və lazımi keyfiyyətlə həyata keçirilmiş və təhvil verilmişdir:`,
    noClaims: "Tərəflərin bir-birinə qarşı maddi və digər iddiası yoxdur.",
  },
};
