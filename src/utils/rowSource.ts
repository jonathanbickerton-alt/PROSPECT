/**
 * REQ-D8-01 — THE ROW-SOURCE SEAM.
 *
 * Everything downstream of a file parse takes PLAIN ROWS: an array of objects
 * for one sheet, or a record of sheet name → rows for a session. A BigQuery
 * source will hand rows in at the same points; an Excel source reaches them
 * through `sheetRowsFromWorkbook`, which is the ONE place a workbook's sheets
 * become rows for the baseline upload and the session restore.
 *
 * The options are today's, unchanged: `sheet_to_json(ws)` with none, so the
 * first row is the header, blank cells are absent keys, and a date cell is
 * whatever `XLSX.read(..., { cellDates: true })` made of it.
 */
import * as XLSX from 'xlsx';

/** Sheet name → that sheet's rows. */
export type SheetRows = Record<string, any[]>;

/**
 * THE ONE WORKBOOK WRAPPER: every sheet of a parsed workbook, as rows, keyed
 * by sheet name. Used by the baseline upload and by Import Save / the drop-zone
 * routing; nothing downstream of either sees a workbook.
 */
export function sheetRowsFromWorkbook(wb: { SheetNames: string[]; Sheets: Record<string, any> }): SheetRows {
  const out: SheetRows = {};
  wb.SheetNames.forEach(name => {
    out[name] = XLSX.utils.sheet_to_json(wb.Sheets[name]);
  });
  return out;
}

/**
 * THE WRITER'S MIRROR of the wrapper above: a session save record, serialised
 * exactly as the export always did it — one `json_to_sheet(rows)` per sheet,
 * appended in the record's own order. The record already carries each sheet's
 * placeholder row where it has nothing to say; this adds nothing and drops
 * nothing.
 */
export function workbookFromSheetRows(record: SheetRows): any {
  const wb = XLSX.utils.book_new();
  Object.entries(record).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  });
  return wb;
}

/**
 * REQ-D8-01 clause 21 — THE COLUMN LIST IS THE UNION OF KEYS OVER ALL ROWS,
 * in first-seen order: `seed` first (when given), then row 0's keys in their
 * order, then each new key as it first appears.
 *
 * "Keys of row 0" is what this replaces. `sheet_to_json` omits a blank cell's
 * key, so a column whose first row is blank — `Applied_Flow_Rate_%` in every
 * IBRO fixture, populated only on later rows — was missing from the column
 * list entirely while its values sat in `data`.
 */
export function columnsFromRows(rows: readonly object[], seed: readonly string[] = []): string[] {
  const seen = new Set<string>(seed);
  const out: string[] = [...seen];
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) { seen.add(k); out.push(k); }
    }
  }
  return out;
}
