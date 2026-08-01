/**
 * Spec for percentage market events.
 *
 *   npm run spec:pct
 *
 * Grows one section per build step. Step 1 covers sequence allocation only —
 * the field exists and every construction site fills it, but nothing reads it
 * yet.
 */
import { nextSequence, backfillSequences, bySequence, type MarketEvent } from '../src/utils/forecasting';

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

console.log(`percentage-events spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
