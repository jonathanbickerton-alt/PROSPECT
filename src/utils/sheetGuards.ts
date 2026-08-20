/**
 * SHEET-LEVEL GUARDS — the placeholder convention, in one place.
 *
 * WHY ITS OWN MODULE, and not `forecasting.ts` where the seams live. The
 * scenario-parser worker must consult this before any row reaches a `fromRow`
 * seam, and the worker's bundle deliberately imports only `xlsx` — pulling
 * `forecasting.ts` (and `date-fns` behind it) into a second 333 kB chunk was
 * measured and refused on 2026-08-19. A predicate with no dependencies costs
 * the worker nothing and gives every consumer the same answer.
 */

/**
 * THE PLACEHOLDER CONVENTION.
 *
 * When this app exports a sheet with nothing in it, it writes ONE row carrying
 * a single `Note` cell — `{ Note: 'No market events defined' }` — so the sheet
 * exists, is self-describing, and does not read as a corrupt empty. Eight
 * export sheets do this.
 *
 * The convention was REAL AND UNWRITTEN: App guards it at nine import sites
 * with an inline `!rows[0]?.Note`, and nothing said so anywhere a new consumer
 * would look. Scenario Compare's per-file parse arrived in 2026-08-19 and could
 * not learn it, so it fed the placeholder to `marketEventFromRow` and produced
 * an event with `scenario=undefined` and `date=''` — which the events panel
 * then rendered to the user as the literal text `"undefined 0"`.
 *
 * THE TEST IS THE SHEET'S SHAPE, NOT THE NOTE'S WORDS. Matching on the message
 * text would tie every consumer to eight English strings and break the moment
 * one was reworded or translated. A placeholder is a single row whose only
 * populated column is `Note` — that is what the writer emits, and it cannot
 * collide with a real event row, because every event sheet writes an `ID`.
 *
 * ABSENCE, NOT ERROR. A placeholder sheet means "the user defined none of
 * these", which is an ordinary and expected state. Callers drop the rows and
 * carry on with an empty array; nothing warns, nothing throws.
 */
export function isPlaceholderSheet(rows: unknown[] | null | undefined): boolean {
  if (!Array.isArray(rows) || rows.length !== 1) return false;
  const row = rows[0];
  if (!row || typeof row !== 'object') return false;

  const keys = Object.keys(row as Record<string, unknown>)
    // A blank trailing cell can survive the sheet reader as an empty string.
    // It is not a column the writer meant, so it must not defeat the test.
    .filter(k => {
      const v = (row as Record<string, unknown>)[k];
      return v !== undefined && v !== null && v !== '';
    });

  return keys.length === 1 && keys[0] === 'Note';
}

/**
 * The rows a consumer should actually read: `[]` for a placeholder sheet,
 * the rows themselves otherwise.
 *
 * Callers use this rather than the predicate directly wherever they simply want
 * the data, so the skip cannot be spelled two ways in two places.
 */
export function rowsOrEmpty<T>(rows: T[] | null | undefined): T[] {
  if (!Array.isArray(rows)) return [];
  return isPlaceholderSheet(rows) ? [] : rows;
}
