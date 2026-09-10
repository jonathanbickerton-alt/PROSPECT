/**
 * REQ-D6-04 — INGEST: the size limit, the pre-parse notice, and the sniff.
 *
 * WHY A MODULE. The three ingest paths are three inline handlers inside a
 * ten-thousand-line component, and before this file they shared nothing: one
 * carried a 50MB literal and the other two carried no limit at all. A rule
 * that lives in one handler is a rule two handlers do not have.
 *
 * It is also the only way any of this can be TESTED. `src/App.tsx` is mounted
 * by no spec in the repo, so an ordering guarantee written inside a handler
 * there could only ever be asserted by reading the source. Here a spec drives
 * the real orchestrator with a stub reader and watches when it runs.
 *
 * WHAT THIS FILE DOES NOT DO: it does not parse, and it does not know what a
 * workbook is. `runIngest` is handed a `read` function and calls it; the
 * SheetJS options stay at the call sites where they always were.
 */

/**
 * REQ-D6-04 decision 1 — THE ONE SIZE LIMIT.
 *
 * 200MB, in bytes, read by all three ingest paths. The 1147-report measured
 * 200MB at 13.4s and ~960MB peak heap in Node with neither a 2GB nor a 4GB
 * cap failing, so the binding constraint at this size is the frozen main
 * thread rather than memory — which is what decision 2's notice addresses and
 * why the limit could move from 50MB at all.
 *
 * A CONSTANT AND NOT A LITERAL, and the distinction is the whole of decision 1:
 * three call sites reading three literals is how the previous state arose,
 * where the input drop refused at 50MB and Import Save accepted anything.
 */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** The same figure in MB, for the copy. Derived, never re-typed. */
export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / 1024 / 1024;

/** Minimal shape of the browser File this module needs — so a spec can pass a
 *  plain object and does not need a real Blob to exercise the rules. */
export interface IngestFile {
  name: string;
  size: number;
}

/** MB to one decimal place, the unit both messages speak. */
export function fileSizeMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

/** Translator seam — the same `(key, params) => string` shape App passes. */
export type IngestT = (key: string, params?: Record<string, unknown>) => string;

/**
 * The refusal, or null when the file is within the limit.
 *
 * DECISION 1: THE MESSAGE STATES BOTH FIGURES. "File size exceeds 50MB limit."
 * told a user neither how big their file was nor, after a limit change, which
 * limit they had hit. A refusal that cannot be acted on is a refusal that gets
 * reported as a bug.
 */
export function fileSizeRefusal(file: IngestFile, t: IngestT): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null;
  return t('app_file_too_large', {
    p0: file.name,
    p1: fileSizeMb(file.size).toFixed(1),
    p2: String(MAX_UPLOAD_MB),
  });
}

/** Decision 2's notice text. */
export function ingestNoticeText(file: IngestFile, t: IngestT): string {
  return t('app_reading_notice', {
    p0: file.name,
    p1: fileSizeMb(file.size).toFixed(1),
  });
}

/**
 * Decision 2's success line, carrying the MEASURED parse time.
 *
 * SECONDS TO ONE DECIMAL, from a real clock at the call site. The point of the
 * line is that the figure in the notice ("up to a minute") gets replaced by
 * something read from the app rather than estimated — so this must never be
 * given a default or a rounded-to-zero value.
 */
export function loadedLineText(rows: number, ms: number, t: IngestT): string {
  return t('app_loaded_rows', {
    p0: rows.toLocaleString(),
    p1: (ms / 1000).toFixed(1),
  });
}

/**
 * Decision 3 — IS THIS WORKBOOK A SAVED SESSION?
 *
 * BOTH sheets, never either. `Metadata` alone is not enough: it is a plausible
 * name for a hand-made tab in an analyst's own workbook, and misrouting an
 * input file into Import Save would show a user a validation error about
 * sheets they have never heard of. `Market_Events` is a name this app coined,
 * so the PAIR is what makes the inference safe. Trap 216 plants the loosening.
 *
 * NAMES ONLY. The caller supplies `SheetNames`, which SheetJS will produce
 * from `{ bookSheets: true }` in about 4ms against 766ms for a full parse
 * (measured, 1147 report) — so on a reader that supports it the sniff is free.
 * Where the caller has already parsed, passing the parsed names costs nothing
 * extra; see the call site, which states which of the two it is doing.
 */
export function isSessionWorkbook(sheetNames: readonly string[] | undefined): boolean {
  if (!sheetNames) return false;
  return sheetNames.includes('Metadata') && sheetNames.includes('Market_Events');
}

/**
 * A YIELD LONG ENOUGH FOR THE BROWSER TO PAINT.
 *
 * TWO nested `requestAnimationFrame`s, not one and not `setTimeout(0)`. A
 * single rAF callback runs BEFORE the paint it is scheduled against, so a
 * synchronous parse started there still blocks the frame the notice was
 * supposed to appear in — the notice would be in the DOM and invisible, which
 * is the exact failure this exists to prevent and is indistinguishable from
 * no notice at all. The second rAF runs after that paint has been committed.
 *
 * `setTimeout` is the fallback for environments with no rAF (JSDOM without a
 * stub, and any non-browser caller), where there is nothing to paint anyway.
 */
export function nextPaint(): Promise<void> {
  return new Promise<void>(resolve => {
    const raf = (globalThis as any).requestAnimationFrame;
    if (typeof raf === 'function') raf(() => raf(() => resolve()));
    else setTimeout(resolve, 0);
  });
}

export interface RunIngestParams<T> {
  file: IngestFile;
  t: IngestT;
  /** Paint the notice, or clear it when passed null. */
  showNotice: (text: string | null) => void;
  /** Report a refusal. Called INSTEAD of `read`, never as well. */
  onRefuse: (message: string) => void;
  /** The synchronous parse. Called only after the notice has painted. */
  read: (file: IngestFile) => T | Promise<T>;
  /** Handed the parse result and the measured wall time in milliseconds. */
  onResult: (value: T, ms: number) => void;
  /** Errors from `read`, so a throw cannot leave the notice on screen. */
  onError?: (err: unknown) => void;
}

/**
 * DECISION 2, AS CONTROL FLOW: refuse, or paint then parse — never parse then
 * paint, and never both.
 *
 * THE ORDER IS THE FEATURE. Every line below is sequenced deliberately:
 *
 *  1. The size check runs FIRST and returns. A refused file must not reach
 *     `read` at all — not "must not be parsed successfully", must not be
 *     CALLED, because a 300MB file handed to SheetJS is the freeze the limit
 *     exists to prevent. The spec asserts the stub reader's call count is 0.
 *  2. The notice is shown BEFORE the yield, so it is in the DOM by the time
 *     the frame is committed.
 *  3. `await nextPaint()` — see above. Removing it is trap 213, and the trap
 *     is asserted by CALL ORDER rather than by anything visual, because a
 *     spec cannot see a paint.
 *  4. `read` runs, timed across its own call and nothing else.
 *  5. The notice is cleared in a `finally`, so a throwing parse does not leave
 *     "Reading …" on screen for ever.
 */
export async function runIngest<T>(p: RunIngestParams<T>): Promise<void> {
  const refusal = fileSizeRefusal(p.file, p.t);
  if (refusal !== null) {
    p.onRefuse(refusal);
    return;
  }

  p.showNotice(ingestNoticeText(p.file, p.t));
  await nextPaint();

  const t0 = Date.now();
  try {
    const value = await p.read(p.file);
    p.onResult(value, Date.now() - t0);
  } catch (err) {
    if (p.onError) p.onError(err);
    else throw err;
  } finally {
    p.showNotice(null);
  }
}
