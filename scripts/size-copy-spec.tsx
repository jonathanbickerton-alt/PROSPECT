/**
 * REQ-D6-04 decision 4 — THE COPY CARRIES NO TYPED MEGABYTE FIGURE.
 *
 *   npm run spec:size-copy
 *
 * TWO CHECKS, AND THE SECOND IS THE ONE THAT MATTERS. The first mounts
 * HomeTab and reads the drop-zone caption, in all six locales, against
 * MAX_UPLOAD_MB. The second is STRUCTURAL and zero-occurrence: no locale
 * string anywhere may carry a digit followed by a megabyte unit.
 *
 * WHY A ZERO-OCCURRENCE CHECK RATHER THAN A PIN ON THE CAPTION. The caption
 * said "Up to 50MB" through the entire 200MB build and nothing caught it. The
 * 1907 session pinned the BYTE LITERAL in code — MAX_UPLOAD_BYTES — which is
 * exactly the thing that was right; the wrong figure was in a translated
 * sentence, where no code pin was looking. And a grep for "50MB" would still
 * have missed the French copy, which read "50 Mo".
 *
 * So the check is not "is the caption right" but "can a figure be typed into
 * the copy at all". A pin on one key would go stale the moment a seventh
 * mention appears somewhere else; this one cannot, because it asserts the
 * ABSENCE of a shape over every string in every locale.
 *
 * THE PLACEHOLDER IS EXCEPTED, and it is excepted by construction rather than
 * by a rule: "{{p0}} MB" has a brace before the unit, not a digit, so it never
 * matches. "({{p1}} MB)" likewise — the 1 in p1 is followed by "}}", not by a
 * unit. Nothing had to be special-cased, which is what makes the rule cheap.
 */
import * as fs from 'fs';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => {
  if (c) pass++; else fails.push(n + (d ? `  [${d}]` : ''));
};
function report() {
  console.log(`\nsize-copy spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fails.length ? 1 : 0);
}

const LOCALES = ['de', 'en', 'es', 'fr', 'it', 'pt'];

// ── 1. STRUCTURAL — no typed megabyte figure in any locale string ─────────
//
// A DIGIT, optional space, then a megabyte unit in any of the six languages'
// spellings: MB, Mo (French), Mio/MiB. Case-insensitive, because "50mb" is the
// same defect typed differently.
const TYPED_MB = /[0-9]\s?(MB|Mo|MiB|Mio)\b/i;
{
  const offenders: string[] = [];
  for (const loc of LOCALES) {
    const p = `src/locales/${loc}/translation.json`;
    const obj = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, string>;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && TYPED_MB.test(v)) offenders.push(`${loc}:${k}`);
    }
  }
  check('ZERO-OCCURRENCE: no locale string carries a typed megabyte figure',
    offenders.length === 0, offenders.join(', ') || '0 offenders');

  // THE CHECK IS NOT VACUOUS — it must catch the thing it is for. A rule that
  // passes over an empty set, or whose regex never matches anything, is the
  // vacuous-result trap; this proves the matcher on the exact old strings.
  check('ZERO-OCCURRENCE: the matcher catches the old English caption',
    TYPED_MB.test('Up to 50MB (.xlsx, .xls, .csv)'));
  check('ZERO-OCCURRENCE: and the old FRENCH caption, which said "50 Mo"',
    TYPED_MB.test("Jusqu'à 50 Mo (.xlsx, .xls, .csv)"),
    'the spelling a grep for "50MB" would miss');
  check('ZERO-OCCURRENCE: and it does NOT fire on the placeholder form',
    !TYPED_MB.test('Up to {{p0}}MB (.xlsx, .xls, .csv)')
      && !TYPED_MB.test('Reading a.xlsx ({{p1}} MB) — large files'),
    'the placeholder is excepted by construction, not by a special case');

  // The key NAME carried the stale figure too, and that is worth its own
  // assertion: a reader grepping for the limit found `up_to_50mb` and read it
  // as documentation of a rule that had already changed.
  for (const loc of LOCALES) {
    const raw = fs.readFileSync(`src/locales/${loc}/translation.json`, 'utf8');
    check(`ZERO-OCCURRENCE: ${loc} has no up_to_50mb key left`,
      !raw.includes('up_to_50mb'));
  }
}

// ── 2. MOUNTED — the caption renders the CONSTANT, in all six locales ─────
async function main() {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
    { url: 'http://localhost/', pretendToBeVisual: true });
  const g = globalThis as any;
  g.window = dom.window; g.document = dom.window.document;
  Object.defineProperty(g, 'navigator',
    { value: dom.window.navigator, configurable: true, writable: true });
  g.HTMLElement = dom.window.HTMLElement; g.Element = dom.window.Element;
  g.Node = dom.window.Node; g.SVGElement = dom.window.SVGElement;
  g.getComputedStyle = dom.window.getComputedStyle;
  g.requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
  g.cancelAnimationFrame = clearTimeout;
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const i18n = (await import('../src/i18n')).default;
  await (i18n as any).init?.();
  const { MAX_UPLOAD_MB } = await import('../src/utils/ingest');
  const HomeTab: any = (await import('../src/components/HomeTab')).default;

  const noop = () => {};
  const props = {
    data: [], isLoading: false, error: '',
    handleFileUpload: noop, handleImportActualsFile: noop, handleImportSaveFile: noop,
    importSaveResult: null, onDismissImportResult: noop, setActiveView: noop,
  };

  const host = document.getElementById('root')!;
  for (const loc of LOCALES) {
    await (i18n as any).changeLanguage(loc);
    host.replaceChildren();
    const container = document.createElement('div');
    host.appendChild(container);
    const root = createRoot(container);
    await (act as any)(async () => {
      root.render(React.createElement(HomeTab, props));
    });
    const text = container.textContent || '';
    check(`CAPTION ${loc}: renders ${MAX_UPLOAD_MB}, the constant`,
      text.includes(String(MAX_UPLOAD_MB)), text.slice(0, 0) || 'absent');
    check(`CAPTION ${loc}: and no longer says 50`,
      !/\b50\s?(MB|Mo|MiB)\b/i.test(text));
    // The extensions are still there — this was a copy change, not a cut.
    check(`CAPTION ${loc}: still names the accepted extensions`,
      text.includes('.xlsx') && text.includes('.csv'));
    await (act as any)(async () => { root.unmount(); });
  }
  await (i18n as any).changeLanguage('en');
  report();
}

main().catch(e => {
  console.log('\nsize-copy spec: CRASHED — ' + (e?.stack || e));
  process.exit(1);
});
