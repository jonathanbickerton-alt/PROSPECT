/**
 * R7 — THE AMOUNT CONTROL IS ONE EXCLUSIVE TRI-STATE.
 *
 *   npm run spec:amount-control
 *
 * Every defect Jon's walk found on 2026-08-20 was a TRANSITION: flipping IBRO
 * type, switching arms, leaving a mode with a half-filled draft. Each half of
 * the shipped code was individually correct and no source reading caught them,
 * which is exactly what the R7 report's limits section said it could not cover.
 *
 * A transition is a function from (state, action) to state, so it can be
 * checked EXHAUSTIVELY here — every arm from every arm, every scenario from
 * every control — rather than sampled.
 *
 * WHAT IT IS CAREFUL ABOUT:
 *
 *  - THE BOTH-LIT STATE IS ASSERTED UNREPRESENTABLE, not merely unstyled. The
 *    shipped bug was two sources of truth agreeing to disagree; a check that
 *    only looked at CSS would have passed on it.
 *  - THE EXHAUSTIVE SWEEP asserts the postcondition over every combination,
 *    because the cases below are the ones I thought of.
 *  - A SINGLE MONTH IS A RAMP OF LENGTH 1, with the literal shown — a special
 *    case would be a second arithmetic for the same statement.
 */
import fs from 'fs';
import {
  nextAmountControlState, effectiveAmountControl, churnAvailableFor,
  type AmountControl,
} from '../src/utils/amountControl';
import { foldChurnRamp, linearChurnRamp } from '../src/utils/churnFold';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

const ARMS: AmountControl[] = ['subs', 'pct', 'churn'];
const SCENARIOS = ['Inflow', 'Outflow', 'Retention', 'ARPU', undefined];

