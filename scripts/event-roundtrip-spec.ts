/**
 * PROMOTION AND OVERRIDE FIELDS ROUND-TRIP THROUGH EXPORT AND IMPORT.
 *
 *   npm run spec:event-roundtrip
 *
 * The prerequisite for the constrained mix-mode build: promotion/override fields
 * must survive a save and reload from day one, on EVERY import route.
 *
 * THE GAP THIS PINS. The app has two independent event-import routines — the
 * session restore and the workbook import. The promo fields arrived with the
 * Custom Promotion Card (6c24a77) and were added to the session route only; the
 * workbook route dates from the initial commit and never got them. Its own
 * comment recorded the gap and it stayed open. Both now read
 * `readStoredEventModifiers`, so a field added to the card reaches both or
 * neither.
 *
 * DRIVEN BOTH WAYS. The standing rule is that round-trip checks which unit-test
 * the READER on literal inputs are how the last hole survived — the export
 * writer was never exercised, so a column it failed to write could not be seen.
 * So this builds the export row from a real event with EVERY promo field set,
 * writes it through an actual xlsx workbook, reads it back, and asserts
 * field-for-field identity.
 *
 * CONSTRUCTED AND LABELLED. No shipped save carries promotion events — the
 * 07 Aug save's Market_Events sheet is the "no market events defined" placeholder
 * — so the event here is built to carry every field. That is stated rather than
 * implied: this proves the round trip's LOGIC over the real file format, not
 * that any existing save exercises it.
 */
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { readStoredEventModifiers, bySequence, marketEventExportRow } from '../src/utils/forecasting';
import type { MarketEvent } from '../src/utils/forecasting';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

// ── An event carrying EVERY promo/override field, none left at its default ──
const EVENT: MarketEvent = {
  id: 'evt-roundtrip-1',
  scenario: 'Inflow',
  segment: 'Corporate',
  product: 'Mobile Voice',
  productL2: 'High Value',
  channel: 'Direct',
  channelL2: 'Field / Regional Sales',
  tariffL1: 'RED XL',
  tariffL2: 'SIM-only',
  date: '2026-09',
  sequence: 7,
  subscriberVolume: 1234,
  customerVolume: 1200,
  revenue: 45678,
  arpu: 37.5,
  name: 'Autumn push',
  campaignName: 'Autumn 2026',
  comment: 'round-trip subject',
  contractLength: 18,
  amountType: 'percentage',
  percentageBasis: 'adjusted',
  retentionLinked: false,
  isPromotion: true,
  promoRebanded: true,
  promoMixAxis: 'tariff',
  promoMix: { 'RED XL': 60, 'RED ULTD': 40 },
  promoPricingMode: 'percentage',
  promoPricingAmount: 12.5,
  arpuOverride: 27.75,
} as MarketEvent;

/**
 * The EXPORT writer, lifted verbatim from App.tsx's Market_Events sheet.
 *
 * Kept in step by a wiring check at the bottom: if App's writer gains or loses a
 * promo column this spec's copy is stale, and the check says so rather than this
 * file quietly testing a shape the app no longer writes.
 */
/**
 * THE REAL WRITER, not a copy.
 *
 * This was a hand-copied object literal "lifted from App.tsx", pinned only by a
 * check that App emitted the same column names. Finding 2 of the 2026-08-13 R2
 * diagnosis recorded that as certifying nothing: a copy round-trips itself. The
 * row builder is now exported from forecasting.ts and App uses the same one, so
 * a column added to the export is exercised here rather than mirrored here.
 */
const toRow = (e: MarketEvent) => marketEventExportRow(e);

/** Through a REAL workbook, not an object handed straight back. */
function throughXlsx(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Market_Events');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const back = XLSX.read(buf, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(back.Sheets['Market_Events']);
}

