/**
 * SCENARIO COMPARE'S PER-FILE EVENTS SUMMARY — R6 session 2.
 *
 *   npm run spec:compare-events-panel
 *
 * Drives the REAL pipeline end to end: raw sheet rows -> the real fromRow seams
 * -> the real `buildEventsSummaryRows` -> the four real summarisers. Nothing is
 * reimplemented here, which is the point: a fifth copy of a summariser is the
 * failure mode this programme has already paid for, so the check that a panel
 * says the right thing must go through the same functions the panel does.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - EVERY EVENT IS BOTH FILE-UNIQUE AND CARRIER-UNIQUE. `File A market` cannot
 *    be confused with `File B market` or with `File A yield`, so a leak names
 *    both the file it came from and the carrier it belongs to. Shared values
 *    would let two files cover for each other and the separation check would
 *    pass on a merged table.
 *  - EXPECTED STRINGS ARE HAND-WRITTEN, never computed by the function under
 *    test. `summary(e) === summary(e)` is the vacuous shape the R4 spec header
 *    already warns about; every assertion here names the literal it wants.
 *  - PIPELINE ORDER IS CHECKED WHERE MONTHS FIGHT IT. A yield event in an
 *    EARLIER month than a market event must still sort below it — order is by
 *    carrier pass first, month only within a pass. A fixture where months agree
 *    with pass order would pass under a plain month sort and prove nothing.
 *  - THE PARSE USES source 'session', because a Compare upload IS a PROSPECT
 *    save. Asserted, since 'workbook' would mint ids and negate Outflow.
 */
import fs from 'fs';
import { buildPerFileEventPanels } from '../src/utils/forecasting';
import { isPlaceholderSheet, rowsOrEmpty } from '../src/utils/sheetGuards';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
const t = (k: string, p?: Record<string, unknown>) => {
  let s = en[k];
  if (typeof s !== 'string') return `!!MISSING:${k}!!`;
  for (const [n, v] of Object.entries(p ?? {})) s = s.split(`{{${n}}}`).join(String(v));
  return s;
};

// ── DRIVES THE REAL BUILDER, and that changed mid-session ──────────────────
//
// This file first composed the parse itself, mirroring the tab's memo. That
// made every separation assertion below VACUOUS with respect to the app: the
// tab could have been pointed at the merged event list and these checks would
// have stayed green, because they were exercising the spec's own composition.
// Caught by asking what guard-trap (a) would actually turn red.
//
// So the per-file build was extracted to buildPerFileEventPanels and this file
// drives it. The separation checks now fail if the APP merges files, which is
// the only version of them worth having.
const panelsFor = (sessions: any[]) => buildPerFileEventPanels(sessions, t);
const panelFor = (session: any) => panelsFor([{ fileName: 'one.xlsx', ...session }])[0].rows;

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURES — every value carries its file AND its carrier.
// ═══════════════════════════════════════════════════════════════════════════

const FILE_A = {
  fileName: 'alpha.xlsx',
  marketEvents: [{
    ID: 'a-mkt', Name: 'A Market Volume', Scenario: 'Inflow', Segment: 'A Market Segment',
    Product: 'Mobile Voice', Channel: 'Direct', Start_Month: '2026-06',
    Subscriber_Volume: 1200, Is_Promotion: 'No', Sequence: 1,
  }, {
    // isPromotion routing: this one IS a promotion and must take the other
    // summariser and the other card label.
    ID: 'a-promo', Name: 'A Market Promo', Scenario: 'Inflow', Segment: 'A Promo Segment',
    Product: 'Mobile Voice', Channel: 'Direct', Start_Month: '2026-07',
    Subscriber_Volume: 800, Is_Promotion: 'Yes', Sequence: 2,
  }],
  // MONTH 2026-01 — EARLIER than every market event above. Pipeline order must
  // still put this below them.
  yieldEvents: [{
    ID: 'a-yld', Name: 'A Yield', IBRO: 'Inflow', Segment: 'A Yield Segment',
    Product: 'Fixed Connectivity', Channel_L1: 'Indirect', Channel_L2: 'All',
    Month: '2026-01', Roll_Forward: 'No', Mix_Axis: 'value',
    Tariff_Mix_JSON: '{"Low":40,"High":60}',
    Tariff_Base_ARPU_JSON: '{"Low":10,"High":20}',
  }],
  pricingEvents: [{
    ID: 'a-prc', Name: 'A Pricing', Segment: 'A Pricing Segment', Product: 'Mobile Data',
    Channel_L1: 'Partner', Month: '2026-02', Input_Mode: 'percentage', Amount: 5,
    Target: 'cohorts', Cohort_Scope: 'both', Duration: 'one-off', Original_Base_ARPU: 20,
  }],
};

