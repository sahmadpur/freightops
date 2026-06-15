import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CommentsTab } from "@/modules/comments/comments-tab";
import { addClientComment } from "@/modules/comments/actions";
import type { DocumentRow } from "@/modules/documents/queries";
import type { CommentRow } from "@/modules/comments/queries";

type DetailOrder = {
  id: string;
  number: string;
  title: string;
  route: string | null;
  status: string;
  cargoDescription: string | null;
};

export async function PortalOrderDetail({
  order,
  carrierTitle,
  transportNumber,
  documents,
  comments,
  currentUserId,
}: {
  order: DetailOrder;
  carrierTitle: string | null;
  transportNumber: string | null;
  documents: DocumentRow[];
  comments: CommentRow[];
  currentUserId: string;
}) {
  const t = await getTranslations();
  const td = await getTranslations("docType");

  const row = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/portal" className="text-sm text-indigo-600 hover:underline">← {t("nav.myOrders")}</Link>
      </div>
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-slate-900">{order.number}</h1>
        <StatusBadge status={order.status} />
      </div>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{order.title}</span></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {row(t("fields.route"), order.route)}
            {row(t("fields.carrier"), carrierTitle)}
            {row(t("fields.transport"), transportNumber)}
            {row(t("fields.cargoDescription"), order.cargoDescription)}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("documents.tab")}</span></CardHeader>
        <CardBody>
          {documents.length === 0 ? (
            <p className="text-sm text-slate-400">{t("portal.noDocuments")}</p>
          ) : (
            <ul className="space-y-2">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="flex-1 truncate">
                    <span className="font-medium">{d.fileName}</span>
                    <span className="ml-2 text-xs text-slate-400">{td(d.docType)}</span>
                  </span>
                  <a href={`/api/documents/${d.id}/download`} className="text-xs text-indigo-600 hover:underline">{t("documents.download")}</a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><span className="text-sm font-semibold">{t("comments.tab")}</span></CardHeader>
        <CardBody>
          <CommentsTab orderId={order.id} comments={comments} currentUserId={currentUserId} sendAction={addClientComment} />
        </CardBody>
      </Card>
    </div>
  );
}
