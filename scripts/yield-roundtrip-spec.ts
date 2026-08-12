/**
 * THE VALUE CARD'S PER-TIER BASE ARPU OVERRIDE ROUND-TRIPS.
 *
 *   npm run spec:yield-roundtrip
 *
 * Request 2, reading (b) (EXPECTED.md, settled 2026-08-11): the per-tier Base
 * ARPU becomes editable and the blend stays DERIVED. This file pins the
 * PERSISTENCE half — the carrier, the export column and the single import
 * route. The card surface is held for the next session and is deliberately not
 * asserted here.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - DRIVEN BOTH WAYS, through a real xlsx write/read. A round-trip check that
 *    unit-tests the reader on literal inputs is how the promo-field hole
 *    survived: the writer was never exercised, so a column it failed to emit
 *    could not be seen.
 *  - PRESENCE IS THE CARRIER, per bucket. Unset, stated, stated-as-zero and
 *    stated-NEGATIVE are four separable states and every one is asserted.
 *  - THE WRITER COUNT IS PINNED, not claimed. The enumeration was verified at
 *    dae586d as 1 construction site / 1 addYieldEvent caller / 1 import route.
 *    A field on some writers and not all is the defect this programme has now
 *    paid for twice; guard-trap 63 proves the pin still bites.
 *  - NO SIGN TRANSFORM may touch the field, per the rate-sign rule. Asserted at
 *    source exactly as 03a08fe asserts it for arpuOverride.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { readStoredRateMap } from '../src/utils/forecasting';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

/** The Yield_Events writer, lifted from App.tsx. A wiring check below pins it
 *  in step, so this copy cannot quietly test a shape the app no longer emits. */
const toRow = (e: any) => ({
  ID: e.id, Name: e.name ?? '', IBRO: e.ibro,
  Segment: e.segment, Product: e.product,
  Channel_L1: e.channelL1, Channel_L2: e.channelL2,
  Month: e.month, Roll_Forward: e.rollForward ? 'Yes' : 'No',
  Mix_Axis: e.mixAxis ?? 'value',
  Tariff_Mix_JSON: JSON.stringify(e.tariffMix),
  Tariff_Base_ARPU_JSON: JSON.stringify(e.tariffBaseArpu),
  Tariff_Base_ARPU_Override_JSON: e.tariffBaseArpuOverride
    ? JSON.stringify(e.tariffBaseArpuOverride) : '',
  Comment: e.comment ?? '',
});

function throughXlsx(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Yield_Events');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return XLSX.utils.sheet_to_json(XLSX.read(buf, { type: 'buffer' }).Sheets['Yield_Events']);
}

const BASE: any = {
  id: 'yld-1', name: 'Autumn yield', ibro: 'Inflow',
  segment: 'Corporate', product: 'Mobile Voice', channelL1: 'Direct', channelL2: 'All',
  month: '2026-09', rollForward: false, mixAxis: 'value',
  tariffMix: { 'Low Value': 30, 'Mid Value': 30, 'High Value': 40 },
  tariffBaseArpu: { 'Low Value': 8, 'Mid Value': 20, 'High Value': 45 },
  comment: 'round-trip subject',
};

// ── FOUR SEPARABLE STATES: unset, stated, stated-zero, stated-negative ─────
{
  const withOverride = { ...BASE, tariffBaseArpuOverride: {
    'Low Value': 12.5,      // stated
    'Mid Value': 0,         // stated ZERO — a free band, not "unset"
    'High Value': -4.25,    // stated NEGATIVE — an acquisition credit
  } };
  const back = readStoredRateMap(throughXlsx([toRow(withOverride)])[0].Tariff_Base_ARPU_Override_JSON);

  check('ROUND TRIP: the override map survives a real xlsx write/read', !!back, JSON.stringify(back));
  check('STATED: a plain rate survives', back?.['Low Value'] === 12.5, `${back?.['Low Value']}`);
  check('ZERO: a stated zero survives as 0, NOT as unset',
    back?.['Mid Value'] === 0, `${back?.['Mid Value']}`);
  check('NEGATIVE: a below-zero rate survives VERBATIM, unclamped and un-resigned',
    back?.['High Value'] === -4.25, `${back?.['High Value']}`);
  check('COUNT: exactly the three stated buckets came back, no extras invented',
    back && Object.keys(back).length === 3, `${back && Object.keys(back).length}`);

  // A bucket the user said nothing about must NOT appear.
  const partial = { ...BASE, tariffBaseArpuOverride: { 'Mid Value': 19 } };
  const p2 = readStoredRateMap(throughXlsx([toRow(partial)])[0].Tariff_Base_ARPU_Override_JSON);
  check('UNSET: a bucket with nothing stated is ABSENT from the map, not zeroed',
    !!p2 && p2['Low Value'] === undefined && p2['Mid Value'] === 19,
    JSON.stringify(p2));
}

