/**
 * How the cargo physically moves. Recorded on the order itself
 * (`orders.transport_type`); the standalone transport-mode entity was removed.
 *
 * Kept free of db imports so client components can bundle it without pulling
 * drizzle in. Must stay in sync with the `mode_type` pgEnum in
 * `src/db/schema/domain.ts`. Labels live in the `transportTypes` i18n namespace.
 */
export const TRANSPORT_TYPES = ["truck", "container", "air", "postal", "rail", "sea"] as const;

export type TransportType = (typeof TRANSPORT_TYPES)[number];
