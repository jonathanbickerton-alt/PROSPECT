/**
 * REQ-D6-03 — RAMP THEN HOLD: the shape, the plateau, and the column.
 *
 *   npm run spec:hold-shape
 *
 * Drives the REAL `spreadShape` and `holdPlateauStart`, and the REAL export
 * row and reader.
 *
 * WHAT MAKES THIS FILE WORTH HAVING IS ITS FIRST SECTION.
 *
 * Decision 3 says the Hold-OFF path is unchanged and BYTE-IDENTICAL, and that
 * is a claim about a path this session rewrote — the inline `pct / total` in
 * two handlers became a call into a shared generator. A spec that asserted the
 * new code against itself would pass whatever the new code happened to do, so
 * the hold-off expectations here are HAND-WRITTEN LITERALS, computed from the
 * OLD arithmetic before the generator existed and recorded with their
 * derivation. Nothing in section 1 is read back from the function under test.
 *
 * The rest asserts the new shape, the restore, and the round trip.
 */
import { spreadShape, holdPlateauStart } from '../src/components/WhatIfTab';
import { marketEventExportRow, marketEventFromRow, type MarketEvent } from '../src/utils/forecasting';
import fs from 'fs';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

/** The even distribution the card builds, reproduced here rather than imported
 *  — this file must not depend on the component's control state. */
const even = (n: number) => Array.from({ length: n }, () => 100 / n);

