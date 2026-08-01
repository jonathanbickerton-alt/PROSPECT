/**
 * Spec for percentage market events.
 *
 *   npm run spec:pct
 *
 * Grows one section per build step.
 *   Step 1 — sequence allocation: the field exists and every construction site
 *            fills it.
 *   Step 2 — slot preservation across campaign bulk edit.
 *   Step 3 — the two-phase applier and the coverage fraction.
 */
import {
  nextSequence, backfillSequences, bySequence, resequenceRebuild,
  applyEventsToMonth, eventCoverage, eventProRataShare,
  type MarketEvent, type MonthMetrics, type EventApplication,
} from '../src/utils/forecasting';

let pass = 0; const fails: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++; else fails.push(`${name}${detail ? ' — ' + detail : ''}`);
};

/** A minimal event; only the fields under test carry meaning. */
const ev = (id: string, sequence?: number, date = '2026-01'): MarketEvent => ({
  id, scenario: 'Inflow', segment: 'All', product: 'All', channel: 'All',
  date, subscriberVolume: 100, customerVolume: 0, revenue: 0, arpu: 0,
  campaignName: '', comment: '', contractLength: 24,
  ...(sequence === undefined ? {} : { sequence }),
} as MarketEvent);

// ── nextSequence ─────────────────────────────────────────────────────────
{
  check('empty list starts at 1', nextSequence([]) === 1, String(nextSequence([])));
  check('takes the highest, not the length',
    nextSequence([ev('a', 1), ev('b', 9), ev('c', 2)]) === 10,
    String(nextSequence([ev('a', 1), ev('b', 9), ev('c', 2)])));

  // A gap must not be reused: reusing 2 here would collide with a row the user
  // deleted and could still restore from an export.
  check('gaps are not backfilled by nextSequence',
    nextSequence([ev('a', 1), ev('d', 4)]) === 5);

  check('unsequenced events do not drag the max down',
    nextSequence([ev('a', 7), ev('b')]) === 8);
}

// ── backfillSequences: the legacy-import path ────────────────────────────
{
  // A session exported before the field existed: none carry a sequence, so
  // sheet order IS the order, and it must be preserved exactly.
  const legacy = [ev('a'), ev('b'), ev('c')];
  const filled = backfillSequences(legacy);
  check('legacy session takes sheet order',
    filled.map(e => e.sequence).join(',') === '1,2,3',
    filled.map(e => e.sequence).join(','));
  check('backfill preserves array order', filled.map(e => e.id).join(',') === 'a,b,c');

  // Partially migrated — hand-edited sheet, or two exports merged. Rows that
  // already have a slot must keep it; renumbering them would silently reorder
  // events the user arranged.
  const mixed = [ev('a', 5), ev('b'), ev('c', 2)];
  const out = backfillSequences(mixed);
  check('existing sequences survive a partial backfill',
    out[0].sequence === 5 && out[2].sequence === 2,
    JSON.stringify(out.map(e => e.sequence)));
  check('the unsequenced row is appended, not inserted',
    out[1].sequence === 6, String(out[1].sequence));

  // Non-destructive: a fully-sequenced list must come back untouched.
  const done = [ev('a', 3), ev('b', 1)];
  const same = backfillSequences(done);
  check('a fully sequenced list is unchanged',
    same[0].sequence === 3 && same[1].sequence === 1);

  // NaN is the realistic corruption — Number('') is 0 but Number('x') is NaN,
  // and NaN sorts unpredictably.
  const bad = [{ ...ev('a'), sequence: NaN } as MarketEvent, ev('b', 2)];
  const fixed = backfillSequences(bad);
  check('NaN is treated as missing, not preserved',
    Number.isFinite(fixed[0].sequence), String(fixed[0].sequence));
}

// ── bySequence: total and stable ─────────────────────────────────────────
{
  const list = [ev('c', 3), ev('a', 1), ev('b', 2)];
  check('sorts by sequence',
    [...list].sort(bySequence).map(e => e.id).join(',') === 'a,b,c');

  // Ties must not depend on input order, or the table flickers between renders.
  const tied = [ev('z', 1, '2026-05'), ev('y', 1, '2026-02')];
  const f = [...tied].sort(bySequence).map(e => e.id).join(',');
  const r = [...tied].reverse().sort(bySequence).map(e => e.id).join(',');
  check('a tie breaks on date, identically from either input order',
    f === 'y,z' && f === r, `${f} vs ${r}`);
}

