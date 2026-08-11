/**
 * BUILDS the promotion-mix behavioural fixture.
 *
 *   node scripts/build-promo-mix-fixture.mjs
 *   -> test-data/PROSPECT_Save_PromoMix_Behavioural.xlsx
 *
 * WHY A BUILDER AND NOT A COMMITTED .xlsx. The session brief asked for the
 * exported save to be committed under test-data/. It is not, and deliberately:
 * `.gitignore:15` excludes `/test-data/*.xlsx`, no .xlsx is tracked anywhere in
 * the repo, and the fixture convention is explicit that regeneration goes
 * through a committed deterministic builder and that a fixture is never
 * hand-made. The brief itself said "with provenance per fixture-handling", so
 * the convention governs. Committing this script gives the same behavioural
 * case, reproducibly, and survives a fresh clone — which a gitignored binary
 * would not.
 *
 * WHAT IT IS FOR. Until now NO shipped save carried a promotion event at all —
 * the 07 Aug save's Market_Events sheet holds the "No market events defined"
 * placeholder. Every promo-field check has therefore been CONSTRUCTED: it
 * proved the round trip's logic over the real file format, never that a real
 * save exercises it. This is the family's first behavioural fixture, and the
 * state it captures is the one the constrained mix mode actually produces —
 * a promotion whose mix was reached by holding a member and typing a target.
 *
 * DETERMINISTIC: no Math.random, no Date.now, fixed ids and fixed shares. Two
 * runs produce byte-identical content, so a diff against it means something.
 *
 * THE MIX IS SOLVED BY THE REAL ENGINE, not typed in by hand. `solveForTarget`
 * computes the shares from a held member and a target blend, so the fixture
 * records a mix the card could actually have produced. A hand-written mix would
 * be a guess about the engine's output wearing a fixture's clothes.
 */
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { solveForTarget, blendedArpu, conformsToTotal } from '../src/utils/mixConstraint.ts';

const OUT = 'test-data/PROSPECT_Save_PromoMix_Behavioural.xlsx';

// Three value bands, the shape the value axis ships with.
const MEMBERS = ['Low Value', 'Mid Value', 'High Value'];
const ARPUS = { 'Low Value': 8, 'Mid Value': 20, 'High Value': 45 };

// The captured interaction: High Value HELD at 40, target blend typed as 26.
// Reachable interval with that hold is [22.8, 30], so 26 sits inside it.
const HELD = ['High Value'];
const START = { 'Low Value': 30, 'Mid Value': 30, 'High Value': 40 };
const TARGET = 26;

const solved = solveForTarget(MEMBERS, START, HELD, ARPUS, TARGET);
if (solved.kind !== 'ok') {
  console.error('FIXTURE NOT BUILT — the engine refused the captured interaction:', solved.reason, solved.detail);
  process.exit(1);
}
const MIX = solved.shares;

// Self-check before writing. A fixture that does not satisfy the invariants it
// exists to demonstrate is worse than no fixture: it would be cited as evidence.
const blend = blendedArpu(MIX, ARPUS);
if (!conformsToTotal(MEMBERS, MIX)) { console.error('FIXTURE NOT BUILT — solved mix does not conform'); process.exit(1); }
if (blend === null || Math.abs(blend - TARGET) > 1e-9) {
  console.error(`FIXTURE NOT BUILT — solved mix blends to ${blend}, not ${TARGET}`); process.exit(1);
}
if (Math.abs(MIX['High Value'] - 40) > 1e-9) {
  console.error('FIXTURE NOT BUILT — the held member moved'); process.exit(1);
}

/** Column-for-column the shape App.tsx's Market_Events writer emits. */
const evtRow = (over) => ({
  ID: 'promo-mix-1', Sequence: 1, Name: '', Campaign_Name: 'Autumn Value Push',
  Scenario: 'Inflow', Segment: 'Corporate', Product: 'Mobile Voice', Product_L2: 'All',
  Channel: 'Direct', Channel_L2: 'All', Tariff_L1: 'All', Tariff_L2: 'All',
  Start_Month: '2026-09', Subscriber_Volume: 5000, Customer_Volume: 0,
  Revenue: 5000 * blend, ARPU: blend,
  Contract_Length_Months: 24, Comment: 'Held High Value at 40, typed target 26',
  Amount_Type: 'absolute', Percentage_Basis: '', Retention_Linked: 'Yes',
  Is_Promotion: 'Yes', Promo_Rebanded: 'No',
  Promo_Mix_Axis: 'value', Promo_Mix_JSON: JSON.stringify(MIX),
  Promo_Pricing_Mode: '', Promo_Pricing_Amount: '',
  ...over,
});

const rows = [
  evtRow({}),
  // A second event carrying the PRICING arm too, so the fixture exercises a
  // promotion with both arms rather than only the mix. Zero is deliberate: it
  // is a legitimate override and the one value whose absence carrier matters.
  evtRow({
    ID: 'promo-mix-2', Sequence: 2, Start_Month: '2026-10',
    Comment: 'Mix + pricing arm, pricing amount deliberately ZERO',
    Promo_Pricing_Mode: 'percentage', Promo_Pricing_Amount: 0,
  }),
  // A third with NO mix at all, so absent-vs-present is exercised in one file.
  evtRow({
    ID: 'promo-mix-3', Sequence: 3, Start_Month: '2026-11',
    Comment: 'Promotion with no mix arm — absent, not empty',
    Promo_Mix_Axis: '', Promo_Mix_JSON: '',
  }),
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Market_Events');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
  Fixture: 'PromoMix behavioural',
  Built_By: 'scripts/build-promo-mix-fixture.mjs',
  Members: MEMBERS.join(' | '),
  Held: HELD.join(' | '),
  Target_Blend: TARGET,
  Resulting_Blend: blend,
  Note: 'Mix solved by src/utils/mixConstraint.solveForTarget — not hand-written.',
}]), 'Fixture_Provenance');

fs.mkdirSync('test-data', { recursive: true });
XLSX.writeFile(wb, OUT);
console.log(`built ${OUT}`);
console.log(`  held ${HELD.join(', ')} at ${MIX['High Value']}`);
console.log(`  target ${TARGET} -> blend ${blend}`);
console.log(`  mix ${JSON.stringify(MIX)}  sum ${MEMBERS.reduce((s, m) => s + MIX[m], 0)}`);
