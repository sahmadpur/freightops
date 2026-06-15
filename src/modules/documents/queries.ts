import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { documents, orders, accounts, docTypeEnum } from "@/db/schema";

export type DocumentRow = {
  id: string;
  fileName: string;
  docType: string;
  sizeBytes: number | null;
  visibleToClient: boolean;
  createdAt: Date;
};

/** Documents attached to one order (Documents tab), newest first. */
export async function listOrderDocuments(orderId: string): Promise<DocumentRow[]> {
  const rows = await db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      docType: documents.docType,
      sizeBytes: documents.sizeBytes,
      visibleToClient: documents.visibleToClient,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(and(eq(documents.parentType, "order"), eq(documents.parentId, orderId)))
    .orderBy(desc(documents.createdAt));
  return rows;
}

/** One document's storage info (for the download route). Null/undefined if missing. */
export async function getDocument(id: string) {
  return db.query.documents.findFirst({ where: eq(documents.id, id) });
}

export type OrderDocumentGroup = {
  orderId: string;
  orderNumber: string;
  orderTitle: string;
  accountTitle: string;
  documents: DocumentRow[];
};

/**
 * All order-attached documents grouped by order (Documents page), with optional
 * free-text search (file name / order number / order title / account title) and docType filter.
 */
export async function listDocumentsByOrder(opts: { q?: string; docType?: string }): Promise<OrderDocumentGroup[]> {
  const conds = [eq(documents.parentType, "order")];
  // Guard the URL-supplied docType against the enum before querying (invalid → ignored, no 500).
  if (opts.docType && (docTypeEnum.enumValues as readonly string[]).includes(opts.docType)) {
    conds.push(eq(documents.docType, opts.docType as (typeof docTypeEnum.enumValues)[number]));
  }
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(documents.fileName, like), ilike(orders.number, like), ilike(orders.title, like), ilike(accounts.title, like))!);
  }

  const rows = await db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      docType: documents.docType,
      sizeBytes: documents.sizeBytes,
      visibleToClient: documents.visibleToClient,
      createdAt: documents.createdAt,
      orderId: orders.id,
      orderNumber: orders.number,
      orderTitle: orders.title,
      accountTitle: accounts.title,
    })
    .from(documents)
    .innerJoin(orders, eq(documents.parentId, orders.id))
    .innerJoin(accounts, eq(orders.accountId, accounts.id))
    .where(and(...conds))
    .orderBy(desc(orders.createdAt), desc(documents.createdAt));

  const groups = new Map<string, OrderDocumentGroup>();
  for (const r of rows) {
    let g = groups.get(r.orderId);
    if (!g) {
      g = { orderId: r.orderId, orderNumber: r.orderNumber, orderTitle: r.orderTitle, accountTitle: r.accountTitle, documents: [] };
      groups.set(r.orderId, g);
    }
    g.documents.push({
      id: r.id,
      fileName: r.fileName,
      docType: r.docType,
      sizeBytes: r.sizeBytes,
      visibleToClient: r.visibleToClient,
      createdAt: r.createdAt,
    });
  }
  return [...groups.values()];
}