// ── resequenceRebuild: campaign bulk edit keeps its slots ────────────────
{
  // The scenario the field exists for: a campaign sitting in the middle of the
  // table is edited, and must not jump to the bottom.
  const survivors = [ev('before', 1), ev('after', 5)];
  const replaced = [ev('c1', 2), ev('c2', 3), ev('c3', 4)];
  const rebuilt = [ev('n1'), ev('n2'), ev('n3')];

  const out = resequenceRebuild(rebuilt, replaced, survivors);
  check('rebuild takes the slots the replaced rows held',
    out.map(e => e.sequence).join(',') === '2,3,4',
    out.map(e => e.sequence).join(','));

  // The whole point: sorted display order is unchanged by the edit.
  const after = [...survivors, ...out].sort(bySequence).map(e => e.id).join(',');
  check('table order is preserved across a bulk edit',
    after === 'before,n1,n2,n3,after', after);

  // Prove the check is not vacuous — appending (the old behaviour) would fail it.
  let seq = nextSequence([...survivors, ...replaced]);
  const appended = rebuilt.map(e => ({ ...e, sequence: seq++ }));
  const oldOrder = [...survivors, ...appended].sort(bySequence).map(e => e.id).join(',');
  check('...and appending, the old behaviour, does NOT preserve it',
    oldOrder !== after, oldOrder);
}
{
  // A 3-month spread edited up to 5 months. The first three keep their slots;
  // the extras go after everything, never into a slot they never held.
  const survivors = [ev('x', 9)];
  const replaced = [ev('c1', 2), ev('c2', 3), ev('c3', 4)];
  const out = resequenceRebuild([ev('a'), ev('b'), ev('c'), ev('d'), ev('e')], replaced, survivors);
  check('a longer rebuild reuses slots then allocates fresh ones',
    out.map(e => e.sequence).join(',') === '2,3,4,10,11',
    out.map(e => e.sequence).join(','));
  check('fresh slots clear every pre-edit event, including survivors',
    out[3].sequence! > 9);
}
{
  // Collapsed to a single event: surplus slots are abandoned, not reassigned.
  const replaced = [ev('c1', 2), ev('c2', 3), ev('c3', 4)];
  const out = resequenceRebuild([ev('only')], replaced, [ev('x', 1)]);
  check('a shorter rebuild takes the earliest slot and leaves the rest empty',
    out.length === 1 && out[0].sequence === 2, JSON.stringify(out.map(e => e.sequence)));
}
{
  // Slots are paired in ascending order regardless of how the array was held,
  // so a campaign stored out of order still rebuilds into its own slots.
  const replaced = [ev('c3', 7), ev('c1', 2), ev('c2', 5)];
  const out = resequenceRebuild([ev('a'), ev('b'), ev('c')], replaced, []);
  check('slots are reused in ascending order, not array order',
    out.map(e => e.sequence).join(',') === '2,5,7', out.map(e => e.sequence).join(','));
}
{
  // A legacy campaign whose rows never had slots must not produce NaN.
  const out = resequenceRebuild([ev('a'), ev('b')], [ev('c1'), ev('c2')], [ev('x', 4)]);
  check('a rebuild of unsequenced rows still yields finite slots',
    out.every(e => Number.isFinite(e.sequence)), JSON.stringify(out.map(e => e.sequence)));
  check('...allocated above the surviving events', out[0].sequence === 5 && out[1].sequence === 6,
    out.map(e => e.sequence).join(','));
}

// ── applyEventsToMonth: the two phases ───────────────────────────────────
const BASE: MonthMetrics = { inflow: 1000, outflow: 400, retention: 200, arpu: 25 };
const app = (o: Partial<EventApplication>): EventApplication => ({
  id: o.id ?? 'e', scenario: o.scenario ?? 'Inflow',
  sharedVolume: o.sharedVolume ?? 0, arpuDelta: o.arpuDelta ?? 0,
  amountType: o.amountType, percentageBasis: o.percentageBasis,
  retentionLinked: o.retentionLinked, percentAmount: o.percentAmount,
  coverage: o.coverage,
});

