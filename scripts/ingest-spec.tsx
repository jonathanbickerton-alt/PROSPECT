/**
 * REQ-D6-04 — the size limit, the pre-parse notice, and the session sniff.
 *
 *   npm run spec:ingest
 *
 * WHAT THIS FILE PROVES THAT NO SOURCE READING CAN. Decision 2 is an ORDERING
 * claim — the notice is in the DOM before the parse starts — and an ordering
 * claim is exactly the kind that reads as true in the source of a handler and
 * is false at run time. So the reader here is a STUB that records when it ran
 * relative to the notice's mount, and the assertions are about that order.
 *
 * WHERE IT MOUNTS, AND WHY NOT App. `src/App.tsx` is mounted by no spec in the
 * repo and is not mountable in a JSDOM harness without the whole upload
 * journey. The orchestration was therefore EXTRACTED to `src/utils/ingest.ts`
 * — which is what makes it testable at all — and this file mounts a small
 * component that renders the notice from `runIngest`'s own callbacks, i.e.
 * the exact seam App's three handlers use. That the three handlers call it is
 * pinned separately, structurally, in section 5.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis as any;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.HTMLElement = dom.window.HTMLElement; g.Element = dom.window.Element; g.Node = dom.window.Node;
g.SVGElement = dom.window.SVGElement;
g.getComputedStyle = dom.window.getComputedStyle;
// A REAL TWO-FRAME rAF, not an alias for setTimeout(0): `nextPaint` nests two
// of these deliberately, and a stub that fired synchronously would make the
// yield untestable by removing the thing under test.
g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 0);
g.cancelAnimationFrame = clearTimeout;
g.MutationObserver = dom.window.MutationObserver;
g.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
g.IS_REACT_ACT_ENVIRONMENT = true;

import fs from 'fs';
import {
  MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, fileSizeMb, fileSizeRefusal,
  ingestNoticeText, loadedLineText, isSessionWorkbook, runIngest,
} from '../src/utils/ingest';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

/** The i18n shape App passes, resolved from the REAL en bundle so the copy
 *  under test is the copy that ships. */
const EN = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
const t = (key: string, params?: Record<string, unknown>) => {
  let s = String(EN[key] ?? key);
  for (const [k, v] of Object.entries(params ?? {})) s = s.split(`{{${k}}}`).join(String(v));
  return s;
};

