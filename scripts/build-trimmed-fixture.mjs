/**
 * Build the trimmed fixture CLAUDE.md tells routine agent runs to use.
 *
 * Selects whole LEAF cohorts and keeps every row of each — never samples rows
 * or months, which would break the time series the forecaster needs (and the
 * >=8-point minimum in calculateBaseForecast).
 *
 * Must preserve:
 *   - EXPECTED.md section 4's reference cohort (Corporate/IoT Connectivity/Indirect)
 *   - the full tariff hierarchy (every L1, and L2s under them)
 *   - the RED ULTD edge case: segments that sell a tariff but NOT under
 *     Mobile Voice / Direct, which is what forces the share-scaled fallback
 *   - the Corporate/Mobile Voice/Direct tariff canary rows
 *   - at least two cohorts per segment
 *
 * SECOND OUTPUT: the EDGE-CASE variant.
 *
 * The trimmed and full fixtures are both perfectly rectangular (42/42/42
 * surviving months on every leaf) and both carry ONE unit price per leaf-month
 * shared by all four IBRO scenarios. Those two properties make whole classes of
 * assertion vacuous: nothing can reach the short-history branch, and every
 * per-scenario ARPU test would pass against an implementation that read
 * inflowArpu four times.
 *
 * The edge variant breaks both, deterministically:
 *   - short history: named leaves truncated below the four-month fitting floor,
 *     arranged so one aggregate has a MIX of short and healthy leaves and
 *     another has ONLY short ones;
 *   - per-scenario prices: Avg_Unit_Price_GBP scaled by a fixed per-scenario
 *     factor, with revenue recomputed as price x volume so the file stays
 *     internally consistent.
 *
 * Both properties are PROVEN, not assumed - see scripts/edge-fixture-spec.ts,
 * which drives the real enumeration, the real classifySkip and the real
 * forecast-and-score path over this file.
 */
import XLSX from 'xlsx';

const SRC = 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Jun2026.xlsx';
const OUT = 'test-data/VBU_IBRO_Trimmed_TariffHierarchy_Jan2023_Jun2026.xlsx';

const wb = XLSX.readFile(SRC);
const sheet = wb.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet]);

const F = { seg: 'Customer_Segment', p1: 'Product_L1', p2: 'Product_L2_Value_Tier',
  c1: 'Channel_Level_1', c2: 'Channel_Level_2', t1: 'tariff_tier_l1', t2: 'tariff_tier_l2' };
const v = (r, k) => String(r[k] ?? '').trim();
const leaf = (r) => [F.seg, F.p1, F.p2, F.c1, F.c2, F.t1, F.t2].map(k => v(r, k)).join('|');

const allLeaves = [...new Set(rows.map(leaf))];
const segs = [...new Set(rows.map(r => v(r, F.seg)))].sort();
const keep = new Set();

// 1. The section-4 reference cohort: every leaf under Corporate/IoT Connectivity/Indirect.
for (const k of allLeaves) {
  const [s, p1, , c1] = k.split('|');
  if (s === 'Corporate' && p1 === 'IoT Connectivity' && c1 === 'Indirect') keep.add(k);
}
const refCount = keep.size;

// 2. Corporate / Mobile Voice / Direct — the tariff canary rows, every tariff.
for (const k of allLeaves) {
  const [s, p1, , c1] = k.split('|');
  if (s === 'Corporate' && p1 === 'Mobile Voice' && c1 === 'Direct') keep.add(k);
}

// 3. The RED ULTD edge case: for every segment, keep its RED ULTD leaves
//    WHEREVER they live. For LE and MNC those are outside Mobile Voice/Direct,
//    which is exactly the "sells the tariff, but not through that combo" shape.
for (const k of allLeaves) {
  if (k.split('|')[5] === 'RED ULTD') keep.add(k);
}

// 4. Tariff-hierarchy completeness: at least one leaf per (tariffL1, tariffL2).
const tarPairs = new Map();
for (const k of allLeaves) {
  const p = k.split('|');
  const pair = `${p[5]}|${p[6]}`;
  if (!tarPairs.has(pair)) tarPairs.set(pair, k);
}
for (const k of tarPairs.values()) keep.add(k);

// 5. At least two leaves per segment (segments not otherwise represented).
for (const s of segs) {
  const mine = [...keep].filter(k => k.startsWith(s + '|'));
  if (mine.length >= 2) continue;
  for (const k of allLeaves) {
    if (k.startsWith(s + '|') && !keep.has(k)) { keep.add(k); if ([...keep].filter(x => x.startsWith(s + '|')).length >= 2) break; }
  }
}

const out = rows.filter(r => keep.has(leaf(r)));
const nb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(nb, XLSX.utils.json_to_sheet(out), sheet);
// compression is off by default in SheetJS — without it the trimmed file is
// LARGER than the 8.3 MB source despite holding 13.7% of the rows.
XLSX.writeFile(nb, OUT, { compression: true });

// ── Report what survived ────────────────────────────────────────────────────
const outSegs = [...new Set(out.map(r => v(r, F.seg)))].sort();
const srcT1 = [...new Set(rows.map(r => v(r, F.t1)))].filter(x => x && x !== 'undefined').sort();
const outT1 = [...new Set(out.map(r => v(r, F.t1)))].filter(x => x && x !== 'undefined').sort();
const srcT2 = new Set(rows.map(r => `${v(r, F.t1)}|${v(r, F.t2)}`));
const outT2 = new Set(out.map(r => `${v(r, F.t1)}|${v(r, F.t2)}`));
const months = [...new Set(out.map(r => String(r['Month'])))];
const ref = out.filter(r => v(r, F.seg) === 'Corporate' && v(r, F.p1) === 'IoT Connectivity' && v(r, F.c1) === 'Indirect');

const mvDirect = (seg, tar) => rows.filter(r => v(r, F.seg) === seg && v(r, F.p1) === 'Mobile Voice'
  && v(r, F.c1) === 'Direct' && v(r, F.t1) === tar).length;
const mvDirectOut = (seg, tar) => out.filter(r => v(r, F.seg) === seg && v(r, F.p1) === 'Mobile Voice'
  && v(r, F.c1) === 'Direct' && v(r, F.t1) === tar).length;

console.log(`rows        ${rows.length} -> ${out.length}  (${((out.length / rows.length) * 100).toFixed(1)}%)`);
console.log(`leaves      ${allLeaves.length} -> ${keep.size}   (reference cohort contributed ${refCount})`);
console.log(`segments    ${segs.length} -> ${outSegs.length}   ${outSegs.join(', ')}`);
console.log(`  per-segment leaf counts: ${outSegs.map(s => `${s}=${[...keep].filter(k => k.startsWith(s + '|')).length}`).join('  ')}`);
console.log(`tariff L1   ${srcT1.length} -> ${outT1.length}   ${outT1.join(', ')}   ${srcT1.length === outT1.length ? 'COMPLETE' : 'MISSING ' + srcT1.filter(x => !outT1.includes(x))}`);
console.log(`tariff L1|L2 pairs ${srcT2.size} -> ${outT2.size}   ${srcT2.size === outT2.size ? 'COMPLETE' : 'partial'}`);
console.log(`months      ${months.length} distinct`);
console.log(`section-4 reference cohort rows: ${ref.length}   ${ref.length > 0 ? 'PRESENT' : 'MISSING'}`);
console.log('\nRED ULTD edge case (rows under Mobile Voice / Direct — 0 is the case that forces the fallback):');
for (const s of segs) console.log(`  ${s.padEnd(17)} source=${String(mvDirect(s, 'RED ULTD')).padStart(4)}  trimmed=${String(mvDirectOut(s, 'RED ULTD')).padStart(4)}  ${mvDirect(s, 'RED ULTD') === 0 ? '<- zero preserved' : ''}`);

// ═══════════════════════════════════════════════════════════════════════════
// EDGE-CASE VARIANT
// ═══════════════════════════════════════════════════════════════════════════
// Built FROM the trimmed set (`out`), so it inherits every preservation rule
// above and differs only in the two properties it exists to introduce.

const EDGE_OUT = 'test-data/VBU_IBRO_EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026.xlsx';

const COL = { month: 'Month', metric: 'IBRO_Scenario_Type', vol: 'Subscriber_Volume',
  price: 'Avg_Unit_Price_GBP', rev: 'Monthly_Revenue_GBP', annual: 'Annualised_Revenue_GBP' };

// ── Per-scenario price factors. Seeded constants, never random: a fixture whose
//    numbers move between builds cannot be the baseline for anything.
//
//    A CONSTANT factor per scenario is NOT sufficient, and finding that out is
//    why this comment is long. MAPE is scale-invariant: multiply a scenario's
//    price by k and both the actual and the fitted forecast scale by k, leaving
//    |actual - forecast| / actual unchanged. A level-only variant produced four
//    ARPU MAPEs agreeing to five significant figures - technically distinct,
//    and distinct only because of rounding noise. That is a fixture that looks
//    like it fixed the vacuity and did not.
//
//    So each scenario also gets its own DRIFT: a small per-month slope, so the
//    four price TRAJECTORIES have different shapes, not just different levels.
//    Shape is what a forecaster gets right or wrong, so shape is what makes the
//    four MAPEs genuinely diverge.
//
//    factor(scenario, monthIndex) = level + drift * monthIndex
//    Inflow's level is 1.00 deliberately, so its ARPU stays comparable with the
//    other fixtures and any divergence is attributable.
const PRICE_FACTOR = {
  Inflow:    { level: 1.00, drift:  0.000 },
  Outflow:   { level: 1.05, drift:  0.004 },
  Retention: { level: 0.95, drift: -0.003 },
  Base:      { level: 1.10, drift:  0.006 },
};

// ── Choose the leaves to truncate, from the trimmed set, deterministically.
const edgeLeaves = [...new Set(out.map(leaf))].sort();
const groupOf = (k) => { const p = k.split('|'); return `${p[0]}|${p[1]}`; };   // segment|productL1
const byGroup = new Map();
for (const k of edgeLeaves) {
  if (!byGroup.has(groupOf(k))) byGroup.set(groupOf(k), []);
  byGroup.get(groupOf(k)).push(k);
}

// (a) an aggregate with a MIX: first group holding >= 3 leaves, truncate exactly one.
const mixedGroup = [...byGroup.entries()].filter(([, ks]) => ks.length >= 3).sort()[0];
// (b) an aggregate whose leaves are ALL short: smallest group with >= 1 leaf that
//     is not the mixed one, truncate every leaf in it.
const allShortGroup = [...byGroup.entries()]
  .filter(([g, ks]) => g !== mixedGroup?.[0] && ks.length >= 1 && ks.length <= 3)
  .sort((a, b) => a[1].length - b[1].length || a[0].localeCompare(b[0]))[0];

if (!mixedGroup || !allShortGroup) {
  throw new Error('edge variant: could not find both a mixed group and an all-short group');
}

const SHORT_MONTHS = 2;                       // below the 4-month fitting floor
const shortLeaves = new Set([mixedGroup[1][0], ...allShortGroup[1]]);

// Keep only the FIRST SHORT_MONTHS calendar months for a truncated leaf. Taking
// the earliest rather than the latest also makes these leaves end before every
// other leaf, which is the ragged-lifetime shape Q4a says the seed fields cannot
// survive - a second thing the rectangular fixtures cannot express.
const monthsSorted = [...new Set(out.map(r => String(r[COL.month])))].sort();
const monthIndex = new Map(monthsSorted.map((m, i) => [m, i]));
const keptMonths = new Set(monthsSorted.slice(0, SHORT_MONTHS));

const edgeRows = out
  .filter(r => !shortLeaves.has(leaf(r)) || keptMonths.has(String(r[COL.month])))
  .map(r => {
    const scen = String(r[COL.metric] ?? '').trim();
    const spec = PRICE_FACTOR[scen];
    if (spec === undefined) return { ...r };
    const mi = monthIndex.get(String(r[COL.month])) ?? 0;
    const f = spec.level + spec.drift * mi;
    const volume = Number(r[COL.vol]) || 0;
    const price = Number((Number(r[COL.price]) * f).toFixed(4));
    const monthly = Number((price * volume).toFixed(2));
    // Revenue is RECOMPUTED, not scaled, so price x volume = revenue holds
    // exactly. The reader divides revenue by volume to get ARPU; if those two
    // disagree the fixture teaches the wrong lesson about its own prices.
    return { ...r, [COL.price]: price, [COL.rev]: monthly,
      ...(r[COL.annual] !== undefined ? { [COL.annual]: Number((monthly * 12).toFixed(2)) } : {}) };
  });

const eb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(eb, XLSX.utils.json_to_sheet(edgeRows), sheet);
XLSX.writeFile(eb, EDGE_OUT, { compression: true });

console.log('\n── EDGE-CASE VARIANT ──────────────────────────────────────────');
console.log(`out         ${EDGE_OUT}`);
console.log(`rows        ${out.length} -> ${edgeRows.length}`);
console.log('price factors (level + drift x monthIndex):');
for (const [k, v2] of Object.entries(PRICE_FACTOR)) console.log(`  ${k.padEnd(10)} level=${v2.level}  drift=${v2.drift}`);
console.log(`truncated to ${SHORT_MONTHS} months (fitting floor is 4):`);
console.log(`  MIXED aggregate  ${mixedGroup[0]}  -> 1 of ${mixedGroup[1].length} leaves short`);
console.log(`    short: ${mixedGroup[1][0]}`);
console.log(`  ALL-SHORT aggregate  ${allShortGroup[0]}  -> ${allShortGroup[1].length} of ${allShortGroup[1].length} leaves short`);
for (const k of allShortGroup[1]) console.log(`    short: ${k}`);
console.log(`total short leaves: ${shortLeaves.size}`);
console.log('\nRun `npm run spec:edge` to PROVE both properties against real code.');