// ── FIELD-FOR-FIELD IDENTITY ─────────────────────────────────────────────
{
  const round = throughXlsx([toRow(EVENT)])[0];
  const m = readStoredEventModifiers(round);

  check('ROUND TRIP: the sheet survived a real xlsx write/read', !!round, 'no row came back');

  check('FIELD: amountType', m.amountType === EVENT.amountType, `${m.amountType}`);
  check('FIELD: percentageBasis', m.percentageBasis === EVENT.percentageBasis, `${m.percentageBasis}`);
  check('FIELD: retentionLinked (false must survive)', m.retentionLinked === false, `${m.retentionLinked}`);
  check('FIELD: isPromotion', m.isPromotion === true, `${m.isPromotion}`);
  check('FIELD: promoRebanded', m.promoRebanded === true, `${m.promoRebanded}`);
  check('FIELD: promoMixAxis', m.promoMixAxis === 'tariff', `${m.promoMixAxis}`);
  check('FIELD: promoPricingMode', m.promoPricingMode === 'percentage', `${m.promoPricingMode}`);
  check('FIELD: promoPricingAmount', m.promoPricingAmount === 12.5, `${m.promoPricingAmount}`);
  check('FIELD: arpuOverride', m.arpuOverride === 27.75, `${m.arpuOverride}`);
  // The mix is the one structured field — identity means the members AND their
  // shares, not merely that something parsed.
  check('FIELD: promoMix members and shares survive',
    !!m.promoMix && JSON.stringify(m.promoMix) === JSON.stringify(EVENT.promoMix),
    JSON.stringify(m.promoMix));
}