/** What a handler does with a shape: the volume it writes on each row. */
const volumes = (shape: { fraction: number }[], amount: number, round = true) =>
  shape.map(s => round ? Math.round(amount * s.fraction) : amount * s.fraction);

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE HOLD-OFF DIFFERENTIAL — decision 3, against hand-written literals
//
// Every expected list below was computed from the arithmetic AS IT STOOD at
// c11151e:
//
//     const pcts     = even ? Array(N).fill(100/N) : customDist.slice(0, N)
//     const total    = pcts.reduce((s, p) => s + p, 0)
//     const fraction = pcts[i] / total
//     const vol      = Math.round(amount * fraction)
//
// and each is annotated with the division that produces it. `horizonMonths` is
// passed deliberately LARGE on every case: with hold off it must have no
// effect whatsoever, and a generator that leaked the tail into the hold-off
// arm would fail on the row COUNT before it failed on any figure.
// ═══════════════════════════════════════════════════════════════════════════
{
  const off = (amount: number, months: number, dist: number[]) =>
    volumes(spreadShape({ months, dist, hold: false, horizonMonths: 60 }), amount);

  // 300 over 3 even: 300 * (100/3)/(100/3*3) = 99.99999999999999 -> 100
  check('HOLD OFF: 300 over 3 even is 100 / 100 / 100',
    off(300, 3, even(3)).join(',') === '100,100,100', off(300, 3, even(3)).join(','));

  // 2500 over 3 even: 2500 * 0.3333333333333333 = 833.3333333333333 -> 833.
  // THE DECISION-3 CASE. Decision 2's example for the SAME figure is
  // 833 / 1667 / 2500 — the two lists are the two readings, side by side.
  check('HOLD OFF: 2500 over 3 even is 833 / 833 / 833 (the split, not the ramp)',
    off(2500, 3, even(3)).join(',') === '833,833,833', off(2500, 3, even(3)).join(','));

  // 100 over 3 even: 33.33333333333333 -> 33 each; the total is 99, not 100,
  // and that is the OLD behaviour faithfully preserved rather than repaired.
  check('HOLD OFF: 100 over 3 even is 33 / 33 / 33, losing 1 to rounding',
    off(100, 3, even(3)).join(',') === '33,33,33', off(100, 3, even(3)).join(','));

  // 2500 over 4 even: 100/4 = 25 exactly, total exactly 100, fraction 0.25.
  check('HOLD OFF: 2500 over 4 even is 625 x 4',
    off(2500, 4, even(4)).join(',') === '625,625,625,625', off(2500, 4, even(4)).join(','));

  // Custom 50/30/20 of 1000: 500 / 300.00000000000006 / 200.00000000000003.
  check('HOLD OFF: custom 50/30/20 of 1000 is 500 / 300 / 200',
    off(1000, 3, [50, 30, 20]).join(',') === '500,300,200', off(1000, 3, [50, 30, 20]).join(','));

  // Un-normalised shares still normalise: total 3, fraction 1/3, 10/3 -> 3.
  check('HOLD OFF: shares are normalised, not assumed to sum to 100',
    off(10, 3, [1, 1, 1]).join(',') === '3,3,3', off(10, 3, [1, 1, 1]).join(','));

  // THE ROW COUNT IS THE RAMP LENGTH AND NOTHING MORE — "then nothing".
  check('HOLD OFF: exactly N rows, whatever the horizon',
    spreadShape({ months: 3, dist: even(3), hold: false, horizonMonths: 60 }).length === 3,
    String(spreadShape({ months: 3, dist: even(3), hold: false, horizonMonths: 60 }).length));
  check('HOLD OFF: no row is marked held',
    spreadShape({ months: 3, dist: even(3), hold: false, horizonMonths: 60 })
      .every(s => !s.held));
  // The fractions are SHARES OF A TOTAL and sum to 1 — the property that
  // distinguishes this arm from the other one, asserted rather than implied.
  check('HOLD OFF: the fractions sum to 1',
    near(spreadShape({ months: 3, dist: even(3), hold: false, horizonMonths: 60 })
      .reduce((s, r) => s + r.fraction, 0), 1));
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. THE HOLD-ON SHAPE — decision 2
//
// The entered figure is the TARGET, the ramp is linear-cumulative to it, and
// the tail repeats it to the horizon end.
// ═══════════════════════════════════════════════════════════════════════════
{
  const on = (amount: number, months: number, dist: number[], horizon: number, round = true) =>
    volumes(spreadShape({ months, dist, hold: true, horizonMonths: horizon }), amount, round);

  // THE BRIEF'S OWN EXAMPLE, verbatim: 2,500 over 3 = 833 / 1,667 / 2,500,
  // then 2,500 held.
  check('HOLD ON: 2500 over 3 even is 833 / 1667 / 2500, then 2500 held',
    on(2500, 3, even(3), 6).join(',') === '833,1667,2500,2500,2500,2500',
    on(2500, 3, even(3), 6).join(','));

  // The percentage arm, unrounded — a rate, not a count. 10% over 3 is
  // 3.33 / 6.67 / 10 and NOT 3 / 7 / 10.
  const pct = on(10, 3, even(3), 5, false);
  check('HOLD ON: 10% over 3 reaches 3.33 / 6.67 / 10',
    near(pct[0], 10 / 3) && near(pct[1], 20 / 3) && pct[2] === 10,
    pct.map(v => v.toFixed(4)).join(','));
  check('HOLD ON: the held months are the target EXACTLY, not 9.999...',
    pct[3] === 10 && pct[4] === 10, `${pct[3]},${pct[4]}`);

  // THE LAST RAMP MONTH IS THE TARGET, the property churn-fold-spec:244
  // already pins on the other carrier. Asserted with === and not `near`,
  // because the generator sets a literal 1 rather than summing to it.
  check('HOLD ON: the last ramp month equals the target exactly',
    spreadShape({ months: 3, dist: even(3), hold: true, horizonMonths: 6 })[2].fraction === 1);
  check('HOLD ON: and so does a 7-month even ramp, where 100/7 never sums clean',
    spreadShape({ months: 7, dist: even(7), hold: true, horizonMonths: 9 })[6].fraction === 1);

  // Custom under hold CUMULATES to the target — decision 2's last clause.
  check('HOLD ON: custom 50/30/20 of 1000 cumulates 500 / 800 / 1000',
    on(1000, 3, [50, 30, 20], 5).join(',') === '500,800,1000,1000,1000',
    on(1000, 3, [50, 30, 20], 5).join(','));
  // ...and EVEN IS THE LINEAR CASE, not a separate branch: an explicit even
  // custom distribution must produce exactly what `even(4)` does.
  check('HOLD ON: Even is the linear case',
    on(1000, 4, [25, 25, 25, 25], 4).join(',') === on(1000, 4, even(4), 4).join(','),
    on(1000, 4, [25, 25, 25, 25], 4).join(','));

  // DECISION 4 — spread OFF is a ramp of length 1 plus the tail.
  check('HOLD ON: ramp length 1 is the figure in every month',
    on(2500, 1, [100], 4).join(',') === '2500,2500,2500,2500',
    on(2500, 1, [100], 4).join(','));

  // THE TAIL IS MARKED, and only the tail — the preview summarises it and
  // must be able to tell the two apart.
  const s6 = spreadShape({ months: 3, dist: even(3), hold: true, horizonMonths: 6 });
  check('HOLD ON: exactly the ramp months are unheld',
    s6.filter(r => !r.held).length === 3 && s6.filter(r => r.held).length === 3);
  check('HOLD ON: offsets are consecutive from 0',
    s6.map(r => r.offset).join(',') === '0,1,2,3,4,5', s6.map(r => r.offset).join(','));

  // THE HORIZON IS A CEILING, NOT A FLOOR. A campaign starting at or past the
  // last forecast month has nothing to hold into, and none is invented.
  check('HOLD ON: a horizon shorter than the ramp emits the ramp alone',
    spreadShape({ months: 3, dist: even(3), hold: true, horizonMonths: 2 }).length === 3,
    String(spreadShape({ months: 3, dist: even(3), hold: true, horizonMonths: 2 }).length));
  check('HOLD ON: an unknown start month (horizon 0) emits the ramp alone',
    spreadShape({ months: 3, dist: even(3), hold: true, horizonMonths: 0 }).length === 3,
    String(spreadShape({ months: 3, dist: even(3), hold: true, horizonMonths: 0 }).length));

  // A zero or negative distribution has no honest shape — never a divide by 0.
  check('EDGE: an empty distribution yields no rows rather than NaN',
    spreadShape({ months: 3, dist: [0, 0, 0], hold: true, horizonMonths: 6 }).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. THE PLATEAU START — decision 5's ramp-length rule
// ═══════════════════════════════════════════════════════════════════════════
{
  check('PLATEAU: 833/1667/2500/2500/2500 restores a 3-month ramp',
    holdPlateauStart([833, 1667, 2500, 2500, 2500]) === 3,
    String(holdPlateauStart([833, 1667, 2500, 2500, 2500])));
  check('PLATEAU: a flat held campaign restores a 1-month ramp',
    holdPlateauStart([2500, 2500, 2500]) === 1, String(holdPlateauStart([2500, 2500, 2500])));
  check('PLATEAU: custom 500/800/1000/1000 restores 3',
    holdPlateauStart([500, 800, 1000, 1000]) === 3, String(holdPlateauStart([500, 800, 1000, 1000])));

  // THE CASE AN ABSOLUTE TOLERANCE GETS WRONG. Every step of a held +0.4%
  // campaign is inside half a unit of the target, so a 0.5 tolerance would
  // call month 1 the plateau. This is the check that makes the tolerance
  // relative rather than a matter of taste.
  check('PLATEAU: a sub-unit percentage ramp still restores 3, not 1',
    holdPlateauStart([0.4 / 3, 0.8 / 3, 0.4, 0.4]) === 3,
    String(holdPlateauStart([0.4 / 3, 0.8 / 3, 0.4, 0.4])));

  check('PLATEAU: an empty list is a one-month ramp, never 0',
    holdPlateauStart([]) === 1, String(holdPlateauStart([])));

  // ROUND TRIP THROUGH THE GENERATOR: the length that goes in comes back.
  for (const n of [1, 2, 3, 5, 7]) {
    const figs = volumes(spreadShape({ months: n, dist: even(n), hold: true, horizonMonths: 12 }), 2400);
    check(`PLATEAU: a ${n}-month even ramp round-trips its length`,
      holdPlateauStart(figs) === n, `${holdPlateauStart(figs)} from ${figs.join(',')}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. THE COLUMN — decision 5's carrier, through the REAL export and reader
// ═══════════════════════════════════════════════════════════════════════════
{
  const base: MarketEvent = {
    id: 'm1', scenario: 'Inflow', segment: 'All', product: 'All', productL2: 'All',
    channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
    date: '2026-01', sequence: 1, subscriberVolume: 100, customerVolume: 0,
    revenue: 0, arpu: 0, campaignName: 'C', comment: '', contractLength: 24,
  };

  const held = marketEventExportRow({ ...base, hold: true });
  const plain = marketEventExportRow(base);
  check('COLUMN: a held row writes Hold Yes', held.Hold === 'Yes', String(held.Hold));
  check('COLUMN: an unheld row writes Hold No', plain.Hold === 'No', String(plain.Hold));
  check('COLUMN: Hold is the LAST column',
    Object.keys(held)[Object.keys(held).length - 1] === 'Hold',
    Object.keys(held)[Object.keys(held).length - 1]);

  // ABSENT MEANS OFF — the whole reason every existing save reloads unchanged.
  const legacy = { ...plain }; delete (legacy as any).Hold;
  check('READER: an absent Hold column is OFF',
    marketEventFromRow(legacy as any, 'session').hold === false,
    String(marketEventFromRow(legacy as any, 'session').hold));
  check('READER: Hold No is OFF',
    marketEventFromRow(plain as any, 'session').hold === false);
  check('READER: Hold Yes is ON',
    marketEventFromRow(held as any, 'session').hold === true);
  // ONLY the literal 'Yes'. A hand-edited workbook carrying a truthy-looking
  // value must not turn a campaign into a 40-month one.
  for (const stray of ['TRUE', 'true', 'yes', '1', 1, true, '']) {
    check(`READER: ${JSON.stringify(stray)} is not 'Yes' and reads OFF`,
      marketEventFromRow({ ...plain, Hold: stray } as any, 'session').hold === false,
      String(stray));
  }
  // THE OTHER IMPORT ROUTE gets it too — the modifier reader is spread by both.
  check('READER: the workbook route reads Hold as well',
    marketEventFromRow({ Scenario: 'Inflow', Hold: 'Yes' } as any, 'workbook').hold === true);

  // FULL ROUND TRIP, both ways round.
  const backHeld = marketEventFromRow(held as any, 'session');
  check('ROUND TRIP: hold survives export -> import',
    backHeld.hold === true && backHeld.subscriberVolume === 100);
  check('ROUND TRIP: and re-exports identically',
    marketEventExportRow(backHeld).Hold === 'Yes');
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// 4b. CLAUSE 10 — SIX RAMP/HOLD CONTROLS, ONE COMPONENT
//
// Structural, and deliberately a COUNT rather than a search for a name: the
// failure this guards is one card drifting back to its own inline control,
// which leaves five uses and one hand-rolled button. A count catches that; a
// grep for "RampHoldCheckbox" would still pass with five.
// ═══════════════════════════════════════════════════════════════════════════
{
  const wi = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
  const uses = (wi.match(/<RampHoldCheckbox[\s\/>]/g) ?? []).length;
  check('CLAUSE 10: EXACTLY six RampHoldCheckbox uses in WhatIfTab',
    uses === 6, String(uses));
  // THE DISCRIMINATOR, added after trap 222 planted GREEN on its first run.
  // The count above was a PREFIX match, so a mutation that renamed one use to
  // <RampHoldCheckboxPLANTED and added a hand-rolled <input> beside it still
  // counted six. Two corrections: the tag must END at the name (the character
  // class on the regex above), and each of the six testids must appear
  // EXACTLY ONCE in WhatIfTab — an inline copy carrying the same testid makes
  // it two, and a testid is what every mounted spec reaches the control by.
  for (const id of ['volume-spread-toggle', 'volume-hold-toggle',
                    'promo-spread-toggle', 'promo-hold-toggle',
                    'churn-ramp-toggle', 'churn-hold-toggle']) {
    const n = wi.split(id).length - 1;
    check('CLAUSE 10: testid ' + id + ' appears exactly once in WhatIfTab',
      n === 1, String(n));
  }
  const comp = fs.readFileSync('src/components/RampHoldCheckbox.tsx', 'utf8');
  check('CLAUSE 10: the component renders a real <input type="checkbox">',
    comp.includes('type="checkbox"'));
  // THE GLYPH IS THE WHOLE POINT of clause 10 — a round dot in a checkbox
  // component would be the radio look returning by the back door.
  check('CLAUSE 10: and no round-dot glyph survives in it',
    !comp.includes('rounded-full'), 'a radio dot in the checkbox component');
}

// 5. THE KEYS — six locales, never English in five of them
// ═══════════════════════════════════════════════════════════════════════════
{
  const LOC = ['en', 'de', 'es', 'fr', 'it', 'pt'];
  const KEYS = ['whatif_hold_after_ramp_label', 'whatif_hold_after_ramp_help',
    'whatif_hold_then_held_through'];
  const missing: string[] = [];
  const englishLeak: string[] = [];
  const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
  for (const l of LOC) {
    const d = JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'));
    for (const k of KEYS) {
      if (typeof d[k] !== 'string' || !d[k].length) missing.push(`${l}/${k}`);
      // NOT A STYLE CHECK. "never leave English" was an instruction, and a key
      // copied verbatim from en is exactly how a locale silently stays English.
      else if (l !== 'en' && d[k] === en[k]) englishLeak.push(`${l}/${k}`);
    }
  }
  check('i18n: every hold key in all six locales', missing.length === 0, missing.join(', '));
  check('i18n: no locale carries the English string verbatim',
    englishLeak.length === 0, englishLeak.join(', '));
  // The placeholders must survive translation or the tail line renders a
  // literal {{p0}} in five languages.
  const ph: string[] = [];
  for (const l of LOC) {
    const d = JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'));
    if (!d.whatif_hold_then_held_through.includes('{{p0}}')
      || !d.whatif_hold_then_held_through.includes('{{p1}}')) ph.push(l);
  }
  check('i18n: the tail line keeps both placeholders', ph.length === 0, ph.join(', '));
}

console.log(`\nhold-shape spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
