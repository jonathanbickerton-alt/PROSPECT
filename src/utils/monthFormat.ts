/**
 * MONTH LABELS IN THE USER'S LANGUAGE.
 *
 * `format(d, 'MMM yyyy')` with no locale is English, always — so a German
 * session's Step 2 chart read "Oct 2026" and "Dec 2026" on its x-axis, in its
 * tooltip, and in eight table cells, while every word around them was German.
 * Nothing in the locale bundles could reach it: these are FORMATTED DATES, not
 * strings, so the parity spec could never have seen the gap and the 1028 sweep
 * logged it as needing a formatter rather than a translation.
 *
 * The date-fns locale is chosen from the app's active language, with English as
 * the fallback for anything unmapped — the same principle as
 * `forecastTypeLabel`: name the thing in English rather than render nothing.
 *
 * `i18n.language` can carry a region ("de-DE", "pt-BR"), so only the primary
 * subtag is matched. Getting that wrong would silently fall back to English for
 * every regioned language, which looks exactly like the bug this fixes.
 */
import { format, parse, isValid } from 'date-fns';
import { de, es, fr, it, pt, enGB } from 'date-fns/locale';
import type { Locale } from 'date-fns';

const LOCALES: Readonly<Record<string, Locale>> = { de, es, fr, it, pt, en: enGB };

export function dateLocaleFor(language: string | undefined): Locale {
  const primary = String(language ?? 'en').toLowerCase().split('-')[0];
  return LOCALES[primary] ?? enGB;
}

/**
 * `yyyy-MM` in, "MMM yyyy" out, in the given language. Anything unparseable is
 * returned unchanged — a month string this cannot read is more useful on screen
 * as itself than as "Invalid Date".
 */
export function monthLabel(month: string, language: string | undefined): string {
  try {
    const d = parse(month, 'yyyy-MM', new Date());
    return isValid(d) ? format(d, 'MMM yyyy', { locale: dateLocaleFor(language) }) : month;
  } catch {
    return month;
  }
}

/**
 * The same label from a Date rather than a `yyyy-MM` string — the spread and
 * ramp month pickers build their months by `addMonths`, so they never have the
 * string form. Two call sites, both inside the event forms, both English-only
 * until 2026-09-02.
 */
export function formatMonthDate(d: Date, language: string | undefined): string {
  return isValid(d) ? format(d, 'MMM yyyy', { locale: dateLocaleFor(language) }) : '';
}
