import { notFound } from "next/navigation";
import { requireArea } from "@/lib/session";
import { getClientOrder } from "@/modules/orders/queries";
import { listVisibleOrderDocuments } from "@/modules/documents/queries";
import { listOrderComments } from "@/modules/comments/queries";
import { PortalOrderDetail } from "@/modules/portal/order-detail";

export default async function PortalOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireArea("portal");
  const { id } = await params;
  const accountId = session.user.accountId;
  const data = accountId ? await getClientOrder(id, accountId) : null;
  if (!data) notFound();

  const [documents, comments] = await Promise.all([
    listVisibleOrderDocuments(id),
    listOrderComments(id),
  ]);

  return (
    <PortalOrderDetail
      order={{
        id: data.order.id,
        number: data.order.number,
        title: data.order.title,
        route: data.order.route,
        status: data.order.status,
        cargoDescription: data.order.cargoDescription,
      }}
      carrierTitle={data.carrierTitle}
      transportNumber={data.transportNumber}
      documents={documents}
      comments={comments}
      currentUserId={session.user.id}
    />
  );
}
