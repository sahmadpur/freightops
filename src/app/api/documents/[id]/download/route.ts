import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getSession } from "@/lib/session";
import { getDocument } from "@/modules/documents/queries";
import { getObject } from "@/lib/s3";
import { clientMayDownload } from "@/lib/document-access";
import type { Role } from "@/lib/roles";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.user.active === false) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const role = session.user.role as Role;
  const isStaff = role === "admin" || role === "operator";
  if (!isStaff) {
    // Client: only own-account order's client-visible documents.
    let orderAccountId: string | null = null;
    if (doc.parentType === "order") {
      const [o] = await db.select({ accountId: orders.accountId }).from(orders).where(eq(orders.id, doc.parentId)).limit(1);
      orderAccountId = o?.accountId ?? null;
    }
    if (!clientMayDownload(doc, orderAccountId, session.user.accountId ?? null)) {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  const { body, contentType } = await getObject(doc.s3Key);
  const encoded = encodeURIComponent(doc.fileName);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
      "Content-Length": String(body.length),
    },
  });
}
