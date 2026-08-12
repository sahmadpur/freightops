import { redirect } from "next/navigation";

/** Carriers are accounts now — the account form with the carrier role pre-set. */
export default function NewCarrierPage() {
  redirect("/accounts/new?role=carrier");
}
