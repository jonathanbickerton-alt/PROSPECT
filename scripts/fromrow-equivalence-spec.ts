/**
 * THE EXTRACTION CHANGED NO BEHAVIOUR — PROVED, NOT ARGUED.
 *
 *   npm run spec:fromrow-equivalence
 *
 * `marketEventFromRow` and `yieldEventFromRow` were lifted out of three inline
 * literals in App.tsx. A pure extraction is the one kind of change that can be
 * checked exactly: same rows in, same typed event out. This file does that, and
 * it is the reason the extraction and the per-file panel were split into two
 * sessions — the equivalence argument is only available while nothing else is
 * moving.
 *
 * HOW IT WORKS. The three ORACLES below are verbatim copies of the pre-extraction
 * bodies, taken from App.tsx at 4bd703f. They are a throwaway reference, not a
 * second implementation: nothing imports them, they are compared against rather
 * than shipped, and they are deleted the day this file is.
 *
 * THIS FILE IS EXPECTED TO BE RETIRED. It certifies one commit's worth of
 * equivalence. Once the seams have moved on under their own specs — which they
 * will, since R6 session 2 consumes them — the oracles become a copy of history
 * and comparing against them stops meaning anything. Retire it then; do not
 * update the oracles to match a deliberate change, which would convert a proof
 * into a rubber stamp.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - THE ROWS ARE CHOSEN WHERE THE TWO SOURCES DISAGREE. `??` and `||` differ
 *    only on '' and 0, so a row of ordinary populated cells would pass under
 *    any implementation and prove nothing. Blank cells, zero cells, missing
 *    cells and NaN cells are all here for that reason.
 *  - IDs ARE NORMALISED, because both sides mint a random id when the row has
 *    none. Whether an id was minted or restored IS asserted — just not its value.
 *  - Is_Promotion 'No' IS ASSERTED FALSE. The sheet stores a STRING, and only
 *    readStoredEventModifiers converts it; a parse that skipped that reader
 *    would produce a truthy 'No' and route every market event to the promotion
 *    summariser. Named as a risk by the true-state pass before this was built.
 */
import { marketEventFromRow, yieldEventFromRow, readStoredEventModifiers, readStoredRateMap } from '../src/utils/forecasting';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

// ═══════════════════════════════════════════════════════════════════════════
// THE ORACLES — verbatim from App.tsx at 4bd703f, before the extraction.
// ═══════════════════════════════════════════════════════════════════════════

/** App.tsx ~:975 — the session-restore market parse. */
const oracleMarketSession = (r: any) => ({
  id:               String(r.ID ?? Math.random().toString(36).substr(2, 9)),
  name:             String(r.Name ?? ''),
  campaignName:     String(r.Campaign_Name || r.Name || ''),
  scenario:         r.Scenario,
  segment:          r.Segment,
  product:          r.Product,
  productL2:        String(r.Product_L2 ?? 'All'),
  channel:          r.Channel,
  channelL2:        String(r.Channel_L2 ?? 'All'),
  tariffL1:         String(r.Tariff_L1 ?? 'All'),
  tariffL2:         String(r.Tariff_L2 ?? 'All'),
  date:             String(r.Start_Month ?? ''),
  subscriberVolume: Number(r.Subscriber_Volume ?? 0),
  customerVolume:   Number(r.Customer_Volume   ?? 0),
  revenue:          Number(r.Revenue           ?? 0),
  arpu:             Number(r.ARPU              ?? 0),
  contractLength:   Number(r.Contract_Length_Months ?? 24),
  comment:          String(r.Comment ?? ''),
  ...readStoredEventModifiers(r),
  sequence:         r.Sequence !== undefined && r.Sequence !== '' ? Number(r.Sequence) : undefined as any,
});

/** App.tsx ~:2016 — the workbook-import market parse. */
const oracleMarketWorkbook = (r: any) => {
  const scen = String(r['Scenario'] || 'Inflow');
  const isOut = scen === 'Outflow';
  const neg = (v: number) => isOut ? -Math.abs(v) : v;
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: String(r['Name'] || ''),
    campaignName: String(r['Campaign_Name'] || r['Name'] || ''),
    scenario: scen,
    segment: String(r['Segment'] || 'All'),
    product: String(r['Product'] || 'All'),
    productL2: String(r['Product_L2'] || 'All'),
    channel: String(r['Channel'] || 'All'),
    channelL2: String(r['Channel_L2'] || 'All'),
    tariffL1: String(r['Tariff_L1'] || 'All'),
    tariffL2: String(r['Tariff_L2'] || 'All'),
    date: String(r['Date'] || r['Start_Month'] || ''),
    subscriberVolume: neg(Number(r['Subscriber_Volume']) || 0),
    customerVolume:   neg(Number(r['Customer_Volume'])   || 0),
    revenue:          neg(Number(r['Revenue'])           || 0),
    arpu:             neg(Number(r['ARPU'])              || 0),
    comment: String(r['Comment'] || ''),
    contractLength: Number(r['Contract_Length'] || r['Contract_Length_Months']) || 24,
    sequence: r['Sequence'] !== undefined && r['Sequence'] !== '' ? Number(r['Sequence']) : undefined as any,
    ...readStoredEventModifiers(r),
  };
};