// ── ABSENCE, and the empty map that is not the same claim ─────────────────
{
  const none = readStoredRateMap(throughXlsx([toRow(BASE)])[0].Tariff_Base_ARPU_Override_JSON);
  check('ABSENT: no override map reads undefined, not {}', none === undefined, JSON.stringify(none));

  check('ABSENT: an EMPTY map reads absent — "no members" is not "no map"',
    readStoredRateMap('{}') === undefined);
  check('ABSENT: unparseable reads absent rather than half-read',
    readStoredRateMap('{not json') === undefined);
  check('ABSENT: an array is not a rate map', readStoredRateMap('[1,2]') === undefined);
  check('MALFORMED: a non-numeric entry is DROPPED, not defaulted to zero',
    JSON.stringify(readStoredRateMap('{"a":5,"b":"oops"}')) === JSON.stringify({ a: 5 }),
    JSON.stringify(readStoredRateMap('{"a":5,"b":"oops"}')));
  check('MALFORMED: a blank entry is dropped too — Number("") is 0 and must not read as one',
    JSON.stringify(readStoredRateMap('{"a":5,"b":""}')) === JSON.stringify({ a: 5 }));
}

// ── THE WRITER COUNT, PINNED — verified 1/1/1 at dae586d ──────────────────
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const tab = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');

  const construction = (tab.match(/tariffBaseArpuOverride:/g) ?? []).length;
  check('PIN: exactly ONE construction site persists the override',
    construction === 1, `${construction} — the enumeration says 1, and a field on some writers is the defect this pays for`);

  const callers = (tab.match(/addYieldEvent\(/g) ?? []).length;
  check('PIN: exactly ONE addYieldEvent caller', callers === 1, `${callers}`);

  const importRoutes = (app.match(/readStoredRateMap\(r\.Tariff_Base_ARPU_Override_JSON\)/g) ?? []).length;
  check('PIN: exactly ONE import route reads it, through the SHARED map reader',
    importRoutes === 1, `${importRoutes}`);

  check('WIRING: the export writes the column',
    /Tariff_Base_ARPU_Override_JSON:/.test(app),
    'the writer must emit it or this spec tests a shape the app does not produce');
  check('WIRING: the import does not hand-roll a parse beside the shared reader',
    !/JSON\.parse\(String\(r\.Tariff_Base_ARPU_Override_JSON/.test(app),
    'a per-site copy is how the promo fields came to round-trip on one path only');

  // THE RATE-SIGN RULE, asserted at source as 03a08fe asserts it for arpuOverride.
  const signed = (app + tab).match(/tariffBaseArpuOverride[^\n]*(?:neg\(|abs\(|Math\.abs\()/g) ?? [];
  check('SIGN: ZERO sign transforms touch the override anywhere',
    signed.length === 0,
    `${signed.length} — sign conventions belong to QUANTITIES; a rate is written verbatim`);
}

// ── THE CARD SURFACE IS WIRED TO THE CARRIER ─────────────────────────────
//
// Source-level, and declared as such: the mounted spec the brief asked for was
// shed for budget (see the report). These catch the wiring being severed, which
// is what guard-trap 64 plants; they do not prove rendered behaviour, and the
// next session should mount it.
{
  const tab = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');

  check('SURFACE: the per-tier input exists and is addressable',
    tab.includes('data-testid={`tier-arpu-override-${tier}`}'));
  check('SURFACE: it writes the carrier by PRESENCE — cleared deletes the key',
    tab.includes("if (raw === '') delete next[tier];"),
    "Number('') is 0, so clearing must delete rather than store a zero");
  check('SURFACE: the derived figure is the PLACEHOLDER, so unset shows it without claiming it',
    tab.includes('placeholder={formatNumber(baseArpu)}'));

  check('EFFECTIVE RATE: one definition, tested for presence not truthiness',
    tab.includes('draftTierArpuOverride[tier] !== undefined ? draftTierArpuOverride[tier] : derived'),
    'a stated 0 must not fall through to the derived rate');
  check('LIVE: the blend re-derives from the EFFECTIVE rate',
    tab.includes('effectiveTierArpu(t.tier, t.baseArpu)'));
  check('LIVE: and depends on the override map, which is what makes it move without a save',
    tab.includes('[draftMix, yieldTierData, effectiveTierArpu]'));
  // Re-aimed 2026-08-12: this pinned the per-tier assignment
  // `tariffBaseArpu[t.tier] = effectiveTierArpu(...)`, which option (a) replaced
  // with a spread of the shared map. The line went stale under a change that
  // strengthened what it guards — the traps-60-and-61 lesson, this time in a
  // spec rather than a trap. Aimed at the property, not the spelling.
  check('SAVED: the construction site snapshots the EFFECTIVE rate, so a saved event matches the card',
    tab.includes('{ ...effectiveTierArpuMap }'),
    'the snapshot must come from the effective basis, however it is spelled');

  const signed = tab.match(/draftTierArpuOverride[^\n]*(?:neg\(|abs\(|Math\.abs\()/g) ?? [];
  check('SIGN: zero transforms touch the draft override either',
    signed.length === 0, `${signed.length}`);

  // ── ONE BASIS: the card's baseline and the snapshot share a single map ────
  //
  // These diverged once already — the card averaged DERIVED rates while the
  // snapshot stored EFFECTIVE ones, so one event showed two baselines on
  // adjacent surfaces. Jon settled it as option (a): one basis everywhere. The
  // guard is that both READ THE SAME OBJECT rather than each walking
  // yieldTierData and arriving at equal numbers by coincidence.
  check('ONE BASIS: the effective map is built once',
    (tab.match(/const effectiveTierArpuMap = useMemo\(/g) ?? []).length === 1);
  check('ONE BASIS: the card baseline reads that map, not yieldTierData',
    tab.includes('const rates = Object.values(effectiveTierArpuMap);'),
    'averaging yieldTierData.baseArpu here is the divergence returning');
  check('ONE BASIS: the snapshot spreads the SAME map',
    tab.includes('const tariffBaseArpu: Record<string, number> = { ...effectiveTierArpuMap };'),
    'a second walk of yieldTierData would agree today and drift tomorrow');
  check('ONE BASIS: no surviving baseline over the DERIVED rates',
    !/reduce\(\(s, t\) => s \+ t\.baseArpu, 0\) \/ yieldTierData\.length/.test(tab),
    'the pre-option-(a) computation must be gone, not merely bypassed');

  check('LABEL: the caption names the basis rather than saying only "equal-weight"',
    /Equal-weight average of the stated tier ARPUs/.test(
      fs.readFileSync('src/locales/en/translation.json', 'utf8')),
    'a baseline that moves on an override edit must read as design');
}

// ── NO OVERRIDES: byte-identical to the pre-change behaviour ──────────────
//
// The change must be a no-op wherever nobody has stated a rate — which is every
// shipped fixture. Asserted arithmetically rather than by running the card:
// with an empty override map the effective rate IS the derived rate, so the
// equal-weight mean over either is the same number.
{
  const derived = { 'Low Value': 8, 'Mid Value': 20, 'High Value': 45 };
  const mean = (o: Record<string, number>) => {
    const v = Object.values(o);
    return v.reduce((s, x) => s + x, 0) / v.length;
  };
  const effective = (over: Record<string, number>) => {
    const m: Record<string, number> = {};
    for (const k of Object.keys(derived)) {
      m[k] = over[k] !== undefined ? over[k] : (derived as Record<string, number>)[k];
    }
    return m;
  };

  check('NO-OVERRIDE: the baseline is unchanged when nothing is stated',
    mean(effective({})) === mean(derived), `${mean(effective({}))} vs ${mean(derived)}`);
  check('NO-OVERRIDE: and that is exact, not merely close',
    Object.is(mean(effective({})), mean(derived)));
  check('OVERRIDE: a stated rate DOES move the baseline — the point of option (a)',
    mean(effective({ 'High Value': 20 })) !== mean(derived),
    'if this did not move, card and forecast would still disagree');
  check('OVERRIDE: a stated ZERO moves it too, rather than reading as unset',
    mean(effective({ 'High Value': 0 })) < mean(derived));
}

console.log(`\nyield-roundtrip spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