const MB = 1024 * 1024;
const file = (name: string, mb: number) => ({ name, size: Math.round(mb * MB) });

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE ONE CONSTANT — decision 1
// ═══════════════════════════════════════════════════════════════════════════
{
  check('CONSTANT: the limit is 200MB, in bytes',
    MAX_UPLOAD_BYTES === 200 * 1024 * 1024, String(MAX_UPLOAD_BYTES));
  check('CONSTANT: the MB figure is DERIVED from the bytes, not re-typed',
    MAX_UPLOAD_MB === 200, String(MAX_UPLOAD_MB));

  // THE BOUNDARY, both sides, to the byte. The brief's case is 200MB+1.
  check('LIMIT: exactly 200MB is ACCEPTED',
    fileSizeRefusal({ name: 'a.xlsx', size: MAX_UPLOAD_BYTES }, t) === null);
  check('LIMIT: 200MB + 1 byte is REFUSED',
    fileSizeRefusal({ name: 'a.xlsx', size: MAX_UPLOAD_BYTES + 1 }, t) !== null);
  check('LIMIT: 199MB is accepted', fileSizeRefusal(file('a.xlsx', 199), t) === null);

  // DECISION 1: THE MESSAGE STATES BOTH FIGURES. Asserted by content, not by
  // presence — a refusal naming neither number is the state this replaced.
  const msg = fileSizeRefusal(file('big.xlsx', 250), t)!;
  check('MESSAGE: it names the FILE', msg.includes('big.xlsx'), msg);
  check('MESSAGE: it names the file SIZE', msg.includes('250.0'), msg);
  check('MESSAGE: it names the LIMIT', msg.includes('200'), msg);
  check('MESSAGE: and it is not the old sentence',
    !msg.includes('50MB'), msg);

  check('MB: rounds to one decimal', fileSizeMb(Math.round(1.25 * MB)) === 1.3,
    String(fileSizeMb(Math.round(1.25 * MB))));
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. THE ORDER — decision 2, and the reason this file exists
// ═══════════════════════════════════════════════════════════════════════════
async function orderSection() {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');

  /** A component that renders the notice from `runIngest`'s own callback —
   *  the same seam App's handlers use. */
  let start: ((f: any) => void) | null = null;
  const log: string[] = [];
  let readCalls = 0;
  let noticeInDomWhenReadRan: boolean | null = null;

  const Harness: React.FC<any> = ({ onDone }) => {
    const [notice, setNotice] = (React as any).useState(null);
    const [refusal, setRefusal] = (React as any).useState(null);
    const [line, setLine] = (React as any).useState(null);
    start = (f: any) => {
      void runIngest<number>({
        file: f, t,
        showNotice: (s: string | null) => { log.push(s === null ? 'notice:clear' : 'notice:show'); setNotice(s); },
        onRefuse: (m: string) => { log.push('refuse'); setRefusal(m); },
        read: () => {
          readCalls++;
          log.push('read');
          // THE DECISIVE OBSERVATION: is the notice on screen at the moment
          // the parse begins? Read from the DOM, not from React state.
          noticeInDomWhenReadRan = !!document.querySelector('[data-testid="ingest-notice"]');
          return 1234;
        },
        onResult: (rows: number, ms: number) => {
          log.push('result');
          setLine(loadedLineText(rows, ms, t));
          onDone?.();
        },
      });
    };
    return React.createElement('div', null,
      notice ? React.createElement('div', { 'data-testid': 'ingest-notice' }, notice) : null,
      refusal ? React.createElement('div', { 'data-testid': 'ingest-refusal' }, refusal) : null,
      line ? React.createElement('div', { 'data-testid': 'ingest-loaded' }, line) : null,
    );
  };

  const host = document.getElementById('root')!;
  const mount = async () => {
    host.replaceChildren();
    const c = document.createElement('div');
    host.appendChild(c);
    const root = createRoot(c);
    await (act as any)(async () => { root.render(React.createElement(Harness, {})); });
    return c;
  };

  /** Let the two nested rAFs and the promise chain drain. */
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      await (act as any)(async () => { await new Promise(r => setTimeout(r, 0)); });
    }
  };

  // ── An oversized file: the reader is NEVER CALLED ──────────────────────
  {
    const c = await mount();
    log.length = 0; readCalls = 0; noticeInDomWhenReadRan = null;
    await (act as any)(async () => { start!(file('huge.xlsx', 201)); });
    await settle();
    check('REFUSED: the parse is never even attempted', readCalls === 0, String(readCalls));
    check('REFUSED: no notice was shown', !log.includes('notice:show'), log.join(','));
    check('REFUSED: the refusal is on screen',
      !!c.querySelector('[data-testid="ingest-refusal"]'));
    check('REFUSED: and it names both figures',
      (c.querySelector('[data-testid="ingest-refusal"]')?.textContent ?? '').includes('201.0')
      && (c.querySelector('[data-testid="ingest-refusal"]')?.textContent ?? '').includes('200'),
      c.querySelector('[data-testid="ingest-refusal"]')?.textContent ?? '');
  }

  // ── A 199MB file: accepted, and the NOTICE IS IN THE DOM FIRST ─────────
  {
    const c = await mount();
    log.length = 0; readCalls = 0; noticeInDomWhenReadRan = null;
    await (act as any)(async () => { start!(file('ok.xlsx', 199)); });
    await settle();
    check('ACCEPTED: the parse ran once', readCalls === 1, String(readCalls));
    check('ORDER: the notice was SHOWN before the parse was called',
      log.indexOf('notice:show') >= 0 && log.indexOf('notice:show') < log.indexOf('read'),
      log.join(','));
    // THE CHECK THE FEATURE IS FOR. Not "showNotice was called first" — that
    // is a claim about a callback — but "the element was in the DOM when the
    // parse began", which is what a user sees.
    check('ORDER: the notice ELEMENT was in the DOM when the parse began',
      noticeInDomWhenReadRan === true, String(noticeInDomWhenReadRan));
    check('ORDER: and the notice is cleared afterwards',
      log[log.length - 1] === 'notice:clear'
      && !c.querySelector('[data-testid="ingest-notice"]'), log.join(','));
    check('LOADED: the success line is on screen',
      !!c.querySelector('[data-testid="ingest-loaded"]'));
    // DECISION 2: THE MEASURED TIME. The stub returns instantly, so the figure
    // is 0.0 s — the assertion is that the line CARRIES a seconds figure at
    // all, which is what trap 214 removes.
    const loaded = c.querySelector('[data-testid="ingest-loaded"]')?.textContent ?? '';
    check('LOADED: it names the row count', loaded.includes('1,234'), loaded);
    check('LOADED: it carries a measured seconds figure',
      /\d+\.\d\s*s/.test(loaded), loaded);
  }

  // ── A throwing parse must not leave the notice up ──────────────────────
  {
    const c = await mount();
    let caught: unknown = null;
    await (act as any)(async () => {
      void runIngest<number>({
        file: file('bad.xlsx', 1), t,
        showNotice: () => {},
        onRefuse: () => {},
        read: () => { throw new Error('boom'); },
        onResult: () => {},
        onError: (e) => { caught = e; },
      });
    });
    await settle();
    check('THROWS: the error reaches onError rather than escaping', !!caught);
    check('THROWS: and no notice is left on screen',
      !c.querySelector('[data-testid="ingest-notice"]'));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. THE NOTICE TEXT — decision 2's copy
// ═══════════════════════════════════════════════════════════════════════════
{
  const n = ingestNoticeText(file('Big Input.xlsx', 123.4), t);
  check('NOTICE: it names the file', n.includes('Big Input.xlsx'), n);
  check('NOTICE: it names the size in MB', n.includes('123.4'), n);
  check('NOTICE: it warns the page will not respond',
    /not respond/i.test(n), n);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. THE SNIFF — decision 3
// ═══════════════════════════════════════════════════════════════════════════
{
  check('SNIFF: Metadata AND Market_Events is a session file',
    isSessionWorkbook(['Actuals', 'Baseline_Forecasts', 'Market_Events', 'Metadata']));
  // BOTH, NEVER EITHER — trap 216 plants the loosening.
  check('SNIFF: Metadata ALONE is NOT enough',
    !isSessionWorkbook(['Fact_IBRO', 'Metadata']));
  check('SNIFF: Market_Events alone is not enough',
    !isSessionWorkbook(['Fact_IBRO', 'Market_Events']));
  check('SNIFF: a plain IBRO workbook is not a session file',
    !isSessionWorkbook(['Fact_IBRO']));
  check('SNIFF: an absent sheet list is not a session file',
    !isSessionWorkbook(undefined));
  check('SNIFF: names are matched EXACTLY, not case-folded',
    !isSessionWorkbook(['metadata', 'market_events']));
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. THE THREE CALL SITES — structural, because App is not mountable here
// ═══════════════════════════════════════════════════════════════════════════
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const runs = (app.match(/runIngest</g) ?? []).length;
  check('SITES: EXACTLY three ingest paths call runIngest', runs === 3, String(runs));
  // THE ZERO-OCCURRENCE CHECK the brief asks for. The old literal is gone from
  // App entirely, and so is its sentence — a limit that survives anywhere in
  // this file is a second limit, which is the state decision 1 removes.
  check('SITES: the 50MB literal is GONE from App', !app.includes('50 * 1024 * 1024'));
  check('SITES: and so is its message', !app.includes('50MB limit'));
  // NO OTHER NUMERIC LIMIT in the ingest paths. `MAX_UPLOAD_BYTES` is the only
  // size rule, and it is not spelled in App at all.
  check('SITES: App spells no byte-size limit of its own',
    !/\b\d+\s*\*\s*1024\s*\*\s*1024\b/.test(app), 'a byte literal remains in App.tsx');
  check('SITES: the sniff is called', app.includes('isSessionWorkbook(wb.SheetNames)'));
  check('SITES: the measured time reaches the success line',
    app.includes('loadedLineText(jsonData.length, parseMs, t)'));

  const ing = fs.readFileSync('src/utils/ingest.ts', 'utf8');
  check('SITES: nextPaint nests TWO rAFs, not one',
    ing.includes('raf(() => raf(() => resolve()))'), 'the double-rAF yield');
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. THE KEYS — six locales, never English in five of them
// ═══════════════════════════════════════════════════════════════════════════
{
  const LOC = ['en', 'de', 'es', 'fr', 'it', 'pt'];
  const KEYS = ['app_file_too_large', 'app_reading_notice', 'app_loaded_rows',
    'app_routed_to_import_save'];
  const missing: string[] = []; const leak: string[] = []; const ph: string[] = [];
  for (const l of LOC) {
    const d = JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'));
    for (const k of KEYS) {
      if (typeof d[k] !== 'string' || !d[k].length) { missing.push(`${l}/${k}`); continue; }
      if (l !== 'en' && d[k] === EN[k]) leak.push(`${l}/${k}`);
    }
    // The placeholders must survive translation or the notice renders a
    // literal {{p0}} in five languages.
    if (d.app_reading_notice && !(d.app_reading_notice.includes('{{p0}}')
      && d.app_reading_notice.includes('{{p1}}'))) ph.push(`${l}/notice`);
    if (d.app_file_too_large && !(d.app_file_too_large.includes('{{p0}}')
      && d.app_file_too_large.includes('{{p1}}')
      && d.app_file_too_large.includes('{{p2}}'))) ph.push(`${l}/too_large`);
    if (d.app_loaded_rows && !(d.app_loaded_rows.includes('{{p0}}')
      && d.app_loaded_rows.includes('{{p1}}'))) ph.push(`${l}/loaded`);
  }
  check('i18n: every REQ-D6-04 key in all six locales', missing.length === 0, missing.join(', '));
  check('i18n: no locale carries the English string verbatim', leak.length === 0, leak.join(', '));
  check('i18n: every placeholder survives translation', ph.length === 0, ph.join(', '));
}

orderSection()
  .then(() => {
    console.log(`\ningest spec: ${pass} passed, ${fails.length} failed`);
    fails.forEach(f => console.log('  FAIL  ' + f));
    process.exit(fails.length ? 1 : 0);
  })
  .catch(e => { console.log('\ningest spec: CRASHED — ' + (e?.stack || e)); process.exit(1); });