{
  // Absolute behaviour must be exactly what it was before percentages existed.
  const r = applyEventsToMonth(BASE, [
    app({ id: 'i', scenario: 'Inflow', sharedVolume: 100 }),
    app({ id: 'o', scenario: 'Outflow', sharedVolume: -50 }),
    app({ id: 'r', scenario: 'Retention', sharedVolume: 30 }),
    app({ id: 'a', scenario: 'ARPU', arpuDelta: 2 }),
  ]);
  check('absolute inflow adds', r.metrics.inflow === 1100, String(r.metrics.inflow));
  check('absolute outflow keeps its negative-storage convention',
    r.metrics.outflow === 400 + 50 - 30, String(r.metrics.outflow));
  check('absolute retention adds and reduces outflow', r.metrics.retention === 230);
  check('ARPU is a rate and is added directly', r.metrics.arpu === 27);
  check('every event is attributed', r.appliedIds.join(',') === 'i,o,r,a', r.appliedIds.join(','));
}
{
  // Flat, not compounding — the property that makes order irrelevant.
  const two = [
    app({ id: 'a', amountType: 'percentage', percentAmount: 10 }),
    app({ id: 'b', amountType: 'percentage', percentAmount: 10 }),
  ];
  const r = applyEventsToMonth(BASE, two);
  check('two +10% give +20%, not +21%', r.metrics.inflow === 1200, String(r.metrics.inflow));
  check('...and 1210 would be the compounding answer, so the two are distinguishable',
    1000 * 1.1 * 1.1 === 1210);

  // Order-independence is the documented invariant; assert it directly so a
  // future change that introduces coupling fails here rather than in a report.
  const rev = applyEventsToMonth(BASE, [...two].reverse());
  check('reversing the array changes nothing', r.metrics.inflow === rev.metrics.inflow);
}
{
  // The reason the snapshot exists: an absolute event's POSITION must not
  // change what 'adjusted' means.
  const abs = app({ id: 'abs', scenario: 'Inflow', sharedVolume: 500 });
  const pctAdj = app({ id: 'p', amountType: 'percentage', percentageBasis: 'adjusted', percentAmount: 10 });
  const before = applyEventsToMonth(BASE, [abs, pctAdj]).metrics.inflow;
  const after = applyEventsToMonth(BASE, [pctAdj, abs]).metrics.inflow;
  check('adjusted-basis is unaffected by where the absolute event sits',
    before === after, `${before} vs ${after}`);
  check('adjusted-basis reads the post-absolute value',
    before === 1000 + 500 + 0.1 * 1500, String(before));

  const pctBase = app({ id: 'q', amountType: 'percentage', percentageBasis: 'baseline', percentAmount: 10 });
  const baseAns = applyEventsToMonth(BASE, [abs, pctBase]).metrics.inflow;
  check('baseline-basis reads the untouched value',
    baseAns === 1000 + 500 + 0.1 * 1000, String(baseAns));
  check('the two bases genuinely differ (the check is not vacuous)', baseAns !== before);
}
{
  // Coverage scales a percentage; it must not be confused with a share.
  const r = applyEventsToMonth(BASE, [
    app({ amountType: 'percentage', percentAmount: 10, coverage: 0.25 }),
  ]);
  check('coverage scales the percentage effect', r.metrics.inflow === 1000 + 0.1 * 1000 * 0.25,
    String(r.metrics.inflow));
  const dflt = applyEventsToMonth(BASE, [app({ amountType: 'percentage', percentAmount: 10 })]);
  check('absent coverage defaults to 1', dflt.metrics.inflow === 1100, String(dflt.metrics.inflow));
}
{
  // Retention linkage, both amount types.
  const linkedPct = applyEventsToMonth(BASE, [
    app({ scenario: 'Retention', amountType: 'percentage', percentAmount: 50 })]);
  const freePct = applyEventsToMonth(BASE, [
    app({ scenario: 'Retention', amountType: 'percentage', percentAmount: 50, retentionLinked: false })]);
  check('linked percentage retention reduces outflow',
    linkedPct.metrics.outflow === 400 - 100, String(linkedPct.metrics.outflow));
  check('unlinked percentage retention leaves outflow alone',
    freePct.metrics.outflow === 400, String(freePct.metrics.outflow));
  check('both move retention identically',
    linkedPct.metrics.retention === freePct.metrics.retention &&
    linkedPct.metrics.retention === 300, String(linkedPct.metrics.retention));

  const freeAbs = applyEventsToMonth(BASE, [
    app({ scenario: 'Retention', sharedVolume: 30, retentionLinked: false })]);
  check('unlinked applies to absolute retention too', freeAbs.metrics.outflow === 400);
}
{
  // Percentage Outflow runs in its NATURAL direction — +10% means more outflow —
  // unlike absolute Outflow, which is stored negative.
  const r = applyEventsToMonth(BASE, [
    app({ scenario: 'Outflow', amountType: 'percentage', percentAmount: 10 })]);
  check('+10% outflow increases outflow', r.metrics.outflow === 440, String(r.metrics.outflow));
  const neg = applyEventsToMonth(BASE, [
    app({ scenario: 'Outflow', amountType: 'percentage', percentAmount: -10 })]);
  check('-10% outflow decreases it', neg.metrics.outflow === 360, String(neg.metrics.outflow));
}
{
  // The floor clips AND reports. Reporting is the part that is easy to lose.
  const r = applyEventsToMonth(BASE, [
    app({ amountType: 'percentage', percentAmount: -150 })]);
  check('a metric driven negative clips at zero', r.metrics.inflow === 0, String(r.metrics.inflow));
  check('the pre-floor value survives for reporting', r.preFloor.inflow === -500,
    String(r.preFloor.inflow));
  check('the breach names the metric', r.flooredMetrics.join(',') === 'inflow',
    r.flooredMetrics.join(','));

  const clean = applyEventsToMonth(BASE, [app({ amountType: 'percentage', percentAmount: 5 })]);
  check('no breach reports no metric', clean.flooredMetrics.length === 0);
  check('...and preFloor equals the result when nothing floored',
    clean.preFloor.inflow === clean.metrics.inflow);
}
{
  // ARPU takes no percentage: it is a rate, and the input sites bar it. If one
  // ever arrives here it must be inert rather than silently scaling ARPU.
  const r = applyEventsToMonth(BASE, [
    app({ scenario: 'ARPU', amountType: 'percentage', percentAmount: 50, arpuDelta: 0 })]);
  check('a percentage ARPU event changes nothing', r.metrics.arpu === 25, String(r.metrics.arpu));
}

