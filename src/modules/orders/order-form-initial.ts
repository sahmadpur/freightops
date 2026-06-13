type TransportMode = "none" | "existing" | "new";

export type OrderFormInitial = {
  id?: string;
  title: string;
  clientOrderId: string;
  accountId: string;
  carrierId: string;
  route: string;
  cargoDescription: string;
  packages: string;
  weightKg: string;
  volumeM3: string;
  incoterms: string;
  deliveryFormat: string;
  clientCharge: string;
  carrierCost: string;
  additionalCosts: string;
  additionalCostsNote: string;
  expectedProfit: string;
  invoiceNumber: string;
  invoiceDate: string;
  transportMode: TransportMode;
  transportModeId: string;
  newTransport: {
    modeType: string;
    number: string;
    fromCountry: string;
    toCountry: string;
    route: string;
    loadingDate: string;
    plannedArrivalDate: string;
    totalWeightKg: string;
    totalVolumeM3: string;
  };
};

/** Blank initial values for the create form. */
export function blankOrderInitial(): OrderFormInitial {
  return {
    title: "", clientOrderId: "", accountId: "", carrierId: "", route: "",
    cargoDescription: "", packages: "", weightKg: "", volumeM3: "",
    incoterms: "", deliveryFormat: "", clientCharge: "", carrierCost: "",
    additionalCosts: "", additionalCostsNote: "", expectedProfit: "",
    invoiceNumber: "", invoiceDate: "",
    transportMode: "none", transportModeId: "",
    newTransport: {
      modeType: "vehicle", number: "", fromCountry: "", toCountry: "",
      route: "", loadingDate: "", plannedArrivalDate: "", totalWeightKg: "", totalVolumeM3: "",
    },
  };
}
