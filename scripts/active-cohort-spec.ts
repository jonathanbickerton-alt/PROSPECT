/**
 * THE ACTIVE COHORT ROUND TRIP — what a save records about which cohort was on
 * screen.
 *
 *   npm run spec:active-cohort
 *
 * DRIVES THE REAL SEAM. `activeCohortMetaRows` and `readActiveCohortMeta` are
 * imported from the app, never copied — the marketEventExportRow precedent.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - AN AGGREGATE IS THE CASE THAT MATTERS. `Is_Active` marks a match against a
 *    STORE key and the store holds leaves, so an aggregate could never be
 *    marked. Every check here that uses an 'All'-bearing cohort is testing the
 *    thing the old mechanism could not express.
 *  - ABSENCE IS THE FALLBACK SIGNAL. A file with no block must read back null,
 *    not a cohort of empty strings — null is what tells restore to fall back
 *    and announce.
 *  - 'All' IS KEPT VERBATIM. This is a recorded SCOPE, not a data row, so the
 *    ScopeDims rule that 'All' never comes from data does not apply to it.
 *  - IT READS JON'S REAL SAVE when present, and says so loudly when absent
 *    rather than passing on a file it never opened.
 */
import fs from 'fs';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

async function main() {
  const {
    activeCohortMetaRows, readActiveCohortMeta, ACTIVE_COHORT_FIELDS,
  } = await import('../src/utils/forecasting');

  // A Metadata sheet behaves as Field/Value pairs; this is the lookup the app
  // builds over it, so the reader is exercised the way it is really called.
  const getFrom = (rows: { Field: string; Value: unknown }[]) =>
    (field: string) => rows.find(r => r.Field === field)?.Value;

  // ── 1. A LEAF cohort ──────────────────────────────────────────────────────
  const leaf = {
    segment: 'SOHO', product: 'Mobile Voice', productL2: 'Medium Value',
    channel: 'Direct', channelL2: 'Field / Regional Sales',
    tariffL1: 'RED M', tariffL2: 'SIM-only',
  };
  const leafRows = activeCohortMetaRows(leaf);
  check('leaf: the writer emits all seven fields',
    leafRows.length === 7, `${leafRows.length}`);
  check('leaf: field names come from the shared list, so writer and reader agree',
    leafRows.map(r => r.Field).join(',') === ACTIVE_COHORT_FIELDS.map(f => f[0]).join(','));
  const leafBack = readActiveCohortMeta(getFrom(leafRows));
  check('leaf: every dimension survives the round trip',
    !!leafBack && JSON.stringify(leafBack) === JSON.stringify(leaf),
    JSON.stringify(leafBack));

  // ── 2. AN AGGREGATE — the case Is_Active could never express ──────────────
  const agg = {
    segment: 'Corporate', product: 'Mobile Voice', productL2: 'All',
    channel: 'Direct', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
  };
  const aggRows = activeCohortMetaRows(agg);
  const aggBack = readActiveCohortMeta(getFrom(aggRows));
  check('aggregate: it round-trips at all — the whole point of the change',
    !!aggBack && JSON.stringify(aggBack) === JSON.stringify(agg),
    JSON.stringify(aggBack));
  check('aggregate: the literal All is kept VERBATIM, not nulled',
    aggBack?.productL2 === 'All' && aggBack?.tariffL1 === 'All',
    `${aggBack?.productL2}/${aggBack?.tariffL1}`);
  check('aggregate: and the writer wrote All rather than an empty cell',
    aggRows.find(r => r.Field === 'Active_Cohort_Tariff_L1')?.Value === 'All');

  // ── 3. ABSENCE — the fallback signal ──────────────────────────────────────
  check('absent: no active forecast writes NO rows, not seven blanks',
    activeCohortMetaRows(null).length === 0 && activeCohortMetaRows(undefined).length === 0);
  check('absent: a file without the block reads back NULL',
    readActiveCohortMeta(getFrom([])) === null,
    'null is what tells restore to fall back and announce');
  check('absent: a blank segment also reads as absence, not as a cohort',
    readActiveCohortMeta(getFrom([{ Field: 'Active_Cohort_Segment', Value: '' }])) === null);
  // NOT VACUOUS: a present block must read back non-null, or every check above
  // would pass with a reader that always returned null.
  check('absent: CONTROL — a present block reads back NON-null',
    readActiveCohortMeta(getFrom(leafRows)) !== null);

  // A partial block (segment only) still yields a usable cohort, with the rest
  // defaulted to the wildcard rather than to undefined.
  const partial = readActiveCohortMeta(getFrom([{ Field: 'Active_Cohort_Segment', Value: 'SME' }]));
  check('partial: a segment-only block defaults the rest to the wildcard',
    partial?.segment === 'SME' && partial?.product === 'All' && partial?.tariffL2 === 'All',
    JSON.stringify(partial));

  // ── 4. WIRING — the app really uses the seam, both directions ─────────────
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  check('wiring: the exporter writes the block through the shared writer',
    (app.split('activeCohortMetaRows(').length - 1) === 1,
    `${app.split('activeCohortMetaRows(').length - 1} call sites, expected 1`);
  check('wiring: and it writes from the LIVE cohort, aggregate or leaf alike',
    app.includes('...activeCohortMetaRows(baseForecast?.cohort)'));
  check('wiring: restore reads the block through the shared reader',
    (app.split('readActiveCohortMeta(').length - 1) === 1,
    `${app.split('readActiveCohortMeta(').length - 1} call sites, expected 1`);
  check('wiring: the recorded cohort is resolved through the SEAM, not a store lookup',
    app.includes('resolveFromStore(restoredStore, restoredLeafMap, keyFor(recordedActive))'),
    'a store lookup is exactly what cannot find an aggregate');
  check('wiring: the recorded cohort is preferred over the first-entry fallback',
    app.includes('const bf = recordedBf'),
    'the fallback must be second, or the block never bites');
  check('wiring: the fallback sets the announcement state',
    app.includes('if (bf && !recordedBf) setRestoreFellBack(true);'));
  check('wiring: the notice renders and is dismissible',
    app.includes('data-testid="restore-fellback-notice"')
      && app.includes('setRestoreFellBack(false)'));
  check('wiring: the notice lives in the SHELL, not on Home',
    app.indexOf('restore-fellback-notice') < app.indexOf('<StepIndicator'),
    'a restore navigates to the saved Active_Step, so a Home-only notice is unseen');

  // Is_Active is deliberately UNTOUCHED — compat, and DQ owns its future.
  check('wiring: the Is_Active column still ships unchanged',
    app.includes("Is_Active:   storeKey === activeForecastKey ? 'Yes' : 'No',"),
    'this session does not touch the marker sites');

  // i18n — the notice must exist in every locale, or it renders as a raw key.
  const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'];
  const missing = LOCALES.filter(l => {
    const d = JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'));
    return typeof d['restore_fell_back_to_first_cohort'] !== 'string'
        || typeof d['common_dismiss'] !== 'string';
  });
  check('i18n: the notice and its dismiss label exist in all six locales',
    missing.length === 0, missing.join(', '));

  // ── 5. JON'S REAL SAVE — the file the diagnosis was built on ──────────────
  //
  // Loud skip when absent. A spec that quietly passes on a file it never opened
  // reports coverage it does not have.
  const dir = 'C:/Users/jonat/Downloads';
  let real: string | null = null;
  try {
    const hit = fs.readdirSync(dir).find(f => /Forecast Save.*17 Aug 2026 1211\.xlsx$/.test(f));
    if (hit) real = `${dir}/${hit}`;
  } catch { /* directory not present on this machine */ }

  if (!real) {
    console.log('  NOTE: Jon\'s 17 Aug save is not on this machine — the real-file');
    console.log('        case was SKIPPED, not passed. The synthetic cases above stand.');
  } else {
    const XLSX: any = (await import('xlsx')).default ?? (await import('xlsx'));
    const wb = XLSX.read(fs.readFileSync(real));
    const meta: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Metadata']);
    const get = (f: string) => meta.find(r => r.Field === f)?.Value;

    // This file PREDATES the change, so it must take the fallback path — that
    // is the compat guarantee, measured against the artefact rather than argued.
    check('real save: the 17 Aug file has NO active-cohort block',
      readActiveCohortMeta(get) === null,
      'it predates this change, so it must read as absence');

    const bfRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Baseline_Forecasts']);
    const anyActive = bfRows.some(r => r.Is_Active === 'Yes');
    check('real save: and nothing was marked Is_Active — the defect, in the artefact',
      !anyActive,
      'this is why restore fell through to the first stored cohort');
    console.log(`  (real save read: ${bfRows.length} baseline rows, Is_Active='Yes' on ${bfRows.filter(r => r.Is_Active === 'Yes').length})`);
  }

  console.log(`\nactive-cohort spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('active-cohort spec CRASHED —', e); process.exit(1); });
