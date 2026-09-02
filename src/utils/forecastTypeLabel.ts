/**
 * THE DISPLAY SIDE OF `forecastType` — TERMBASE §11's split rule applied.
 *
 * `'Standard Forecast'` and `'What-If Analysis'` are the code's INTERNAL
 * forecast-type names. They are load-bearing identifiers: each appears inside
 * the composite `cohortId` (`…|Standard Forecast|${scenario}`), in map keys, in
 * equality comparisons, and in the `Forecast_Type` column of an exported save
 * that a later session reads back. §11 is unambiguous about that shape — the
 * identifier stays a literal, and the display form is keyed separately. Never
 * one string doing both.
 *
 * §11 also carried an open question, in these words:
 *
 *   "`forecastType` values are rendered in a 'Forecast Type' column in the
 *    Overall Forecast view. If that column prints the raw internal value rather
 *    than a mapped display label, the internal name does surface to the user and
 *    needs a display mapping. Confirm before phase 2."
 *
 * CONFIRMED, 2026-09-02, and worse than the question assumed: the raw value
 * surfaces at FOUR sites, not one — the Overall view's type filter and its
 * table cell, the generate modal's summary line, and the view-cohort modal's
 * title. The section immediately above that question asserts "Verified: no JSX
 * text occurrence of either internal name", and that verification had gone
 * stale. This module is the mapping it asked for.
 *
 * The keys are the ones the app already uses for these things in its own
 * navigation, rather than new ones: a user who reads "Standardprognose" in the
 * nav should read "Standardprognose" here too.
 *
 * UNKNOWN TYPES FALL BACK TO THE RAW VALUE. That is deliberate. A blank cell
 * would hide a forecast type nobody has mapped yet; the English internal name
 * at least names it, and reads as the loose end it is.
 */
export const FORECAST_TYPE_KEY: Readonly<Record<string, string>> = {
  'Standard Forecast': 'standard_forecast',
  'What-If Analysis': 'what_if',
};

export function forecastTypeLabel(t: (k: string) => string, value: string): string {
  if (!value) return value;
  const key = FORECAST_TYPE_KEY[value];
  return key ? t(key) : value;
}
