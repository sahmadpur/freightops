/** Standard result shape returned by entity create/update server actions. */
export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };
