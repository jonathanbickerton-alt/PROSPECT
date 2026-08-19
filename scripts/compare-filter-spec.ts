/**
 * SCENARIO COMPARE'S DIMENSION FILTER — populated from all three carriers.
 *
 *   npm run spec:compare-filter
 *
 * DRIVES THE REAL `collectEventScopeDims`, extracted from the component for
 * this purpose: it was an inline `useMemo`, which is precisely the shape that
 * cannot be reached without a mount — and this defect shipped because nothing
 * could reach it.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - EACH CARRIER GETS A SCOPE VALUE NOBODY ELSE USES. If a carrier were
 *    dropped from the union, exactly one value would vanish and the check names
 *    which. A shared value would let two carriers cover for each other.
 *  - THE THREE SHEETS DISAGREE ABOUT COLUMN NAMES. Market events write
 *    `Channel`; yield and pricing write `Channel_L1`. The fixtures use the real
 *    names per carrier, so a mapping error cannot pass.
 *  - 'All' IS NEVER AN OPTION. It is the control's clear state, not a value.
 *  - A DIMENSION A CARRIER LACKS CONTRIBUTES NOTHING. Yield has no Product_L2
 *    and no tariff; that must be absence, not an `undefined` in a list.
 */
let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

async function main() {
  const { collectEventScopeDims, hasAnyCarrierEvents } = await import('../src/utils/viewFilter');

  // ── One session, one event per carrier, each with a UNIQUE product ────────
  const session = {
    marketEvents: [{
      ID: 'm1', Segment: 'Corporate', Product: 'Mobile Data', Product_L2: 'High Value',
      Channel: 'Direct', Channel_L2: 'Field', Tariff_L1: 'RED L', Tariff_L2: 'SIM-only',
    }],
    yieldEvents: [{
      ID: 'y1', Segment: 'SME', Product: 'Fixed Connectivity',
      Channel_L1: 'Indirect', Channel_L2: 'Distributor',
    }],
    pricingEvents: [{
      ID: 'p1', Segment: 'SOHO', Product: 'Mobile Voice', Product_L2: 'Medium Value',
      Channel_L1: 'Partner', Channel_L2: 'Alliance', Tariff_L1: 'RED M', Tariff_L2: 'With handset',
    }],
  };

  const dims = collectEventScopeDims([session]);
  const products = [...dims.productTree.keys()].sort();
  const channels = [...dims.channelTree.keys()].sort();
  const tariffs = [...dims.tariffTree.keys()].sort();

  // ── EVERY CARRIER'S UNIQUE VALUE MUST APPEAR ─────────────────────────────
  //
  // Mobile Voice is the value from Jon's screenshot: it existed only on a
  // pricing event and was missing from the filter entirely.
  check('market: its product appears', products.includes('Mobile Data'), products.join(', '));
  check('yield: its product appears', products.includes('Fixed Connectivity'), products.join(', '));
  check('pricing: its product appears — THE REPORTED DEFECT',
    products.includes('Mobile Voice'),
    `${products.join(', ')} — Mobile Voice lives only on a pricing event`);
  check('all three, and nothing else', products.length === 3, products.join(', '));

  check('every carrier contributes its segment',
    ['Corporate', 'SME', 'SOHO'].every(v => dims.segments.includes(v))
      && dims.segments.length === 3,
    dims.segments.join(', '));

  // Channel proves the COLUMN MAPPING: market uses `Channel`, the other two
  // `Channel_L1`. Reading one name for all three would lose two of these.
  check('channels come through despite the sheets disagreeing on the column name',
    ['Direct', 'Indirect', 'Partner'].every(v => channels.includes(v)) && channels.length === 3,
    channels.join(', '));

  // Tariff: only market and pricing have one. Yield contributes nothing, and
  // that absence must not appear as an entry.
  check('tariffs come from the two carriers that have them',
    tariffs.length === 2 && tariffs.includes('RED L') && tariffs.includes('RED M'),
    tariffs.join(', '));

  // L2s hang under the right L1.
  check('L2 values hang under their own L1',
    (dims.productTree.get('Mobile Data') ?? []).includes('High Value')
      && (dims.productTree.get('Mobile Voice') ?? []).includes('Medium Value'),
    JSON.stringify([...dims.productTree]));
  check('a carrier without an L2 column contributes an EMPTY list, not undefined',
    Array.isArray(dims.productTree.get('Fixed Connectivity'))
      && (dims.productTree.get('Fixed Connectivity') ?? []).length === 0,
    JSON.stringify(dims.productTree.get('Fixed Connectivity')));

  // ── 'All' IS NEVER AN OPTION ─────────────────────────────────────────────
  const withAll = collectEventScopeDims([{
    marketEvents: [{ Segment: 'All', Product: 'All', Product_L2: 'All', Channel: 'All',
                     Channel_L2: 'All', Tariff_L1: 'All', Tariff_L2: 'All' }],
    yieldEvents: [], pricingEvents: [],
  }]);
  check("'All' never appears as a segment option",
    withAll.segments.length === 0, withAll.segments.join(', '));
  check("'All' never appears as a product, channel or tariff option",
    withAll.productTree.size === 0 && withAll.channelTree.size === 0
      && withAll.tariffTree.size === 0,
    'All is the control\'s clear state, not a value to pick');
  // Blank and missing cells behave the same way as 'All'.
  const withBlanks = collectEventScopeDims([{
    marketEvents: [{ Segment: '', Product: undefined, Channel: null }],
    yieldEvents: [], pricingEvents: [],
  }]);
  check('blank and missing cells contribute nothing either',
    withBlanks.segments.length === 0 && withBlanks.productTree.size === 0);

  // ── A VALUE ON NO EVENT MUST NOT APPEAR ──────────────────────────────────
  check('a value carried by no event is absent from the options',
    !products.includes('Broadband') && !dims.segments.includes('Enterprise'),
    'the list describes the events, not the data');

  // ── MULTI-FILE UNION, and empty inputs ───────────────────────────────────
  const twoFiles = collectEventScopeDims([
    { marketEvents: [{ Segment: 'A', Product: 'P1', Channel: 'C1' }], yieldEvents: [], pricingEvents: [] },
    { marketEvents: [], yieldEvents: [], pricingEvents: [{ Segment: 'B', Product: 'P2', Channel_L1: 'C2' }] },
  ]);
  check('values from every loaded file are unioned',
    twoFiles.segments.join(',') === 'A,B' && [...twoFiles.productTree.keys()].sort().join(',') === 'P1,P2',
    twoFiles.segments.join(','));
  check('an empty session list yields empty options, not a crash',
    collectEventScopeDims([]).segments.length === 0);
  check('a session missing a carrier array entirely is tolerated',
    collectEventScopeDims([{ marketEvents: [{ Segment: 'Z', Product: 'P', Channel: 'C' }] }])
      .segments.join(',') === 'Z');

  // ── THE EMPTINESS TEST reads all three too ───────────────────────────────
  //
  // The fallback to baseline dimensions fired on `marketEvents.length === 0`,
  // so a file carrying ONLY pricing events counted as having no events at all.
  check('hasAnyCarrierEvents: a pricing-only file HAS events',
    hasAnyCarrierEvents([{ marketEvents: [], yieldEvents: [], pricingEvents: [{ ID: 'p' }] }]),
    'this is what sent a pricing-only file to the baseline dimensions');
  check('hasAnyCarrierEvents: a yield-only file HAS events',
    hasAnyCarrierEvents([{ marketEvents: [], yieldEvents: [{ ID: 'y' }], pricingEvents: [] }]));
  check('hasAnyCarrierEvents: a file with none has none',
    !hasAnyCarrierEvents([{ marketEvents: [], yieldEvents: [], pricingEvents: [] }]));

  // ── WIRING ───────────────────────────────────────────────────────────────
  const fs = await import('fs');
  const tab = fs.readFileSync('src/components/ScenarioCompareTab.tsx', 'utf8');
  check('wiring: the component uses the shared collector',
    (tab.split('collectEventScopeDims(').length - 1) === 1,
    `${tab.split('collectEventScopeDims(').length - 1} call sites, expected 1`);
  check('wiring: and the shared emptiness test, not a market-only count',
    !tab.includes('s.marketEvents.length === 0'),
    'a market-only emptiness test sends a pricing-only file to the baseline dims');
  check('wiring: the label no longer says Market Events Only',
    tab.includes("t('compare_events_only')") && !tab.includes("compare_market_events_only"));
  check('wiring: the baseline side still reads baselineRows',
    tab.includes('s.baselineRows.forEach'), 'the Baseline Forecasts (All) side is untouched');

  const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'];
  const missing = LOCALES.filter(l =>
    typeof JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'))['compare_events_only'] !== 'string');
  check('i18n: the new label exists in all six locales', missing.length === 0, missing.join(', '));

  console.log(`\ncompare-filter spec: ${pass} passed, ${fails.length} failed`);
  fails.forEach(f => console.log('  FAIL  ' + f));
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('compare-filter spec CRASHED —', e); process.exit(1); });