// ── ABSENCE STAYS ABSENCE, and zero stays zero ───────────────────────────
{
  const bare: MarketEvent = { ...EVENT,
    amountType: undefined, percentageBasis: undefined, retentionLinked: undefined,
    isPromotion: undefined, promoRebanded: undefined, promoMixAxis: undefined,
    promoMix: undefined, promoPricingMode: undefined, promoPricingAmount: undefined,
    arpuOverride: undefined } as MarketEvent;
  const m = readStoredEventModifiers(throughXlsx([toRow(bare)])[0]);

  check('ABSENT: promoMixAxis reads absent, not a value', m.promoMixAxis === undefined, `${m.promoMixAxis}`);
  check('ABSENT: promoMix reads absent, not an empty mix', m.promoMix === undefined, JSON.stringify(m.promoMix));
  check('ABSENT: promoPricingMode reads absent', m.promoPricingMode === undefined, `${m.promoPricingMode}`);
  check('ABSENT: promoPricingAmount reads absent, NOT 0', m.promoPricingAmount === undefined, `${m.promoPricingAmount}`);
  check('ABSENT: arpuOverride reads absent, NOT 0', m.arpuOverride === undefined, `${m.arpuOverride}`);
  check('ABSENT: isPromotion reads false (absent and false mean the same here)', m.isPromotion === false);
  check('ABSENT: defaults are the pre-2026-08-01 behaviour',
    m.amountType === 'absolute' && m.percentageBasis === 'baseline' && m.retentionLinked === true,
    `${m.amountType}/${m.percentageBasis}/${m.retentionLinked}`);

  // THE CARRIER THAT MATTERS. Zero is a legitimate override amount, so absence
  // cannot be recovered from the number — the empty string is what separates
  // them, and this is the Seed_Base_Known lesson on a second field.
  const zeroArpu = readStoredEventModifiers(throughXlsx([toRow({ ...EVENT, arpuOverride: 0 } as MarketEvent)])[0]);
  check('ZERO vs ABSENT: a stated ARPU of 0 survives as 0 — a free acquisition',
    zeroArpu.arpuOverride === 0, `${zeroArpu.arpuOverride}`);
  check('ZERO vs ABSENT: and 0 is still distinguishable from unset',
    zeroArpu.arpuOverride === 0 && m.arpuOverride === undefined,
    'if these collapse, every unset override becomes a zero-revenue event');

  // NEGATIVE IS A DELIBERATE AFFORDANCE (Jon, 2026-08-12): an event can carry
  // below-zero per-subscriber value — an acquisition credit. The value is
  // ABSOLUTE, so a minus means ARPU below zero, NOT a reduction from the
  // default. Nothing on the path may clamp it.
  const negArpu = readStoredEventModifiers(throughXlsx([toRow({ ...EVENT, arpuOverride: -4.25 } as MarketEvent)])[0]);
  check('NEGATIVE: a below-zero ARPU override survives the round trip intact',
    negArpu.arpuOverride === -4.25, `${negArpu.arpuOverride}`);
  check('NEGATIVE: it is not clamped to zero anywhere on the path',
    negArpu.arpuOverride !== 0 && (negArpu.arpuOverride as number) < 0, `${negArpu.arpuOverride}`);
  check('NEGATIVE: and stays distinct from both unset and a stated zero',
    negArpu.arpuOverride === -4.25 && m.arpuOverride === undefined && zeroArpu.arpuOverride === 0,
    'three states plus a fourth sign, all separable');

  // ── R3's PER-BAND CARRIER, driven through the REAL writer ──────────────
  //
  // Inert at this commit — no input produces one — so this is the carrier's
  // proof that it round-trips the moment the surface session lands, which is
  // the a50cca9 shape and the reason an inert carrier is a resting state.
  const BANDS = { 'Low Value': 11.5, 'Mid Value': 0, 'High Value': -4.25 };
  const band = readStoredEventModifiers(
    throughXlsx([toRow({ ...EVENT, promoBandArpuOverride: BANDS } as MarketEvent)])[0]);
  check('R3 CARRIER: the per-band map survives a real xlsx round trip',
    !!band.promoBandArpuOverride, JSON.stringify(band.promoBandArpuOverride));
  check('R3 CARRIER: every band comes back, none invented',
    !!band.promoBandArpuOverride && Object.keys(band.promoBandArpuOverride).length === 3,
    `${band.promoBandArpuOverride && Object.keys(band.promoBandArpuOverride).length}`);
  check('R3 CARRIER: a stated rate survives verbatim',
    band.promoBandArpuOverride?.['Low Value'] === 11.5);
  check('R3 CARRIER: a stated ZERO survives as 0, not as unset',
    band.promoBandArpuOverride?.['Mid Value'] === 0,
    'a band priced at nothing is not a band nobody priced');
  check('R3 CARRIER: a NEGATIVE survives VERBATIM — zero sign transforms',
    band.promoBandArpuOverride?.['High Value'] === -4.25,
    'sign conventions belong to quantities; a rate is written as stated');

  const noBand = readStoredEventModifiers(throughXlsx([toRow(EVENT)])[0]);
  check('R3 CARRIER: absent when nothing is stated, not {}',
    noBand.promoBandArpuOverride === undefined, JSON.stringify(noBand.promoBandArpuOverride));
  check('R3 CARRIER: an EMPTY map reads absent — "no members" is not "no map"',
    readStoredEventModifiers(
      throughXlsx([toRow({ ...EVENT, promoBandArpuOverride: {} } as MarketEvent)])[0]
    ).promoBandArpuOverride === undefined);

  const zero = readStoredEventModifiers(throughXlsx([toRow({ ...EVENT, promoPricingAmount: 0 } as MarketEvent)])[0]);
  check('CARRIER: a real ZERO override survives as 0, not as absent',
    zero.promoPricingAmount === 0, `${zero.promoPricingAmount}`);
  check('CARRIER: and absent is still distinguishable from that zero',
    zero.promoPricingAmount === 0 && m.promoPricingAmount === undefined,
    'zero and absent collapsed — the empty-string carrier is gone');
}

