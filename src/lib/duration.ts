/**
 * Human-readable spans for the §22 speed metrics. The unit follows the size of
 * the number: "38 min" and "2.4 d" are both useful answers to "how fast did we
 * respond?", while "0.63 h" and "57.6 h" are not.
 *
 * Deliberately unit-suffixed rather than localized prose — these sit in a dense
 * KPI grid where a compact, comparable shape matters more than a sentence.
 */
export function formatHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return "—";
  const abs = Math.abs(hours);
  if (abs < 1) return `${Math.round(hours * 60)} min`;
  if (abs < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

/** A percentage, or an em-dash when there was nothing to divide by. */
export function formatPercent(value: number | null, digits = 1): string {
  return value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)}%`;
}
