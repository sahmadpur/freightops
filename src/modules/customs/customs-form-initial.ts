import { DEFAULT_CURRENCY } from "@/lib/fx";

/** One cost row as the form holds it (all strings). */
export type CustomsItemDraft = {
  category: string;
  buyAmount: string;
  sellAmount: string;
  note: string;
};

export type CustomsFormInitial = {
  id?: string;
  /** Attached to an order, or standalone against a client. */
  mode: "order" | "standalone";
  orderId: string;
  accountId: string;
  declarationNumber: string;
  description: string;
  currency: string;
  exchangeRate: string;
  clearedAt: string;
  notes: string;
  items: CustomsItemDraft[];
};

export function emptyCustomsItem(): CustomsItemDraft {
  return { category: "documentation_fee", buyAmount: "", sellAmount: "", note: "" };
}

/** Blank initial values for the create form. Server pages seed `exchangeRate`. */
export function blankCustomsInitial(): CustomsFormInitial {
  return {
    mode: "order",
    orderId: "",
    accountId: "",
    declarationNumber: "",
    description: "",
    currency: DEFAULT_CURRENCY,
    exchangeRate: "",
    clearedAt: "",
    notes: "",
    items: [emptyCustomsItem()],
  };
}
