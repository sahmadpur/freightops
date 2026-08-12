import { redirect } from "next/navigation";

/** Carriers are accounts now; old links land on the account detail. */
export default async function CarrierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/accounts/${id}`);
}
