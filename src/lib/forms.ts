/** Standard result shape returned by entity create/update server actions. */
export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

/**
 * Peel one level off flattened zod paths: `legs.0.subtype` under prefix `legs`
 * becomes `0.subtype`, which is what the leg and cargo editors index by.
 */
export function nestedErrors(
  fieldErrors: Record<string, string[]>,
  prefix: string,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([k]) => k.startsWith(`${prefix}.`))
      .map(([k, val]) => [k.slice(prefix.length + 1), val]),
  );
}
