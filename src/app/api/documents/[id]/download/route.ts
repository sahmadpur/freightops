import { NextRequest, NextResponse } from "next/server";
import { requireArea } from "@/lib/session";
import { getDocument } from "@/modules/documents/queries";
import { getObject } from "@/lib/s3";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Staff-only for now; Phase 5 will additionally allow a client to fetch their
  // own order's visible_to_client documents.
  await requireArea("staff");

  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const { body, contentType } = await getObject(doc.s3Key);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
      "Content-Length": String(body.length),
    },
  });
}
