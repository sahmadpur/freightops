/**
 * Pure authorization predicate: may a client download this document?
 * Only client-visible documents attached to an ORDER owned by the client's account.
 */
export function clientMayDownload(
  doc: { parentType: string; visibleToClient: boolean },
  orderAccountId: string | null,
  userAccountId: string | null,
): boolean {
  if (doc.parentType !== "order") return false;
  if (!doc.visibleToClient) return false;
  if (!userAccountId || !orderAccountId) return false;
  return orderAccountId === userAccountId;
}
