/**
 * Spec for pro-rata distribution and leaf weighting.
 *
 *   npm run spec:prorata
 *
 * Two things are under test:
 *
 *   1. The zero-total fallback now distinguishes "populated but zero" from
 *      "never populated". A bare volume of 0 cannot tell those apart, which is
 *      why ProRataLeaf carries hasMetricData. Getting this wrong in either
 *      direction is a silent defect: zero-for-everything discards an event a
 *      user deliberately targeted at a brand-new cohort, and even-split hands
 *      volume to an established cohort that churned nobody.
 *
 *   2. Rate events never construct a leaves array, so no change to leaf
 *      weighting can route one through pro-rata distribution. That was
 *      confirmed structurally during mapping; it is asserted here so a future
 *      change cannot quietly break it.
 */
import * as fs from 'fs';
import * as path from 'path';
import { distributeProRata, eventProRataShare, type ProRataLeaf } from '../src/utils/forecasting';

let pass = 0; const fails: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++; else fails.push(`${name}${detail ? ' — ' + detail : ''}`);
};
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

// ── distributeProRata: the ordinary case ─────────────────────────────────
{
  const out = distributeProRata(100, [30, 70]);
  check('proportional split', close(out[0], 30) && close(out[1], 70), JSON.stringify(out));
  check('parts sum EXACTLY to the amount', close(sum(out), 100));
}
{
  // Residual absorption: thirds cannot be represented exactly.
  const out = distributeProRata(100, [1, 1, 1]);
  check('residual absorbed so thirds still sum exactly', close(sum(out), 100), String(sum(out)));
}

// ── the two zero cases, and WHY each fires ───────────────────────────────
{
  // Never populated: no leaf has data. Even split — the event must not vanish.
  const out = distributeProRata(90, [0, 0, 0], [false, false, false]);
  check('never populated → even split (event not discarded)',
    close(out[0], 30) && close(out[1], 30) && close(out[2], 30), JSON.stringify(out));
  check('never populated → still sums to the amount', close(sum(out), 90));
}
{
  // Populated but zero: every leaf HAS data for this metric, it is just zero.
  const out = distributeProRata(90, [0, 0, 0], [true, true, true]);
  check('populated but zero → every leaf gets zero',
    out.every(v => close(v, 0)), JSON.stringify(out));
}
{
  // Mixed: some leaves populated, some not, all zero. The event must not vanish,
  // because at least one target has genuinely never been populated.
  const out = distributeProRata(90, [0, 0, 0], [true, false, true]);
  check('mixed populated/never → even split, not zero',
    !out.every(v => close(v, 0)) && close(sum(out), 90), JSON.stringify(out));
}
{
  // The flag must not override a real distribution — it only governs total <= 0.
  const out = distributeProRata(100, [30, 70], [true, true]);
  check('hasData is ignored when the total is positive',
    close(out[0], 30) && close(out[1], 70), JSON.stringify(out));
}
{
  // Omitting the flag entirely must preserve the pre-2026-08-01 behaviour.
  const out = distributeProRata(90, [0, 0, 0]);
  check('flag omitted → even split (old behaviour preserved)',
    close(out[0], 30), JSON.stringify(out));
}

// ── eventProRataShare must not silently flip behaviour for old callers ───
{
  const mk = (segment: string, volume: number, hasMetricData?: boolean): ProRataLeaf =>
    ({ segment, product: 'P', channel: 'C', volume, ...(hasMetricData === undefined ? {} : { hasMetricData }) });
  const event = { segment: 'All', product: 'P', channel: 'C' };

  // Leaves with NO flag at all: must take the even-split path, not the zero path.
  const unflagged = [mk('A', 0), mk('B', 0)];
  const shareUnflagged = eventProRataShare(event, { segment: 'A', product: 'P', channel: 'C' }, unflagged);
  check('unflagged leaves keep the even split (no silent behaviour change)',
    close(shareUnflagged, 0.5), String(shareUnflagged));

  // Same leaves, explicitly populated-but-zero: share must be 0.
  const flagged = [mk('A', 0, true), mk('B', 0, true)];
  const shareFlagged = eventProRataShare(event, { segment: 'A', product: 'P', channel: 'C' }, flagged);
  check('populated-but-zero leaves give share 0',
    close(shareFlagged, 0), String(shareFlagged));

  // Explicitly never-populated: even split.
  const never = [mk('A', 0, false), mk('B', 0, false)];
  const shareNever = eventProRataShare(event, { segment: 'A', product: 'P', channel: 'C' }, never);
  check('never-populated leaves give the even split',
    close(shareNever, 0.5), String(shareNever));

  // Shares across all leaves of a target must still sum to exactly 1.
  const real = [mk('A', 300, true), mk('B', 700, true)];
  const sA = eventProRataShare(event, { segment: 'A', product: 'P', channel: 'C' }, real);
  const sB = eventProRataShare(event, { segment: 'B', product: 'P', channel: 'C' }, real);
  check('shares over a target sum to exactly 1', close(sA + sB, 1), `${sA} + ${sB}`);
  check('shares are proportional to leaf volume', close(sA, 0.3) && close(sB, 0.7));
}

// ── rate events never construct a leaves array ───────────────────────────
// Structural assertion. Each rate site applies its delta directly; none builds
// leaves or calls eventProRataShare. If a future change routes one through the
// volume path this fails, which is the point.
{
  const read = (p: string) => fs.readFileSync(path.join('src', p), 'utf8');
  const wht = read(path.join('components', 'WhatIfTab.tsx'));
  const sch = read(path.join('utils', 'scenarioHelper.ts'));

  // Every eventProRataShare/eventShare call site must be a volume scenario.
  const rateWords = /ARPU|Yield|Pricing/;
  const callLines = [...wht.split('\n'), ...sch.split('\n')]
    .filter(l => /eventShare\(|eventProRataShare\(/.test(l) && !/^\s*(\/\/|\*)/.test(l));
  check('at least one pro-rata call site exists to check', callLines.length > 0,
    `${callLines.length} call sites`);
  const rateCalls = callLines.filter(l => rateWords.test(l));
  check('no pro-rata call site mentions a rate metric', rateCalls.length === 0,
    rateCalls.join(' | '));

  // forecasting.ts must NOT carry a RATE-event comment — EXPECTED.md claimed it
  // did until 2026-08-01 and grep found none.
  check('forecasting.ts carries no RATE-event matcher',
    !/RATE event/i.test(read(path.join('utils', 'forecasting.ts'))));
}

console.log(`pro-rata spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