// ── eventCoverage: the sibling that is easy to confuse with the share ────
{
  const leaf = (tariffL1: string, volume: number) => ({
    segment: 'S', product: 'P', productL2: 'All', channel: 'C', channelL2: 'All',
    tariffL1, tariffL2: 'All', volume, hasMetricData: true,
  });
  const leaves = [leaf('A', 300), leaf('B', 700)];
  const view = { segment: 'S', product: 'P', productL2: 'All', channel: 'C',
    channelL2: 'All', tariffL1: 'All', tariffL2: 'All' };

  check('an event covering the whole view has coverage 1',
    eventCoverage(view, view, leaves) === 1);
  check('an event on one leaf covers that leaf\'s fraction of the view',
    eventCoverage({ ...view, tariffL1: 'A' }, view, leaves) === 0.3,
    String(eventCoverage({ ...view, tariffL1: 'A' }, view, leaves)));

  // The distinction that motivates having two functions at all.
  const narrowView = { ...view, tariffL1: 'A' };
  const wideEvent = view;
  check('a view inside the event has coverage 1 but a share below 1',
    eventCoverage(wideEvent, narrowView, leaves) === 1 &&
    eventProRataShare(wideEvent, narrowView, leaves) === 0.3,
    `coverage=${eventCoverage(wideEvent, narrowView, leaves)} share=${eventProRataShare(wideEvent, narrowView, leaves)}`);

  check('a disjoint event covers nothing',
    eventCoverage({ ...view, segment: 'OTHER' }, view, leaves) === 0,
    String(eventCoverage({ ...view, segment: 'OTHER' }, view, leaves)));

  // A brand-new cohort: populated in the hierarchy but zero on this metric. The
  // event must not vanish for want of history — same principle as the zero
  // branch in distributeProRata.
  const zero = [leaf('A', 0), leaf('B', 0)];
  check('a zero-metric view still lets a matching event through',
    eventCoverage(view, view, zero) === 1, String(eventCoverage(view, view, zero)));
  check('...but a non-matching one is still excluded',
    eventCoverage({ ...view, segment: 'OTHER' }, view, zero) === 0);
}

console.log(`percentage-events spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