// ── LEGACY SAVE: no promo columns at all ─────────────────────────────────
// A pre-promo-field save has none of these columns. Every one must read as its
// documented absent value, and nothing may throw.
{
  const legacy = {
    ID: 'legacy-1', Sequence: 1, Name: 'old', Campaign_Name: 'old',
    Scenario: 'Inflow', Segment: 'All', Product: 'All', Channel: 'All',
    Start_Month: '2026-01', Subscriber_Volume: 100, Customer_Volume: 100,
    Revenue: 1000, ARPU: 10, Comment: '',
  };
  const m = readStoredEventModifiers(throughXlsx([legacy])[0]);
  check('LEGACY: reads without throwing', !!m);
  check('LEGACY: promo fields absent, not defaulted to values',
    m.promoMixAxis === undefined && m.promoMix === undefined
      && m.promoPricingMode === undefined && m.promoPricingAmount === undefined,
    'a legacy save gained promo settings it never had');
  check('LEGACY: isPromotion false — a legacy event is not a promotion',
    m.isPromotion === false && m.promoRebanded === false);
  check('LEGACY: behaviour fields read as they did before the columns existed',
    m.amountType === 'absolute' && m.percentageBasis === 'baseline' && m.retentionLinked === true);
}

// ── MALFORMED INPUT degrades to absence, never to a half-read value ──────
{
  const bad = readStoredEventModifiers({ Promo_Mix_JSON: '{not json', Promo_Mix_Axis: 'sideways',
    Promo_Pricing_Mode: 'gratis', Promo_Pricing_Amount: 'lots' });
  check('MALFORMED: unparseable mix reads absent', bad.promoMix === undefined);
  check('MALFORMED: an unknown axis reads absent', bad.promoMixAxis === undefined);
  check('MALFORMED: an unknown pricing mode reads absent', bad.promoPricingMode === undefined);
  check('MALFORMED: a non-numeric amount reads absent, not NaN',
    bad.promoPricingAmount === undefined, `${bad.promoPricingAmount}`);
  check('MALFORMED: an empty mix object reads absent, not an empty mix',
    readStoredEventModifiers({ Promo_Mix_JSON: '{}' }).promoMix === undefined);
}

// ── ORDERING, since the export sorts by sequence ────────────────────────
{
  const rows = throughXlsx([toRow({ ...EVENT, id: 'b', sequence: 2 } as MarketEvent),
                            toRow({ ...EVENT, id: 'a', sequence: 1 } as MarketEvent)]);
  const sorted = [...rows].sort((x: any, y: any) => bySequence({ sequence: x.Sequence } as any, { sequence: y.Sequence } as any));
  check('ORDER: sequence survives and sorts', String(sorted[0].ID) === 'a', String(sorted[0].ID));
}

