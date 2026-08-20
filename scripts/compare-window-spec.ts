/**
 * THE COMPARE CHART'S BRUSH WINDOW — clamped, reset, and honest about blanks.
 *
 *   npm run spec:compare-window
 *
 * Drives the REAL `windowBounds` and the REAL `selectionUncoveredByBaseline`.
 * Both were extracted for this session: the window was two inline JSX props on
 * the Brush, which is the shape that cannot be reached without a mount — and
 * the two props disagreed for as long as they existed, `endIndex` clamped and
 * `startIndex` not.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - THE POSTCONDITION IS ASSERTED OVER EVERY CASE, not just the interesting
 *    ones: `start > end` must not be representable as an output. A spec that
 *    only checked the cases it thought of would miss the next one.
 *  - EXPECTED INDICES ARE HAND-WRITTEN LITERALS, never recomputed from the
 *    function under test.
 *  - THE DEGENERATE CASES ARE THE POINT. An ordinary window passes under the
 *    OLD broken code too, so a fixture list of sensible inputs would prove
 *    nothing about the defect being fixed.
 */
import fs from 'fs';
import { windowBounds, selectionUncoveredByBaseline } from '../src/utils/viewFilter';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE DEFECT: a stale offset past the end of a shorter dataset
// ═══════════════════════════════════════════════════════════════════════════
{
  // THE REPORTED SHAPE. Dragged to month 40 of a 60-month series, then a
  // filter change leaves 24 months. Old code: startIndex=40, endIndex=23.
  const w = windowBounds(40, 'all', 24);
  check('DEGENERATE: an offset past the end never yields start > end',
    w.start <= w.end, `start=${w.start} end=${w.end} — this is the blank chart`);
  check('DEGENERATE: it clamps to the last index, not past it',
    w.start === 23 && w.end === 23, `start=${w.start} end=${w.end}, expected 23/23`);

  const sized = windowBounds(40, 6, 24);
  check('DEGENERATE: same with a sized window',
    sized.start === 23 && sized.end === 23, `start=${sized.start} end=${sized.end}`);

  // OFFSET EXACTLY AT LENGTH — the off-by-one that a `<` vs `<=` slip produces.
  const at = windowBounds(24, 'all', 24);
  check('BOUNDARY: offset === length clamps to the last index',
    at.start === 23 && at.end === 23, `start=${at.start} end=${at.end}`);

  const justInside = windowBounds(23, 'all', 24);
  check('BOUNDARY: offset === length-1 is untouched',
    justInside.start === 23 && justInside.end === 23);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. NO DATA IS A STATED EMPTY, not a window over nothing
// ═══════════════════════════════════════════════════════════════════════════
{
  const none = windowBounds(0, 'all', 0);
  check('EMPTY: zero-length data reports empty', none.empty === true);
  check('EMPTY: and does NOT report end = -1',
    none.end >= 0, `end=${none.end} — {start:0,end:-1} is start > end by another route`);

  const negLen = windowBounds(5, 6, -3);
  check('EMPTY: a negative length is empty too', negLen.empty === true);

  check('EMPTY: a populated dataset is never empty',
    windowBounds(0, 'all', 1).empty === false);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. ORDINARY WINDOWS — hand-written expectations
// ═══════════════════════════════════════════════════════════════════════════
{
  const all = windowBounds(0, 'all', 24);
  check("ORDINARY: size 'all' spans the whole series",
    all.start === 0 && all.end === 23, `${all.start}..${all.end}`);

  const six = windowBounds(0, 6, 24);
  check('ORDINARY: a 6-month window from 0 is indices 0..5',
    six.start === 0 && six.end === 5, `${six.start}..${six.end}`);

  const offset = windowBounds(10, 6, 24);
  check('ORDINARY: a 6-month window from 10 is indices 10..15',
    offset.start === 10 && offset.end === 15, `${offset.start}..${offset.end}`);

  // The size runs off the end but the OFFSET is valid — clamp the end only.
  const overrun = windowBounds(20, 12, 24);
  check('ORDINARY: a window overrunning the end clamps the end, keeps the start',
    overrun.start === 20 && overrun.end === 23, `${overrun.start}..${overrun.end}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. NONSENSE INPUTS still produce a valid window
// ═══════════════════════════════════════════════════════════════════════════
{
  check('NONSENSE: a negative offset clamps to 0',
    windowBounds(-5, 6, 24).start === 0);
  check('NONSENSE: a zero size shows one month, never an inverted window',
    (() => { const w = windowBounds(3, 0, 24); return w.start === 3 && w.end === 3; })(),
    JSON.stringify(windowBounds(3, 0, 24)));
  check('NONSENSE: a negative size shows one month',
    (() => { const w = windowBounds(3, -4 as any, 24); return w.start === 3 && w.end === 3; })(),
    JSON.stringify(windowBounds(3, -4 as any, 24)));
  check('NONSENSE: a fractional offset floors rather than producing a half index',
    windowBounds(3.7, 2, 24).start === 3);
  check('NONSENSE: NaN inputs do not escape the clamp',
    (() => { const w = windowBounds(NaN, NaN as any, 24); return w.start >= 0 && w.start <= w.end && w.end <= 23; })(),
    JSON.stringify(windowBounds(NaN, NaN as any, 24)));
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. THE POSTCONDITION, over a sweep — because the cases above are the ones
//    I thought of, and the invariant has to hold for the ones I did not.
// ═══════════════════════════════════════════════════════════════════════════
{
  let violations = 0; let checked = 0; let firstBad = '';
  const sizes: (number | 'all')[] = ['all', 1, 6, 12, 18, 24, 100];
  for (const len of [0, 1, 2, 5, 24, 60]) {
    for (const off of [-10, -1, 0, 1, 5, 23, 24, 25, 100]) {
      for (const size of sizes) {
        checked++;
        const w = windowBounds(off, size, len);
        if (w.empty) { if (len > 0) { violations++; firstBad ||= `empty on len=${len}`; } continue; }
        const ok = Number.isInteger(w.start) && Number.isInteger(w.end)
          && w.start >= 0 && w.start <= w.end && w.end <= len - 1;
        if (!ok) { violations++; firstBad ||= `off=${off} size=${size} len=${len} -> ${w.start}..${w.end}`; }
      }
    }
  }
  check(`POSTCONDITION: 0 <= start <= end <= length-1 across all ${checked} combinations`,
    violations === 0, `${violations} violations; first: ${firstBad}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5b. NEGATIVE CONTROL — the sweep can actually fail
//
// Everything above passed on the first run, which is the shape a vacuous spec
// has. So the same sweep is pointed at a verbatim replica of the SHIPPED
// expressions: `startIndex={windowOffset}` with only the end clamped. If the
// sweep cannot see that, it cannot see a regression either.
//
// Measured 2026-08-20: the old form violates 273 of 378 combinations, and the
// reported shape — dragged to month 40, then a filter leaves 24 months —
// yields {start:40, end:23}. That is the blank chart, in two numbers.
// ═══════════════════════════════════════════════════════════════════════════
{
  const shipped = (offset: number, size: number | 'all', len: number) => ({
    start: offset,
    end: size === 'all' ? len - 1 : Math.min(len - 1, offset + (size as number) - 1),
  });

  let oldViolations = 0;
  const sizes: (number | 'all')[] = ['all', 1, 6, 12, 18, 24, 100];
  for (const len of [0, 1, 2, 5, 24, 60])
    for (const off of [-10, -1, 0, 1, 5, 23, 24, 25, 100])
      for (const size of sizes) {
        const w = shipped(off, size, len);
        if (!(w.start >= 0 && w.start <= w.end && w.end <= len - 1)) oldViolations++;
      }

  check('NEGATIVE CONTROL: the sweep FAILS the shipped expressions',
    oldViolations > 0,
    'if this passes, the postcondition sweep above is vacuous');
  check('NEGATIVE CONTROL: and fails them a lot — 273 of 378 at last measure',
    oldViolations === 273, `${oldViolations} — the count moved; re-measure before trusting the sweep`);

  const reported = shipped(40, 'all', 24);
  check('NEGATIVE CONTROL: the reported shape is start 40 > end 23 under the old code',
    reported.start === 40 && reported.end === 23 && reported.start > reported.end,
    JSON.stringify(reported));
  const fixed = windowBounds(40, 'all', 24);
  check('NEGATIVE CONTROL: and is a valid window under the new one',
    fixed.start <= fixed.end, JSON.stringify(fixed));
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. THE RESET — an offset must not survive into a shorter dataset
// ═══════════════════════════════════════════════════════════════════════════
{
  const tab = fs.readFileSync('src/components/ScenarioCompareTab.tsx', 'utf8');

  check('RESET: the offset resets when the DATA LENGTH changes',
    /useEffect\(\(\) => \{ setWindowOffset\(0\); \}, \[chartData\.length\]\)/.test(tab),
    'without this a clamped stale offset pins the view to the final month');

  // THE TRIGGER IS LENGTH, NOT FILTER IDENTITY — the weaker trigger on purpose.
  // Resetting on every filter touch would discard a window the user set even
  // when the new series is the same length, and an offset valid for a 24-month
  // series is valid for any other 24-month series.
  check('RESET: it does NOT reset on filter identity',
    !/setWindowOffset\(0\); \}, \[view/.test(tab),
    'a stronger trigger throws away a window the user set, for no invariant gained');

  // Simulate what the reset guarantees, through the real function.
  const beforeLen = 60, afterLen = 24, draggedTo = 40;
  const stale = windowBounds(draggedTo, 'all', afterLen);
  const afterReset = windowBounds(0, 'all', afterLen);
  check('RESET: without it the clamped window would sit at the last month',
    stale.start === afterLen - 1, `${stale.start}`);
  check('RESET: with it the window starts at the beginning of the new series',
    afterReset.start === 0 && afterReset.end === afterLen - 1,
    `${afterReset.start}..${afterReset.end}`);
  check('RESET: and the pre-change window was valid for the LONGER series',
    windowBounds(draggedTo, 'all', beforeLen).start === draggedTo,
    'the offset was never wrong — it was wrong for the new data');
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. THE TWO BLANKS — driven through the REAL predicate
// ═══════════════════════════════════════════════════════════════════════════
{
  // A session whose EVENTS name a product the BASELINE never carries. This is
  // the situation the specific message exists for, and it is constructed
  // rather than borrowed: the four real saves have ZERO such values (measured
  // in the 2026-08-20 diagnosis), so a real file could not exercise it.
  const uncovered = [{
    baselineRows: [
      { Segment: 'Corporate', Product: 'Mobile Data', Channel: 'Direct' },
      { Segment: 'SME', Product: 'Fixed Connectivity', Channel: 'Indirect' },
    ],
    marketEvents: [],
    yieldEvents: [],
    pricingEvents: [{ Segment: 'Corporate', Product: 'Satellite IoT', Channel_L1: 'Direct' }],
  }];

  check('TWO BLANKS: an event-only PRODUCT is reported as uncovered',
    selectionUncoveredByBaseline(
      { segment: 'Corporate', product: 'Satellite IoT', channel: 'Direct' }, uncovered) === true,
    'the events exist and the baseline does not cover them');

  check('TWO BLANKS: a product the baseline DOES carry is NOT reported',
    selectionUncoveredByBaseline(
      { segment: 'Corporate', product: 'Mobile Data', channel: 'Direct' }, uncovered) === false,
    'an ordinary empty result must keep the ordinary message');

  // The Mobile Voice case from Jon's report: present in BOTH vocabularies, so
  // it must NOT get the specific message. This is the check that stops the new
  // message becoming a catch-all for every blank.
  const covered = [{
    baselineRows: [{ Segment: 'Corporate', Product: 'Mobile Voice', Channel: 'Direct' }],
    marketEvents: [],
    yieldEvents: [],
    pricingEvents: [{ Segment: 'Corporate', Product: 'Mobile Voice', Channel_L1: 'Direct' }],
  }];
  check('TWO BLANKS: a value in BOTH vocabularies is not uncovered — the reported case',
    selectionUncoveredByBaseline(
      { segment: 'Corporate', product: 'Mobile Voice', channel: 'Direct' }, covered) === false,
    'Mobile Voice is in both; the 2026-08-20 diagnosis measured 0 uncovered values');

  check('TWO BLANKS: an event-only SEGMENT is reported',
    selectionUncoveredByBaseline({ segment: 'Public Sector', product: null, channel: null },
      [{ baselineRows: [{ Segment: 'Corporate' }], marketEvents: [{ Segment: 'Public Sector' }] }]) === true);
  check('TWO BLANKS: an event-only CHANNEL is reported',
    selectionUncoveredByBaseline({ segment: null, product: null, channel: 'Wholesale' },
      [{ baselineRows: [{ Channel: 'Direct' }], marketEvents: [{ Channel: 'Wholesale' }] }]) === true);

  // WILDCARDS ARE NOT VALUES. 'All' and null cannot be uncovered; reporting
  // them would show the specific message for a selection nobody narrowed.
  check('TWO BLANKS: an All selection is never uncovered',
    selectionUncoveredByBaseline({ segment: 'All', product: null, channel: null }, uncovered) === false);
  check('TWO BLANKS: an empty selection is never uncovered',
    selectionUncoveredByBaseline({ segment: null, product: null, channel: null }, uncovered) === false);

  // A value in NEITHER vocabulary is not an events problem — it is a stale
  // selection, and the ordinary message is the honest one.
  check('TWO BLANKS: a value in neither vocabulary keeps the ORDINARY message',
    selectionUncoveredByBaseline(
      { segment: null, product: 'Carrier Pigeon', channel: null }, uncovered) === false,
    'the specific message claims the events exist — it must not be said when they do not');

  check('TWO BLANKS: no sessions at all is not uncovered',
    selectionUncoveredByBaseline({ segment: 'X', product: 'Y', channel: 'Z' }, []) === false);
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. WIRING
// ═══════════════════════════════════════════════════════════════════════════
{
  const tab = fs.readFileSync('src/components/ScenarioCompareTab.tsx', 'utf8');
  const helper = fs.readFileSync('src/utils/scenarioHelper.ts', 'utf8');

  check('WIRING: the Brush reads the derived window, not inline arithmetic',
    tab.includes('startIndex={brush.start}') && tab.includes('endIndex={brush.end}'),
    'inline props are the untestable-in-place shape this session removed');
  check('WIRING: no inline clamp survives on the Brush',
    !tab.includes('Math.min(chartData.length - 1, windowOffset + windowSize - 1)'),
    'a second derivation would be free to disagree with the first again');
  check('WIRING: exactly ONE windowBounds call site',
    (tab.match(/windowBounds\(/g) ?? []).length === 1,
    'one window, one derivation');
  check('WIRING: the empty state can say which blank it is',
    tab.includes("t('compare_events_scope_not_in_baseline')")
      && tab.includes("t('compare_no_data_for_selected_filters')"),
    'both sentences must remain reachable — the new one is not a replacement');
  check('WIRING: the discrimination uses the shared predicate',
    (tab.match(/selectionUncoveredByBaseline\(/g) ?? []).length === 1,
    'a re-derivation here would be a vocabulary about a vocabulary');

  // THE DIAGNOSIS EXONERATED THE MATCHING. This pins that this session did not
  // "fix" it anyway — measured as correct on four real saves, so a change here
  // would be fixing what is not broken.
  check('UNTOUCHED: computeScenarioForFilter still filters on the same columns',
    helper.includes("if (vprodL1 && r.Product !== vprodL1) return false;")
      && helper.includes("if (vchanL1 && r.Channel !== vchanL1) return false;")
      && helper.includes("if (vseg !== 'All' && r.Segment !== vseg) return false;"),
    'the 2026-08-20 diagnosis measured this correct — 360 rows, 24 months');
  check('UNTOUCHED: and still bails on a genuinely empty match',
    helper.includes('if (!matchingBaseline.length) return [];'));

  const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'];
  const missing = LOCALES.filter(l =>
    typeof JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'))['compare_events_scope_not_in_baseline'] !== 'string');
  check('i18n: the new message exists in all six locales', missing.length === 0, missing.join(', '));
}

console.log(`\ncompare-window spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