// ═══════════════════════════════════════════════════════════════════════════
// 1. EXACTLY ONE ARM IS LIT, ALWAYS — the walk's defect (b)
// ═══════════════════════════════════════════════════════════════════════════
{
  // THE SHIPPED BUG, NAMED. Subs was lit from `amountType` and Churn from a
  // separate boolean; a churn draft stores amountType 'absolute', so both lit.
  // The derived value cannot express that: it returns ONE arm.
  let violations = 0; let firstBad = '';
  for (const stored of ARMS) for (const sc of SCENARIOS) {
    const lit = effectiveAmountControl(stored, sc);
    if (!ARMS.includes(lit)) { violations++; firstBad ||= `${stored}/${sc} -> ${lit}`; }
  }
  check('EXCLUSIVE: the derived control is always exactly one arm',
    violations === 0, firstBad);

  check('EXCLUSIVE: a churn draft does NOT also light Subs',
    effectiveAmountControl('churn', 'Outflow') !== 'subs',
    'the shipped card lit both, because amountType is absolute for churn');

  // The both-lit state is unrepresentable in the TYPE, which is the point: a
  // single value cannot equal two things. Asserted by exhaustion over what the
  // card renders from.
  for (const sc of SCENARIOS) for (const stored of ARMS) {
    const lit = effectiveAmountControl(stored, sc);
    const flags = [lit === 'subs', lit === 'pct', lit === 'churn'].filter(Boolean).length;
    check(`EXCLUSIVE: ${stored} on ${String(sc)} lights exactly one arm`, flags === 1, `${flags} lit`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. CHURN IS NEVER LIT OFF OUTFLOW — the walk's defect (a)
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const sc of SCENARIOS) {
    const lit = effectiveAmountControl('churn', sc);
    if (sc === 'Outflow') {
      check('OUTFLOW: churn stays lit on an Outflow draft', lit === 'churn', lit);
    } else {
      check(`OUTFLOW: churn is NOT lit on ${String(sc)}`, lit === 'subs',
        `${lit} — the panel keyed on the stored flag alone and leaked`);
    }
  }
  check('OUTFLOW: churn is only available for Outflow',
    churnAvailableFor('Outflow') && !churnAvailableFor('Inflow')
      && !churnAvailableFor('Retention') && !churnAvailableFor(undefined));
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. LEAVING OUTFLOW — the walk's defect (c): a DEFINED default
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const sc of ['Inflow', 'Retention', 'ARPU']) {
    const t = nextAmountControlState('churn', { kind: 'scenario', scenario: sc }, 'Outflow');
    check(`LEAVE/${sc}: the control defaults to SUBS, never to nothing`,
      t.control === 'subs', t.control);
    check(`LEAVE/${sc}: amountType returns to absolute`, t.amountType === 'absolute');
    check(`LEAVE/${sc}: the churn draft is CLEARED`,
      t.clearChurnDraft === true,
      'a reduction stated against an Outflow rate means nothing on an Inflow event');
    check(`LEAVE/${sc}: and the stale amount goes with it`, t.clearAmount === true);
  }

  // A scenario change that does NOT leave churn's domain changes nothing.
  const stay = nextAmountControlState('churn', { kind: 'scenario', scenario: 'Outflow' }, 'Outflow');
  check('LEAVE: staying on Outflow leaves churn selected',
    stay.control === 'churn' && stay.clearChurnDraft === false);

  // A scenario change while on an ORDINARY arm must not disturb it: switching
  // Inflow to Retention has no bearing on subs-versus-percentage.
  for (const arm of ['subs', 'pct'] as AmountControl[]) {
    const t = nextAmountControlState(arm, { kind: 'scenario', scenario: 'Retention' }, 'Inflow');
    check(`LEAVE: a scenario change leaves the ${arm} arm alone`,
      t.control === arm && t.clearChurnDraft === false && t.clearAmount === false,
      'resetting here would discard a choice for no reason');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. EVERY ARM FROM EVERY ARM — exhaustive
// ═══════════════════════════════════════════════════════════════════════════
{
  for (const from of ARMS) for (const to of ARMS) {
    const t = nextAmountControlState(from, { kind: 'select', arm: to }, 'Outflow');
    check(`SELECT ${from}->${to}: lands on exactly the arm clicked`,
      t.control === to, t.control);
    check(`SELECT ${from}->${to}: amountType matches the arm`,
      t.amountType === (to === 'pct' ? 'percentage' : 'absolute'), t.amountType);
    if (from === 'churn' && to !== 'churn') {
      check(`SELECT ${from}->${to}: leaving churn CLEARS its draft`, t.clearChurnDraft === true);
    }
    if (from !== 'churn') {
      check(`SELECT ${from}->${to}: entering does not clear a churn draft that was never set`,
        t.clearChurnDraft === false);
    }
  }

  // RE-SELECTING THE LIT ARM IS A NO-OP. Clicking Subs twice must not wipe a
  // figure the user is halfway through typing.
  for (const arm of ARMS) {
    const t = nextAmountControlState(arm, { kind: 'select', arm }, 'Outflow');
    check(`SELECT ${arm}->${arm}: re-selecting is a no-op, not a reset`,
      t.clearAmount === false && t.clearChurnDraft === false,
      'a second click must not discard a half-typed number');
  }

  // Switching between DIFFERENT arms always clears the amount: the number
  // means something different under each.
  check('SELECT: switching arms always clears the amount',
    ARMS.every(f => ARMS.filter(x => x !== f).every(to =>
      nextAmountControlState(f, { kind: 'select', arm: to }, 'Outflow').clearAmount)),
    '5000 subscribers must not become 5000 per cent');

  // THE SPREAD. Both % and churn replace it rather than configuring it.
  check('SELECT: choosing % force-clears the spread',
    nextAmountControlState('subs', { kind: 'select', arm: 'pct' }, 'Outflow').clearSpread === true);
  check('SELECT: choosing churn force-clears the spread',
    nextAmountControlState('subs', { kind: 'select', arm: 'churn' }, 'Outflow').clearSpread === true,
    'churn replaces the spread with its own ramp radio');
  check('SELECT: choosing Subs does not touch the spread',
    nextAmountControlState('pct', { kind: 'select', arm: 'subs' }, 'Outflow').clearSpread === false,
    'the spread belongs to absolute volumes');

  // Selecting churn where it is not offered cannot produce a churn control.
  const refused = nextAmountControlState('subs', { kind: 'select', arm: 'churn' }, 'Inflow');
  check('SELECT: churn cannot be selected off Outflow',
    refused.control !== 'churn', refused.control);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. THE POSTCONDITION SWEEP — the cases above are the ones I thought of
// ═══════════════════════════════════════════════════════════════════════════
{
  let violations = 0, checked = 0; let firstBad = '';
  for (const from of ARMS) for (const sc of SCENARIOS) {
    for (const to of ARMS) {
      checked++;
      const t = nextAmountControlState(from, { kind: 'select', arm: to }, sc);
      const ok = ARMS.includes(t.control)
        && (t.control !== 'churn' || churnAvailableFor(sc))
        && t.amountType === (t.control === 'pct' ? 'percentage' : 'absolute');
      if (!ok) { violations++; firstBad ||= `select ${from}->${to} on ${String(sc)} -> ${JSON.stringify(t)}`; }
    }
    for (const next of SCENARIOS) {
      checked++;
      const t = nextAmountControlState(from, { kind: 'scenario', scenario: next }, sc);
      const ok = ARMS.includes(t.control)
        && (t.control !== 'churn' || churnAvailableFor(next))
        && t.amountType === (t.control === 'pct' ? 'percentage' : 'absolute');
      if (!ok) { violations++; firstBad ||= `scenario ${from} ${String(sc)}->${String(next)} -> ${JSON.stringify(t)}`; }
    }
  }
  check(`POSTCONDITION: one valid arm, amountType agreeing, across all ${checked} transitions`,
    violations === 0, `${violations}; first: ${firstBad}`);

  // NEGATIVE CONTROL. The sweep must be able to fail — the shipped model is
  // replicated (two independent flags) and asserted to violate it.
  const shippedLit = (amountType: string, churnFlag: boolean) =>
    [amountType === 'absolute' ? 'subs' : 'pct', ...(churnFlag ? ['churn'] : [])];
  check('NEGATIVE CONTROL: the SHIPPED two-flag model does light two arms',
    shippedLit('absolute', true).length === 2,
    'if this were 1 the sweep above could not have caught the reported defect');
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. A SINGLE MONTH IS A RAMP OF LENGTH 1 — decision 3
// ═══════════════════════════════════════════════════════════════════════════
{
  const SERIES = ['2026-07', '2026-08', '2026-09'].map(month => ({ month, outflow: 20, inflow: 0 }));
  const single = foldChurnRamp({
    series: SERIES, startIndex: 1, statedReductions: [3],
    prevBaseAtStart: 980, seedBaseKnown: true,
  });
  const ramp = foldChurnRamp({
    series: SERIES, startIndex: 1, statedReductions: linearChurnRamp(3, 1),
    prevBaseAtStart: 980, seedBaseKnown: true,
  });
  // delta = stated/1200 * prevBase = 3/1200 * 980 = 2.45
  check('SINGLE MONTH: the unchecked-ramp path gives delta 2.45',
    near(single[0].delta, 2.45), `${single[0].delta}`);
  check('SINGLE MONTH: and is IDENTICAL to a one-month ramp',
    single.length === ramp.length && near(single[0].delta, ramp[0].delta)
      && near(single[0].prevBase, ramp[0].prevBase),
    'a special case would be a second arithmetic for the same statement');
  check('SINGLE MONTH: linearChurnRamp(target, 1) is just the target',
    linearChurnRamp(3, 1).join(',') === '3');
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. WIRING — declared source-level, comments stripped
// ═══════════════════════════════════════════════════════════════════════════
{
  const raw = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
  const tab = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  check('WIRING: the lit arm reads the ONE derived control, not amountType',
    /amountControl === \(mode === 'percentage' \? 'pct' : 'subs'\)/.test(tab)
      && !/\(newEvent\.amountType \?\? 'absolute'\) === mode/.test(tab),
    'reading amountType here is what lit Subs beside Churn');
  check('WIRING: exactly ONE writer for the control',
    (tab.match(/nextAmountControlState\(/g) ?? []).length === 1,
    'a second writer is a second place for the arms to disagree');
  check('WIRING: every arm click goes through it',
    (tab.match(/applyAmountControl\(\{ kind: 'select'/g) ?? []).length === 2,
    'the Subs/% map counts once, the churn arm once');
  check('WIRING: the derived control gates the panel',
    /const isChurnDraft = amountControl === 'churn';/.test(tab),
    'the panel keyed on a stored flag alone and leaked onto Inflow');
  check('WIRING: leaving Outflow is handled by an effect on scenario',
    /storedAmountControl === 'churn' && !churnAvailableFor\(newEvent\.scenario\)/.test(tab));
  // ONE declaration, FIVE call sites — both exact.
  //
  // The call count was `>= 2` until 2026-09-01. A floor cannot see a call site
  // removed once anything else has been added, which is precisely how
  // guard-trap 77 was MISSED the day before: its spec asserted `>= 4` call
  // sites, an unrelated change added two, and deleting one still cleared the
  // floor. Exact counts, never `>=`.
  //
  // The five: the amount-control writer's `next.clearChurnDraft` branch, the
  // churn add emitter, the churn edit-save, the campaign churn save, and the
  // campaign save's reset.
  check('WIRING: the churn draft clears in ONE place, called from five',
    (tab.match(/const clearChurnDraft = useCallback\(/g) ?? []).length === 1
      && (tab.match(/clearChurnDraft\(\);/g) ?? []).length === 5,
    `${(tab.match(/clearChurnDraft\(\);/g) ?? []).length} call sites, expected 5`);

  check('WIRING: the ramp is opt-in and defaults OFF',
    /useState\(false\);/.test(tab) && /data-testid="churn-ramp-toggle"/.test(raw)
      && /const \[churnRampOn, setChurnRampOn\] = useState\(false\)/.test(tab));
  check('WIRING: unchecked states a single month through the same fold',
    /churnRampOn \? churnStated\.slice\(0, churnMonths\) : \[churnTargetPct\]/.test(tab),
    'one fold, one arithmetic');
  check('WIRING: the months control and grid render only when ramping',
    /\{churnRampOn && \(/.test(tab));

  check('BREAKDOWN: it renders beside the figure',
    /data-testid="churn-breakdown"/.test(raw));
  check('BREAKDOWN: from the FOLD\'s own output, not a re-derivation',
    /churnFold\[0\]\.prevBase/.test(tab) && /churnFold\[0\]\.targetOutflow \+ churnFold\[0\]\.delta/.test(tab),
    'one series, one place — the line and the figure cannot disagree');
  check('BREAKDOWN: absent when the figure is absent',
    /\{churnFold\[0\] && !churnFold\[0\]\.absence && \(/.test(tab),
    'no rate means no inputs to show; the reason line already says why');

  const LOC = ['en', 'de', 'es', 'fr', 'it', 'pt'];
  const missing: string[] = [];
  for (const l of LOC) {
    const d = JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'));
    for (const k of ['whatif_churn_ramp', 'whatif_churn_breakdown']) {
      if (typeof d[k] !== 'string') missing.push(`${l}/${k}`);
    }
  }
  check('i18n: the ramp and breakdown copy in all six locales', missing.length === 0, missing.join(', '));
  const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
  check('i18n: the breakdown names all three inputs',
    ['{{month}}', '{{outflow}}', '{{base}}'].every(p => en['whatif_churn_breakdown'].includes(p))
      && en['whatif_churn_breakdown'].includes('12'),
    en['whatif_churn_breakdown']);
}

console.log(`\namount-control spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