// ── WIRING: both import routes use the ONE reader, and the writer matches ──
{
  const app = fs.readFileSync('src/App.tsx', 'utf8').replace(/\/\/[^\n]*/g, '');
  // RE-AIMED 2026-08-19, and the re-aim is the whole point of the pin moving.
  // This counted the SPREADS IN APP, which was the right thing to count while
  // the parse lived in App. Extracting marketEventFromRow moved the spread out
  // of App entirely, so the old count is now 0 and would have gone red — the
  // stale-anchor lesson, caught by the harness failing rather than passing
  // quietly. What must stay true is UNCHANGED in substance: both routes reach
  // the modifiers through ONE function, so a field added there reaches both or
  // neither. Only the location of that one function changed.
  const uses = (app.match(/marketEventFromRow\(/g) ?? []).length;
  check('WIRING: BOTH import routines read the shared reader', uses === 2,
    `${uses} site(s) — the promo fields round-trip on one path only again`);
  check('WIRING: App no longer parses market rows itself',
    !app.includes('...readStoredEventModifiers(r)'),
    'a parse back inside the component cannot be driven by this spec at all');
  check('WIRING: neither route hand-rolls the promo fields any more',
    !/promoMixAxis:\s+r[.[]/.test(app) && !/promoPricingMode:\s+r[.[]/.test(app),
    'a per-site copy is back, which is how the two routes drifted');

  // RE-AIMED 2026-08-13. These grepped App.tsx for each column, which was right
  // while the row literal lived there. Extracting marketEventExportRow moved the
  // lines they pinned and they went red — the stale-anchor lesson, caught by the
  // harness failing rather than passing quietly.
  //
  // Aimed at the PROPERTY now, and a stronger one: the row the REAL writer emits
  // actually carries each column. That cannot go stale on a move, and it
  // exercises the writer instead of grepping for it.
  const emitted = marketEventExportRow(EVENT);
  for (const col of ['Is_Promotion', 'Promo_Rebanded', 'Promo_Mix_Axis',
                     'Promo_Mix_JSON', 'Promo_Pricing_Mode', 'Promo_Pricing_Amount',
                     'Amount_Type', 'Percentage_Basis', 'Retention_Linked',
                     'Arpu_Override', 'Promo_Band_ARPU_Override_JSON']) {
    check(`WRITER: the real export row carries ${col}`, col in emitted,
      'the export dropped a column this spec round-trips');
  }
  // THE ROUTE COUNT, PINNED — the fifth-writer lesson. Market events have TWO
  // import routes and both go through marketEventFromRow, so extending that one
  // function reaches both or neither. A third route, or a route that parses for
  // itself, is the shape this pin exists to catch.
  //
  // THE INVARIANT AFTER THE 2026-08-19 EXTRACTION, stated as exact counts and
  // never as a lower bound — a `>=` here would pass while a route quietly
  // stopped using the reader, which is the exact defect being pinned:
  //
  //   App.tsx              — exactly 2 marketEventFromRow call sites:
  //                          the session restore (Market_Events sheet) and the
  //                          workbook import (eventsSheetName). Exactly 0 spreads.
  //   forecasting.ts       — exactly 1 ...readStoredEventModifiers(r) spread,
  //                          inside marketEventFromRow, applied to whichever
  //                          source branch produced the base fields.
  //
  // The two SOURCES are named rather than counted loosely: they are genuinely
  // different parses (ids, `??` vs `||` defaults, Outflow sign), and the pin
  // must fail if either route silently adopts the other's rules.
  const sessionRoute  = (app.match(/marketEventFromRow\(r, 'session'\)/g) ?? []).length;
  const workbookRoute = (app.match(/marketEventFromRow\(r, 'workbook'\)/g) ?? []).length;
  check('PIN: exactly TWO market-event import routes, one per source',
    sessionRoute === 1 && workbookRoute === 1,
    `session=${sessionRoute} workbook=${workbookRoute} — a route added or dropped`);
  check('PIN: App holds NO market-row parse of its own',
    (app.match(/\.\.\.readStoredEventModifiers\(r\)/g) ?? []).length === 0,
    'the parse moved to forecasting.ts; a spread back in App means a re-inlined route');
  const fc = fs.readFileSync('src/utils/forecasting.ts', 'utf8').replace(/\/\/[^\n]*/g, '');
  check('PIN: exactly ONE modifier spread, and it is inside the shared reader',
    (fc.match(/\.\.\.readStoredEventModifiers\(r\)/g) ?? []).length === 1,
    'two spreads means the source branches diverged on the modifiers too');

  check('WRITER: App uses the SHARED row builder, not a second literal',
    app.includes('map(marketEventExportRow)'),
    'a re-inlined literal would put the spec back to certifying a copy');
}

// ---------------------------------------------------------------------------
// BEHAVIOURAL CASE — a real exported save carrying real promotion events.
//
// Every check above this line is CONSTRUCTED: it builds an event in memory,
// writes it, reads it back. That proves the round trip's logic over the real
// file format and nothing about any save that exists. Until 2026-08-11 no
// shipped save carried a promotion event at all, so there was nothing else it
// could have been.
//
// This block drives a save produced by `scripts/build-promo-mix-fixture.mjs`,
// whose mix was SOLVED BY THE ENGINE from a held member and a typed target —
// so what round-trips here is a mix the card could actually have produced,
// not one I chose because it was convenient to assert.
// ---------------------------------------------------------------------------
{
  const FIX = 'test-data/PROSPECT_Save_PromoMix_Behavioural.xlsx';
  if (!fs.existsSync(FIX)) {
    // NOT silently skipped. A behavioural case that vanishes when its fixture is
    // absent is how a suite comes to report green while testing less than it
    // claims — and this fixture is gitignored like every other, so absence in a
    // fresh clone is expected and must be loud.
    check('BEHAVIOURAL: the promo-mix fixture is present', false,
      `missing ${FIX} — run: node scripts/build-promo-mix-fixture.mjs`);
  } else {
    const wb = XLSX.read(fs.readFileSync(FIX), { cellDates: true });
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets['Market_Events']);
    check('BEHAVIOURAL: the save carries six promotion events', rows.length === 6, `${rows.length}`);

    const read = rows.map(r => readStoredEventModifiers(r));

    check('BEHAVIOURAL: every row reads as a promotion',
      read.filter(m => m.isPromotion).length === 6, `${read.filter(m => m.isPromotion).length}/6`);

    // THE EDITABLE ARPU, on a real file rather than a literal. Stated, stated
    // as zero, and unset — all three in one save, which is the distinction the
    // carrier exists for and the one a single-value fixture cannot show.
    check('BEHAVIOURAL: a stated ARPU override survives the round trip',
      read[3].arpuOverride === 31.4, `${read[3].arpuOverride}`);
    check('BEHAVIOURAL: a stated ZERO override survives as 0, not as unset',
      read[4].arpuOverride === 0, `${read[4].arpuOverride}`);
    check('BEHAVIOURAL: a NEGATIVE stated rate survives a real file as negative',
      read[5].arpuOverride === -4.25, `${read[5].arpuOverride}`);
    check('BEHAVIOURAL: and the rows that state nothing reload UNSET, not 0',
      read.slice(0, 3).every(m => m.arpuOverride === undefined),
      JSON.stringify(read.slice(0, 3).map(m => m.arpuOverride)));

    // The mix the engine solved must survive the file unchanged.
    const mix = read[0].promoMix;
    check('BEHAVIOURAL: the solved mix survives the round trip', !!mix && Object.keys(mix).length === 3,
      JSON.stringify(mix));
    check('BEHAVIOURAL: the HELD member is still exactly where it was held',
      !!mix && Math.abs((mix['High Value'] ?? -1) - 40) < 1e-9, String(mix?.['High Value']));
    const sum = mix ? Object.values(mix).reduce((a, b) => a + b, 0) : NaN;
    check('BEHAVIOURAL: and the restored mix still totals 100', Math.abs(sum - 100) < 1e-9, String(sum));

    // The blend the mix was solved FOR — re-derived from the restored shares
    // rather than read from the stored ARPU column, so this measures the mix
    // and not the number that was written beside it.
    const ARPUS: Record<string, number> = { 'Low Value': 8, 'Mid Value': 20, 'High Value': 45 };
    const reblend = mix ? Object.keys(mix).reduce((s, k) => s + (mix[k] / 100) * ARPUS[k], 0) : NaN;
    check('BEHAVIOURAL: the restored mix still blends to the target that produced it',
      Math.abs(reblend - 26) < 1e-9, `${reblend} vs 26`);

    // Absence, on a real file rather than a literal.
    check('BEHAVIOURAL: the zero pricing amount survives as 0, not as absence',
      read[1].promoPricingAmount === 0, String(read[1].promoPricingAmount));
    check('BEHAVIOURAL: and the event with no mix arm reads ABSENT, not empty',
      read[2].promoMix === undefined && read[2].promoMixAxis === undefined,
      JSON.stringify({ mix: read[2].promoMix, axis: read[2].promoMixAxis }));
  }
}

console.log(`event-roundtrip spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
