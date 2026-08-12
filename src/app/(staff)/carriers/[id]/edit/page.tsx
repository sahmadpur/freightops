import { redirect } from "next/navigation";

/** Carriers are accounts now; old links land on the account form. */
export default async function EditCarrierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/accounts/${id}/edit`);
}
