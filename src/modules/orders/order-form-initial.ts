import { DEFAULT_CURRENCY } from "@/lib/fx";
import { emptyCargo, type CargoDraft, type LegDraft } from "@/modules/requests/request-form-initial";

/** One agent-expense row as the form holds it (all strings). */
export type CostLineDraft = {
  category: string;
  amount: string;
  note: string;
};

export type OrderFormInitial = {
  id?: string;
  accountId: string;
  carrierId: string;
  title: string;
  rollbackNumber: string;
  /**
   * The structured shipment, identical to a request's (§26). The flat
   * `orders` columns — route, transport type, delivery format, cargo totals —
   * are derived from it server-side, so they are not edited here.
   */
  transportFamily: string;
  legs: LegDraft[];
  cargo: CargoDraft;
  incoterms: string;
  currency: string;
  exchangeRate: string;
  /** Create-only quick totals; on edit these live in the Finance tab. */
  clientCharge: string;
  costLines: CostLineDraft[];
};

export function emptyCostLine(): CostLineDraft {
  return { category: "other", amount: "", note: "" };
}

/** Blank initial values for the create form. */
export function blankOrderInitial(): OrderFormInitial {
  return {
    accountId: "",
    carrierId: "",
    title: "",
    rollbackNumber: "",
    transportFamily: "",
    legs: [],
    cargo: emptyCargo(),
    incoterms: "",
    currency: DEFAULT_CURRENCY,
    exchangeRate: "",
    clientCharge: "",
    costLines: [],
  };
}
