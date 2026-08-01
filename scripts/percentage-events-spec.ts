/**
 * Spec for percentage market events.
 *
 *   npm run spec:pct
 *
 * Grows one section per build step.
 *   Step 1 — sequence allocation: the field exists and every construction site
 *            fills it.
 *   Step 2 — slot preservation across campaign bulk edit.
 */
import { nextSequence, backfillSequences, bySequence, resequenceRebuild, type MarketEvent } from '../src/utils/forecasting';

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

console.log(`percentage-events spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