const FILE_B = {
  fileName: 'beta.xlsx',
  marketEvents: [{
    ID: 'b-mkt', Name: 'B Market Volume', Scenario: 'Retention', Segment: 'B Market Segment',
    Product: 'Broadband', Channel: 'Retail', Start_Month: '2026-06',
    Subscriber_Volume: 300, Is_Promotion: 'No', Sequence: 1,
  }],
  yieldEvents: [],
  pricingEvents: [{
    // THE DILUTION FRAMING — must read as the dilution sentence, not as a rate.
    ID: 'b-prc', Name: 'B Pricing Dilution', Segment: 'B Pricing Segment',
    Product: 'Mobile Data', Channel_L1: 'Partner', Month: '2026-03',
    Input_Mode: 'percentage', Amount: 6.6, Target: 'cohorts', Cohort_Scope: 'both',
    Duration: 'one-off', Original_Base_ARPU: 20,
    Pricing_Mode: 'dilution', Dilution_Current_Pct: 25, Dilution_Target_Pct: 20,
  }],
};

const EMPTY_FILE = { fileName: 'empty.xlsx', marketEvents: [], yieldEvents: [], pricingEvents: [] };

// BOTH FILES THROUGH ONE CALL. Building each panel from a single-file list
// could never observe a cross-file leak — there would be nothing to leak from.
// The tab passes every loaded session at once, so the spec must too.
const allPanels = panelsFor([FILE_A, FILE_B, EMPTY_FILE]);
const panelA = allPanels[0].rows;
const panelB = allPanels[1].rows;
const panelEmpty = allPanels[2].rows;

const textOf = (rows: any[]) => rows.map(r => `${r.card}|${r.name}|${r.adjusts}|${r.scope}|${r.when}`).join('\n');

