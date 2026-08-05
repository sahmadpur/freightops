import { DEFAULT_CURRENCY } from "@/lib/fx";

/** One agent-expense row as the form holds it (all strings). */
export type CostLineDraft = {
  category: string;
  amount: string;
  note: string;
};

export type OrderFormInitial = {
  id?: string;
  transportType: string;
  accountId: string;
  carrierId: string;
  fromCountry: string;
  toCountry: string;
  title: string;
  rollbackNumber: string;
  deliveryFormat: string;
  cargoItems: string[];
  packages: string;
  weightKg: string;
  volumeM3: string;
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
    transportType: "",
    accountId: "",
    carrierId: "",
    fromCountry: "",
    toCountry: "",
    title: "",
    rollbackNumber: "",
    deliveryFormat: "",
    cargoItems: [],
    packages: "",
    weightKg: "",
    volumeM3: "",
    incoterms: "",
    currency: DEFAULT_CURRENCY,
    exchangeRate: "",
    clientCharge: "",
    costLines: [],
  };
}
