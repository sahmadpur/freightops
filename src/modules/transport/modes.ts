/**
 * Transport mode types, client-safe (no db import) so forms can use the list
 * without pulling drizzle into the client bundle. Must stay in sync with the
 * `mode_type` pgEnum in src/db/schema/domain.ts. Labels are localized via the
 * `transportModes` i18n namespace — render with t(`transportModes.${mode}`).
 */
export const TRANSPORT_MODES = ["truck", "container", "air", "postal", "rail", "sea"] as const;

export type TransportMode = (typeof TRANSPORT_MODES)[number];