// ═══════════════════════════════════════════════════════════════════════════
// 1. PER-FILE SEPARATION — the defect this panel exists to avoid
// ═══════════════════════════════════════════════════════════════════════════
{
  const a = textOf(panelA), b = textOf(panelB);

  // Named individually so a failure says WHICH file leaked into WHICH.
  for (const v of ['B Market Volume', 'B Market Segment', 'B Pricing Dilution', 'B Pricing Segment']) {
    check(`SEPARATION: file B's "${v}" never appears in file A's panel`,
      !a.includes(v), 'file B leaked into file A — the panel is reading merged events');
  }
  for (const v of ['A Market Volume', 'A Market Promo', 'A Yield', 'A Pricing',
                   'A Yield Segment', 'A Pricing Segment']) {
    check(`SEPARATION: file A's "${v}" never appears in file B's panel`,
      !b.includes(v), 'file A leaked into file B — the panel is reading merged events');
  }

  check('SEPARATION: each panel holds exactly its own events',
    panelA.length === 4 && panelB.length === 2,
    `A=${panelA.length} (expected 4), B=${panelB.length} (expected 2)`);

  // A merged table would have 6 rows in BOTH panels. Stated as its own check so
  // the failure names the actual symptom rather than a count mismatch.
  check('SEPARATION: neither panel holds the MERGED total',
    panelA.length !== 6 && panelB.length !== 6,
    'both panels show every event from every file');
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. ALL THREE CARRIERS REACH THE PANEL
// ═══════════════════════════════════════════════════════════════════════════
{
  const a = textOf(panelA);
  check('COVERAGE: the MARKET carrier reaches the panel',
    a.includes('A Market Volume'), 'market events are missing from the per-file parse');
  check('COVERAGE: the YIELD carrier reaches the panel',
    a.includes('A Yield'), 'yield events are missing from the per-file parse');
  check('COVERAGE: the PRICING carrier reaches the panel',
    a.includes('A Pricing'), 'pricing events are missing from the per-file parse');

  check('COVERAGE: and each contributes exactly one pass value',
    JSON.stringify(panelA.map(r => r.pass)) === JSON.stringify([0, 0, 1, 2]),
    JSON.stringify(panelA.map(r => r.pass)));
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. PIPELINE ORDER — checked where months FIGHT it
// ═══════════════════════════════════════════════════════════════════════════
{
  // A's yield is 2026-01 and A's pricing is 2026-02; both market events are
  // 2026-06 and 2026-07. A month sort would invert this completely.
  check('ORDER: market first, then yield, then pricing — despite the months',
    JSON.stringify(panelA.map(r => r.id)) === JSON.stringify(['a-mkt', 'a-promo', 'a-yld', 'a-prc']),
    JSON.stringify(panelA.map(r => r.id)));

  check('ORDER: the earliest-month event is NOT first',
    panelA[0].id !== 'a-yld',
    'sorted by month across carriers — that reads as a timeline and is not one');

  check('ORDER: month still sorts WITHIN a carrier',
    panelA[0].month === '2026-06' && panelA[1].month === '2026-07');

  check('ORDER: the note stating the order in words exists and is not the raw key',
    typeof en['whatif_summary_order_note'] === 'string'
      && en['whatif_summary_order_note'].length > 0
      && !en['whatif_summary_order_note'].startsWith('whatif_'),
    en['whatif_summary_order_note']);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. THE CELLS SAY THE RIGHT THING — hand-written expectations
// ═══════════════════════════════════════════════════════════════════════════
{
  const byId = (rows: any[], id: string) => rows.find(r => r.id === id);

  const mkt = byId(panelA, 'a-mkt');
  check('CELL: a volume event reads as its scenario and signed volume',
    mkt.adjusts === 'Inflow +1,200', mkt.adjusts);
  check('CELL: and takes the VOLUME card label',
    mkt.card === en['whatif_volume'], mkt.card);

  // isPromotion ROUTING. Is_Promotion is the STRING 'Yes'/'No' on the row and
  // only readStoredEventModifiers converts it. A parse that skipped that reader
  // would make 'No' truthy and send BOTH of these to the promotion summariser.
  const promo = byId(panelA, 'a-promo');
  check('ROUTING: the Is_Promotion=Yes event takes the PROMOTION card',
    promo.card === en['whatif_promotion'], promo.card);
  check('ROUTING: the Is_Promotion=No event does NOT take the promotion card',
    mkt.card !== en['whatif_promotion'],
    "'No' is a truthy string — this is the trap the seam's spread exists to close");
  check('ROUTING: the two market events take DIFFERENT cards',
    mkt.card !== promo.card, `${mkt.card} vs ${promo.card}`);

  const yld = byId(panelA, 'a-yld');
  check('CELL: the yield event reads as a mix with its blend',
    yld.adjusts === 'Inflow mix, 2 bands → 16.00', yld.adjusts);
  check('CELL: the yield event takes the VALUE card label',
    yld.card === en['whatif_summary_card_value'], yld.card);

  // THE DILUTION FRAMING — the row must describe the dilution, not restate the
  // computed rate. Both halves asserted: the sentence is present AND the
  // derived amount is absent.
  const dil = byId(panelB, 'b-prc');
  check('CELL: the dilution event reads with the DILUTION framing',
    dil.adjusts === '25% → 20% dilution', dil.adjusts);
  check('CELL: and does NOT restate the computed rate',
    !dil.adjusts.includes('6.6'),
    'the summariser describes; re-deriving is the R4 rule this breaks');

  check('CELL: scope lists the dimensions that are set',
    mkt.scope === 'A Market Segment / Mobile Voice / Direct', mkt.scope);
  check('CELL: a wildcard-only scope reads as the ALL label, not as blanks',
    panelFor({ marketEvents: [{ ID: 'w', Name: 'W', Scenario: 'Inflow',
      Segment: 'All', Product: 'All', Channel: 'All', Start_Month: '2026-05',
      Subscriber_Volume: 1, Is_Promotion: 'No' }] })[0].scope
      === en['whatif_summary_scope_all']);

  check('CELL: when reads the market event\'s month',
    mkt.when === '2026-06', mkt.when);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. NAMES — a fallback is FLAGGED, never silently shown as typed
// ═══════════════════════════════════════════════════════════════════════════
{
  const unnamed = panelFor({ marketEvents: [{
    ID: 'u', Scenario: 'Inflow', Segment: 'S', Product: 'P', Channel: 'C',
    Start_Month: '2026-05', Subscriber_Volume: 10, Is_Promotion: 'No',
  }] })[0];
  check('NAME: an unnamed event gets the fallback label',
    unnamed.name === en['whatif_summary_unnamed_volume'], unnamed.name);
  check('NAME: and is FLAGGED as a fallback rather than passing as typed',
    unnamed.unnamed === true,
    'the flag drives the italic muted styling — absence is rendered, not blanked');
  check('NAME: a named event is not flagged',
    panelA[0].unnamed === false && panelA[0].name === 'A Market Volume');
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. EMPTY AND PARTIAL FILES
// ═══════════════════════════════════════════════════════════════════════════
{
  check('EMPTY: a file with no events yields no rows, so the panel shows its empty state',
    panelEmpty.length === 0, `${panelEmpty.length} rows`);
  check('EMPTY: the empty-state key exists and is reused, not reinvented',
    typeof en['whatif_summary_empty'] === 'string' && en['whatif_summary_empty'].length > 0);

  // PARTIAL: file B has no yield events at all.
  check('PARTIAL: a carrier with no events contributes NO rows, not a placeholder',
    panelB.every(r => r.pass !== 1) && panelB.length === 2,
    JSON.stringify(panelB.map(r => r.pass)));
  check('PARTIAL: and the carriers that do have events are unaffected',
    panelB.map(r => r.id).join(',') === 'b-mkt,b-prc', panelB.map(r => r.id).join(','));

  check('MISSING ARRAYS: a session lacking a carrier array entirely does not throw',
    panelFor({ marketEvents: [{ ID: 'x', Scenario: 'Inflow', Start_Month: '2026-05',
      Subscriber_Volume: 1, Is_Promotion: 'No' }] }).length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. THE PARSE SOURCE — a Compare upload IS a PROSPECT save
// ═══════════════════════════════════════════════════════════════════════════
{
  check('SOURCE: stored ids are RESTORED, so a row keeps its identity',
    panelA.map(r => r.id).includes('a-mkt'),
    "source 'workbook' would mint new ids and the panel would key on noise");

  // 'workbook' negates Outflow. A save already holds signed quantities, so
  // parsing one as a workbook would flip a stated positive into a loss.
  const outflowRow = { ID: 'o', Name: 'O', Scenario: 'Outflow', Segment: 'S',
    Product: 'P', Channel: 'C', Start_Month: '2026-05', Subscriber_Volume: 500,
    Is_Promotion: 'No' };
  check('SOURCE: an Outflow volume is NOT re-negated by the panel parse',
    panelFor({ marketEvents: [outflowRow] })[0].adjusts === 'Outflow +500',
    panelFor({ marketEvents: [outflowRow] })[0].adjusts);
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. WIRING — the tab composes it the way this file does
// ═══════════════════════════════════════════════════════════════════════════
{
  const tab = fs.readFileSync('src/components/ScenarioCompareTab.tsx', 'utf8');
  // COMMENTS STRIPPED. The component's header legitimately NAMES the builder
  // to say it does not call it, and a check that reads prose as code would
  // fail on the very sentence documenting the rule it enforces.
  const table = fs.readFileSync('src/components/EventsSummaryTable.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const whatif = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');

  check('WIRING: the tab builds panels with the SHARED per-file builder',
    (tab.match(/buildPerFileEventPanels\(/g) ?? []).length === 1,
    'a hand-rolled composition in the component is unreachable by this spec');
  check('WIRING: and holds no parse of its own',
    !tab.includes('marketEventFromRow(') && !tab.includes('buildEventsSummaryRows('),
    'a second composition is the fifth-copy shape');
  check('WIRING: the builder passes every loaded session in ONE call',
    tab.includes('buildPerFileEventPanels(parsedSessions, t)'),
    'per-file calls would hide a cross-file leak from the separation checks');
  check('WIRING: the parse is memoised on parsedSessions, not recomputed per render',
    /const perFileSummaries = useMemo\(/.test(tab) && tab.includes('[parsedSessions, t]'),
    'a per-render parse would re-run on every filter change');
  const eng = fs.readFileSync('src/utils/forecasting.ts', 'utf8');
  check('WIRING: the builder reads each session\'s OWN arrays',
    eng.includes('(s.marketEvents  ?? []).map(r => marketEventFromRow(r, \'session\'))'),
    'reading a merged list is the defect the separation checks exist for');

  // ONE TABLE COMPONENT, TWO CALLERS — the fifth-writer rule applied to a
  // render. Exact counts, because a third caller should be a deliberate change.
  check('WIRING: the table component has exactly TWO callers',
    (tab.match(/<EventsSummaryTable/g) ?? []).length === 1
      && (whatif.match(/<EventsSummaryTable/g) ?? []).length === 1,
    'Compare and What-If — a copied table drifts more quietly than a copied writer');
  check('WIRING: neither caller holds its own summary <table>',
    !/whatif_summary_col_card/.test(tab) && !/whatif_summary_col_card/.test(whatif),
    'the column headers must live in the one component');
  check('WIRING: the shared table RENDERS ONLY — it never builds rows',
    !table.includes('buildEventsSummaryRows') && !table.includes('EventSummary('),
    'a builder in the render is how describe-never-re-derive gets lost');

  check('WIRING: each panel gets a distinct testid prefix',
    tab.includes('testIdPrefix={`compare-events-${f.fileName}`}'),
    'a fixed testid would address whichever panel rendered first');
  check('WIRING: panels are collapsed by default',
    tab.includes('open={!!openPanels[f.fileName]}'),
    'absence carries closed, so add/remove cannot fall out of step');

  const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'];
  const missing = LOCALES.filter(l =>
    typeof JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'))['compare_events_per_file'] !== 'string');
  check('i18n: the section label exists in all six locales', missing.length === 0, missing.join(', '));
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. THE PLACEHOLDER SHEETS — no phantom events
//
// When this app exports a sheet with nothing in it, it writes ONE row holding
// a single `Note` cell. App has guarded that at nine import sites forever;
// Compare's per-file parse arrived without the knowledge and fed the
// placeholder to marketEventFromRow, producing an event with
// scenario=undefined and date='' — which the panel rendered to the user as
// the literal text "undefined 0". Measured on Jon's real 1349 and 1351 saves,
// 2026-08-20.
// ═══════════════════════════════════════════════════════════════════════════
{
  const NOTE_MARKET = [{ Note: 'No market events defined' }];
  const NOTE_YIELD  = [{ Note: 'No yield events defined' }];

  check('PLACEHOLDER: a single Note row is recognised',
    isPlaceholderSheet(NOTE_MARKET) === true);
  check('PLACEHOLDER: recognised by SHAPE, not by the message text',
    isPlaceholderSheet([{ Note: 'anything at all' }]) === true,
    'matching eight English strings would break on the first rewording');
  check('PLACEHOLDER: a real event row is NOT a placeholder',
    isPlaceholderSheet([{ ID: 'm1', Name: 'Real', Note: 'a comment' }]) === false,
    'every event sheet writes an ID, so a real row can never look like one');
  check('PLACEHOLDER: two rows are never a placeholder',
    isPlaceholderSheet([{ Note: 'a' }, { Note: 'b' }]) === false);
  check('PLACEHOLDER: an empty sheet is not a placeholder — it is just empty',
    isPlaceholderSheet([]) === false);
  check('PLACEHOLDER: a blank trailing cell does not defeat the test',
    isPlaceholderSheet([{ Note: 'No market events defined', __EMPTY: '' }]) === true,
    'the sheet reader can surface a trailing blank the writer never meant');
  check('PLACEHOLDER: rowsOrEmpty yields absence, not an error',
    JSON.stringify(rowsOrEmpty(NOTE_MARKET)) === '[]'
      && rowsOrEmpty([{ ID: 'm1' }]).length === 1);

  // ── THE 1349-SHAPED REGRESSION CASE ──────────────────────────────────────
  //
  // Two Note sheets and one REAL pricing event, exactly as Jon's save. The
  // panel must hold ONE row and no phantoms.
  const asWorkerWouldParse = {
    fileName: '1349-shaped.xlsx',
    marketEvents: rowsOrEmpty(NOTE_MARKET),
    yieldEvents: rowsOrEmpty(NOTE_YIELD),
    pricingEvents: rowsOrEmpty([{
      ID: 'p1', Name: 'test dilution narrow', Segment: 'Corporate',
      Product: 'Mobile Voice', Channel_L1: 'Direct', Month: '2026-08',
      Input_Mode: 'percentage', Amount: 6.6, Target: 'cohorts',
      Cohort_Scope: 'both', Duration: 'recurring', Original_Base_ARPU: 20,
      Pricing_Mode: 'dilution', Dilution_Current_Pct: 25, Dilution_Target_Pct: 20,
    }]),
  };
  const rows1349 = panelsFor([asWorkerWouldParse])[0].rows;

  check('1349-SHAPED: the panel holds exactly ONE row',
    rows1349.length === 1, `${rows1349.length} rows: ${rows1349.map(r => r.name).join(', ')}`);
  check('1349-SHAPED: and it is the REAL pricing event',
    rows1349[0]?.name === 'test dilution narrow' && rows1349[0]?.adjusts === '25% → 20% dilution',
    JSON.stringify(rows1349[0]));

  // THE PHANTOMS, NAMED. These exact strings reached the user.
  const text1349 = textOf(rows1349);
  check('1349-SHAPED: no "undefined" reaches the panel',
    !text1349.includes('undefined'),
    'the phantom market event rendered the literal string undefined to the user');
  check('1349-SHAPED: no phantom VOLUME row',
    !rows1349.some(r => r.card === en['whatif_volume']),
    'a Note sheet must contribute no market event at all');
  check('1349-SHAPED: no phantom VALUE row',
    !rows1349.some(r => r.card === en['whatif_summary_card_value']),
    'a Note sheet must contribute no yield event at all');
  check('1349-SHAPED: no unnamed rows survive',
    rows1349.every(r => r.unnamed === false),
    'both phantoms arrived as fallback-named rows');

  // NEGATIVE CONTROL: unguarded, the phantoms DO appear. Without this the
  // four checks above could pass on a fixture that never had phantoms in it.
  const unguarded = panelsFor([{
    fileName: 'unguarded.xlsx',
    marketEvents: NOTE_MARKET, yieldEvents: NOTE_YIELD, pricingEvents: [],
  }])[0].rows;
  check('NEGATIVE CONTROL: WITHOUT the guard the placeholders DO become events',
    unguarded.length === 2, `${unguarded.length} — if 0, the fixture proves nothing`);
  check('NEGATIVE CONTROL: and one of them renders the literal "undefined"',
    textOf(unguarded).includes('undefined'),
    'this is the exact string Jon saw; the guard is what removes it');

  // BOTH CONSUMERS INHERIT IT — the duplicate-predicates rule.
  const worker = fs.readFileSync('src/workers/scenarioParser.worker.ts', 'utf8');
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  check('INHERITANCE: the worker parse consults the shared guard',
    worker.includes('rowsOrEmpty(') && worker.includes("from '../utils/sheetGuards'"),
    'the worker is the one boundary every Compare consumer reads through');
  check('INHERITANCE: App consults the SAME predicate, not a local twin',
    (app.match(/isPlaceholderSheet\(/g) ?? []).length === 9,
    'nine import sites; a tenth or a ninth missing is a consumer going its own way');
  check('INHERITANCE: no inline ?.Note twin survives anywhere',
    !app.includes('?.Note') && !worker.includes('?.Note'),
    'the convention had nine copies and one gap — that gap was the defect');
}
console.log(`\ncompare-events-panel spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