/** App.tsx ~:1011 — the yield parse. */
const oracleYield = (r: any) => {
  let tariffMix: Record<string, number> = {};
  let tariffBaseArpu: Record<string, number> = {};
  try { tariffMix = JSON.parse(String(r.Tariff_Mix_JSON ?? '{}')); } catch {}
  try { tariffBaseArpu = JSON.parse(String(r.Tariff_Base_ARPU_JSON ?? '{}')); } catch {}
  const tariffBaseArpuOverride = readStoredRateMap(r.Tariff_Base_ARPU_Override_JSON);
  return {
    id:            String(r.ID ?? Math.random().toString(36).substr(2, 9)),
    name:          String(r.Name ?? ''),
    ibro:          (r.IBRO ?? 'Inflow'),
    segment:       String(r.Segment ?? 'All'),
    product:       String(r.Product ?? 'All'),
    channelL1:     String(r.Channel_L1 ?? 'All'),
    channelL2:     String(r.Channel_L2 ?? 'All'),
    month:         String(r.Month ?? ''),
    rollForward:   r.Roll_Forward === 'Yes',
    mixAxis:       (r.Mix_Axis === 'tariff' ? 'tariff' : 'value'),
    tariffMix,
    tariffBaseArpu,
    tariffBaseArpuOverride,
    comment:       String(r.Comment ?? ''),
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deep equality that is honest about the two things a JSON compare gets wrong
 * here: `undefined`-valued keys (JSON.stringify drops them, and presence-as-
 * carrier is the whole convention in this codebase) and NaN.
 */
function sameEvent(a: any, b: any): string | null {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const k of keys) {
    if (k === 'id') continue;                       // minted values differ by design
    const x = a[k], y = b[k];
    if (x === undefined && y === undefined) {
      // PRESENCE MATTERS: an absent key and a key holding undefined are the
      // same to a consumer, but only one of them survives JSON. Both sides
      // must agree on which they are.
      if ((k in a) !== (k in b)) return `${k}: presence differs (${k in a} vs ${k in b})`;
      continue;
    }
    if (typeof x === 'number' && typeof y === 'number'
        && Number.isNaN(x) && Number.isNaN(y)) continue;
    if (typeof x === 'object' && x !== null) {
      if (JSON.stringify(x) !== JSON.stringify(y)) return `${k}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`;
      continue;
    }
    if (x !== y) return `${k}: ${String(x)} (${typeof x}) vs ${String(y)} (${typeof y})`;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ROWS — chosen where the two sources disagree, not where they agree.
// ═══════════════════════════════════════════════════════════════════════════

const MARKET_ROWS: [string, any][] = [
  ['a fully populated session row', {
    ID: 'evt-1', Sequence: 3, Name: 'Autumn push', Campaign_Name: 'Autumn',
    Scenario: 'Inflow', Segment: 'Corporate', Product: 'Mobile Voice',
    Product_L2: 'High Value', Channel: 'Direct', Channel_L2: 'Field',
    Tariff_L1: 'RED L', Tariff_L2: 'SIM-only', Start_Month: '2026-09',
    Subscriber_Volume: 1200, Customer_Volume: 1100, Revenue: 24000, ARPU: 20,
    Contract_Length_Months: 12, Comment: 'c',
    Amount_Type: 'absolute', Percentage_Basis: '', Retention_Linked: 'Yes',
    Is_Promotion: 'No', Promo_Rebanded: 'No',
  }],
  // BLANK CELLS — where `??` and `||` part company. A stored '' is a stored
  // value on the session route and an unset cell on the workbook route.
  ['blank cells everywhere', {
    ID: '', Name: '', Campaign_Name: '', Scenario: '', Segment: '', Product: '',
    Product_L2: '', Channel: '', Channel_L2: '', Tariff_L1: '', Tariff_L2: '',
    Start_Month: '', Subscriber_Volume: '', Customer_Volume: '', Revenue: '',
    ARPU: '', Contract_Length_Months: '', Comment: '', Sequence: '',
  }],
  // ZERO CELLS — 0 is falsy, so `||` replaces it and `??` keeps it. A stated
  // zero volume is a real statement, which is the presence-as-carrier rule.
  ['zero volumes and a zero contract length', {
    ID: 'z', Scenario: 'Inflow', Segment: 'SME', Product: 'Fixed',
    Subscriber_Volume: 0, Customer_Volume: 0, Revenue: 0, ARPU: 0,
    Contract_Length_Months: 0, Sequence: 0,
  }],
  ['a row with almost nothing on it', { ID: 'sparse' }],
  ['a completely empty row', {}],
  // NaN — `Number('abc')` is NaN, which `??` keeps and `|| 0` replaces.
  ['unparseable numbers', {
    ID: 'nan', Subscriber_Volume: 'abc', Customer_Volume: 'xyz',
    Revenue: 'n/a', ARPU: '--', Contract_Length_Months: 'ongoing',
  }],
  // OUTFLOW — the workbook route negates, the session route does not.
  ['an Outflow row with positive magnitudes', {
    ID: 'out', Scenario: 'Outflow', Segment: 'Consumer', Product: 'Mobile',
    Subscriber_Volume: 500, Customer_Volume: 480, Revenue: 9000, ARPU: 18,
  }],
  ['an Outflow row with already-negative magnitudes', {
    ID: 'out2', Scenario: 'Outflow', Subscriber_Volume: -500, Revenue: -9000,
  }],
  // THE COLUMN ALIASES the workbook route accepts and the session route does not.
  ['workbook aliases: Date and Contract_Length', {
    Name: 'imported', Scenario: 'Retention', Date: '2026-11',
    Contract_Length: 36, Segment: 'SOHO',
  }],
  // THE PROMOTION DISCRIMINATOR — a STRING on the row.
  ['a promotion row', {
    ID: 'p1', Scenario: 'Inflow', Is_Promotion: 'Yes', Promo_Rebanded: 'Yes',
    Promo_Mix_Axis: 'tariff', Promo_Mix_JSON: '{"RED L":60,"RED M":40}',
    Promo_Pricing_Mode: 'absolute', Promo_Pricing_Amount: 12.5,
    Arpu_Override: 0, Promo_Band_ARPU_Override_JSON: '{"Low":5}',
  }],
  ['a NON-promotion row, explicitly No', { ID: 'p2', Is_Promotion: 'No' }],
  ['a percentage event with a stated basis', {
    ID: 'pct', Amount_Type: 'percentage', Percentage_Basis: 'adjusted',
    Retention_Linked: 'No', Subscriber_Volume: 5,
  }],
];

const YIELD_ROWS: [string, any][] = [
  ['a fully populated yield row', {
    ID: 'y1', Name: 'Autumn yield', IBRO: 'Retention', Segment: 'Corporate',
    Product: 'Mobile Voice', Channel_L1: 'Direct', Channel_L2: 'All',
    Month: '2026-09', Roll_Forward: 'Yes', Mix_Axis: 'tariff',
    Tariff_Mix_JSON: '{"RED L":30,"RED M":70}',
    Tariff_Base_ARPU_JSON: '{"RED L":25,"RED M":15}',
    Tariff_Base_ARPU_Override_JSON: '{"RED L":0,"RED M":-4.25}',
    Comment: 'y',
  }],
  ['blank cells everywhere', {
    ID: '', Name: '', IBRO: '', Segment: '', Product: '', Channel_L1: '',
    Channel_L2: '', Month: '', Roll_Forward: '', Mix_Axis: '',
    Tariff_Mix_JSON: '', Tariff_Base_ARPU_JSON: '',
    Tariff_Base_ARPU_Override_JSON: '', Comment: '',
  }],
  ['a completely empty row', {}],
  ['corrupt JSON in both maps', {
    ID: 'bad', Tariff_Mix_JSON: '{not json', Tariff_Base_ARPU_JSON: '[1,2]',
    Tariff_Base_ARPU_Override_JSON: '{also not json',
  }],
  ['an empty override map, which must stay ABSENT', {
    ID: 'empty', Tariff_Base_ARPU_Override_JSON: '{}',
  }],
  ['Roll_Forward as anything other than the string Yes', {
    ID: 'rf', Roll_Forward: 'true',
  }],
  ['an unrecognised mix axis', { ID: 'ax', Mix_Axis: 'sideways' }],
];

// ═══════════════════════════════════════════════════════════════════════════
// THE CHECKS
// ═══════════════════════════════════════════════════════════════════════════

for (const [label, row] of MARKET_ROWS) {
  const diff = sameEvent(marketEventFromRow(row, 'session'), oracleMarketSession(row));
  check(`MARKET/session: ${label}`, diff === null, diff ?? '');
}
for (const [label, row] of MARKET_ROWS) {
  const diff = sameEvent(marketEventFromRow(row, 'workbook'), oracleMarketWorkbook(row));
  check(`MARKET/workbook: ${label}`, diff === null, diff ?? '');
}
for (const [label, row] of YIELD_ROWS) {
  const diff = sameEvent(yieldEventFromRow(row), oracleYield(row));
  check(`YIELD: ${label}`, diff === null, diff ?? '');
}

// ── THE ID RULE, which the comparison above deliberately skips ─────────────
{
  check('ID: the session route RESTORES a stored id',
    marketEventFromRow({ ID: 'kept-me' }, 'session').id === 'kept-me',
    'an event that loses its identity across a reload is a new event');
  check('ID: the session route mints one when the row has none',
    marketEventFromRow({}, 'session').id.length > 0);
  check('ID: the workbook route ALWAYS mints, even if the sheet has an ID column',
    marketEventFromRow({ ID: 'ignore-me' }, 'workbook').id !== 'ignore-me',
    'a hand-made sheet\'s ID column is not a PROSPECT identity');
  check('ID: two workbook rows get DIFFERENT ids',
    marketEventFromRow({}, 'workbook').id !== marketEventFromRow({}, 'workbook').id);
  check('ID: the yield reader restores a stored id',
    yieldEventFromRow({ ID: 'y-kept' }).id === 'y-kept');
}

// ── THE STRING-TRUTHINESS TRAP, named by the true-state pass ───────────────
//
// `Is_Promotion` is 'Yes' | 'No' on the row — a STRING, and 'No' is truthy.
// The conversion lives only inside readStoredEventModifiers, so it rides in
// with the spread. A parse that hand-rolled the base fields and skipped the
// spread would send every market event to the promotion summariser.
{
  for (const source of ['session', 'workbook'] as const) {
    check(`PROMO/${source}: Is_Promotion 'No' becomes the BOOLEAN false`,
      marketEventFromRow({ Is_Promotion: 'No' }, source).isPromotion === false,
      `got ${JSON.stringify(marketEventFromRow({ Is_Promotion: 'No' }, source).isPromotion)} — 'No' is truthy`);
    check(`PROMO/${source}: Is_Promotion 'Yes' becomes the BOOLEAN true`,
      marketEventFromRow({ Is_Promotion: 'Yes' }, source).isPromotion === true);
    check(`PROMO/${source}: a missing Is_Promotion is false, not undefined`,
      marketEventFromRow({}, source).isPromotion === false);
    check(`PROMO/${source}: the modifier fields arrive at all`,
      marketEventFromRow({ Arpu_Override: 0 }, source).arpuOverride === 0,
      'a stated zero override is a free acquisition, not an unset field');
  }
}

// ── THE SPREAD POSITION IS SAFE BECAUSE THE KEY SETS ARE DISJOINT ──────────
//
// The extraction applies readStoredEventModifiers LAST on both sources; the
// workbook literal already did, the session literal applied it before
// `sequence`. That move is only harmless if no modifier key collides with a
// base key — asserted here rather than assumed, because it is the one thing
// that could have changed a value silently.
{
  const modifierKeys = Object.keys(readStoredEventModifiers({}));
  const baseKeys = Object.keys(oracleMarketSession({})).filter(k => !modifierKeys.includes(k));
  const collisions = modifierKeys.filter(k => baseKeys.includes(k));
  check('SPREAD: no modifier key collides with a base field, so its position cannot change a value',
    collisions.length === 0, collisions.join(', '));
  check('SPREAD: sequence in particular is NOT a modifier key',
    !modifierKeys.includes('sequence'),
    'it was the field the session literal placed after the spread');
}

// ── NEGATIVE CONTROL: the comparator can actually FAIL ─────────────────────
//
// Every check above passed on the first run, which is the shape a vacuous
// spec has. The comparator is therefore pointed at a pair that MUST differ:
// the two sources are not interchangeable, and if `sameEvent` cannot see the
// difference between them it cannot see a regression either.
//
// Three axes, each a real divergence measured on this tree:
//   sign      — the workbook route negates Outflow, the session route does not
//   defaults  — `||` replaces a blank cell, `??` keeps it
//   identity  — the workbook route mints, the session route restores
{
  const row = { ID: 'x', Scenario: 'Outflow', Subscriber_Volume: 500, Product_L2: '' };
  const crossed = sameEvent(marketEventFromRow(row, 'session'), oracleMarketWorkbook(row));
  check('NEGATIVE CONTROL: the comparator SEES a session/workbook mismatch',
    crossed !== null,
    'if this passes, every equivalence check above is vacuous');

  check('NEGATIVE CONTROL: the two sources really do differ on sign',
    marketEventFromRow(row, 'session').subscriberVolume === 500
      && marketEventFromRow(row, 'workbook').subscriberVolume === -500,
    'Outflow negation is workbook-only; a human types the size of a loss');
  check('NEGATIVE CONTROL: and on blank-cell defaults',
    marketEventFromRow(row, 'session').productL2 === ''
      && marketEventFromRow(row, 'workbook').productL2 === 'All',
    'a stored blank is a stored value; a blank cell in a hand-made sheet is unset');
}

console.log(`\nfromrow-equivalence spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
