"use client";

import { useTranslations } from "next-intl";
import { EntityHistory } from "@/components/entity-history";
import type { OrderHistoryEntry } from "./queries";

export function OrderHistory({ entries }: { entries: OrderHistoryEntry[] }) {
  const t = useTranslations("orders");
  return (
    <EntityHistory entries={entries} title={t("deliveryHistory")} empty={t("noHistory")} />
  );
}
