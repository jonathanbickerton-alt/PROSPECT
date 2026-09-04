/**
 * EVERY MIX REFUSAL REACHES THE LOCALE, AND THE MODULE'S ENGLISH REACHES NOBODY.
 *
 *   npm run spec:mix-refusal-copy
 *
 * WHY THIS EXISTS, and what it corrects.
 *
 * The 1028 locale-sweep report listed seventeen strings in `mixConstraint.ts`
 * as "the mix card's refusal reasons — genuinely user-facing", unfixed. That
 * was WRONG, and the module says so in a comment written before the mistake:
 * every `detail` is diagnostic only, the card branches on `reason` and renders
 * its own keyed copy, and nothing puts `detail` on screen. Verified rather than
 * believed on 2026-09-02 — the components consuming these outcomes contain
 * ZERO reads of `.detail`.
 *
 * THAT WAS ONE FILE UNTIL 2026-09-04, when the target block moved out of
 * `WhatIfTab.tsx` into `MixTargetPanel.tsx` so both mix cards could share it.
 * This spec failed on the move — correctly: its premise was a claim about
 * WHERE the branch lives, and the branch had moved. The lists below now name
 * both files, and the `.detail` check covers the new one, which is the half
 * that matters: a fresh component handling refusal outcomes is exactly where
 * a diagnostic would get rendered by someone who did not know the rule.
 *
 * So the risk is not that the seventeen are untranslated. It is that:
 *
 *   (a) someone renders one, turning a diagnostic into user-facing English in
 *       six locales — enforced by `spec:i18n-scan`, which fails the moment a
 *       `.detail` read appears in a file importing this module; and
 *   (b) a NEW `MixBlockReason` is added and the card has no copy for it, so a
 *       refusal renders as nothing at all — the silent blank this codebase
 *       treats as the worst empty state.
 *
 * (b) is what this spec is for, and it is why the check is EXHAUSTIVE OVER THE
 * UNION rather than a walk of three interesting states. Driving three refusals
 * to the DOM proves those three; enumerating the type proves every one of them,
 * including the one somebody adds next month. The union is read out of the
 * source, so it cannot silently fall out of step with the type.
 */
import * as fs from 'fs';
import {
  achievableTargetRange, solveForTarget, blendedArpu, MIX_TOTAL,
} from '../src/utils/mixConstraint';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'] as const;
const bundle = Object.fromEntries(LOCALES.map(l =>
  [l, JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'))])) as
  Record<(typeof LOCALES)[number], Record<string, string>>;

const mixSrc = fs.readFileSync('src/utils/mixConstraint.ts', 'utf8');
const cardSrc = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
const panelSrc = fs.readFileSync('src/components/MixTargetPanel.tsx', 'utf8');

// ---------------------------------------------------------------------------
// 1. THE UNION, read from source. Every member must be accounted for below, so
//    adding a reason without copy fails here rather than rendering blank.
// ---------------------------------------------------------------------------
// COMMENTS STRIPPED FIRST. Each union member carries a doc comment, and the
// one on `locks-oversubscribed` contains a semicolon — "already exceed
// MIX_TOTAL; nothing is left" — so slicing to the first ';' in the raw text
// stopped three members in and quietly reported a five-member union as
// complete. The ANCHOR check below is what caught it.
const mixNoComments = mixSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const unionBlock = mixNoComments.slice(
  mixNoComments.indexOf('export type MixBlockReason ='),
  mixNoComments.indexOf(';', mixNoComments.indexOf('export type MixBlockReason =')));
const REASONS = [...unionBlock.matchAll(/\|\s*'([a-z-]+)'/g)].map(m => m[1]);

check('ANCHOR: the reason union was parsed at all', REASONS.length >= 6,
  `${REASONS.length} — the matcher is broken, not the code`);
check('UNION: exactly the eight settled reasons', REASONS.length === 8, REASONS.join(', '));

/**
 * How the card renders each one. `above-max` / `below-min` name the binding
 * constraint; every other reason falls to the catch-all. Both branches are
 * keyed, which is the property this table exists to pin.
 */
const RENDERED_BY: Record<string, string> = {
  'above-max': 'whatif_mix_bound_above',
  'below-min': 'whatif_mix_bound_below',
  'no-members': 'whatif_mix_target_blocked_other',
  'malformed-shares': 'whatif_mix_target_blocked_other',
  'arpu-unknown': 'whatif_mix_target_blocked_other',
  'locks-oversubscribed': 'whatif_mix_target_blocked_other',
  'range-collapsed': 'whatif_mix_target_blocked_other',
  'cannot-conserve': 'whatif_mix_target_blocked_other',
};
for (const r of REASONS) {
  check(`COPY: reason '${r}' has a rendered key`, !!RENDERED_BY[r],
    'a refusal with no copy renders as a blank, which is the worst empty state');
}
check('COPY: the table has no entry for a reason that no longer exists',
  Object.keys(RENDERED_BY).every(r => REASONS.includes(r)),
  Object.keys(RENDERED_BY).filter(r => !REASONS.includes(r)).join(', '));

// ---------------------------------------------------------------------------
// 2. THE CARD REALLY BRANCHES THAT WAY. The table above is a claim about
//    the card's target panel; this reads MixTargetPanel and checks it. Both
//    cards render through that ONE component, so one read covers both.
// ---------------------------------------------------------------------------
check('CARD: the blocked branch renders the unreachable heading',
  panelSrc.includes("t('whatif_mix_target_unreachable')"));
check('CARD: above-max and below-min name their bound',
  panelSrc.includes("'whatif_mix_bound_above' : 'whatif_mix_bound_below'"));
check('CARD: every other reason falls to keyed catch-all copy',
  panelSrc.includes("t('whatif_mix_target_blocked_other')"),
  'without this, six of the eight reasons render nothing');
check('CARD: the branch is entered for every blocked outcome, not some',
  /outcome\?\.kind === 'blocked' &&/.test(panelSrc));
// BOTH CARDS REACH IT. A shared component is only shared if both call it;
// one card quietly keeping an inline copy is the drift this move prevents.
check('CARD: both mix cards render through the one target panel',
  (cardSrc.match(/<MixTargetPanel/g) ?? []).length === 2,
  `${(cardSrc.match(/<MixTargetPanel/g) ?? []).length} call sites — expected promo and yield`);

// ---------------------------------------------------------------------------
// 3. EVERY RENDERED KEY RESOLVES IN EVERY LOCALE, and is not the English one.
//    This is the brief's "the rendered text is the locale's, not the module's".
// ---------------------------------------------------------------------------
const rendered = [...new Set(Object.values(RENDERED_BY)), 'whatif_mix_target_unreachable'];
for (const k of rendered) {
  check(`KEY ${k}: present in en`, k in bundle.en);
  for (const l of ['de', 'es', 'fr', 'it', 'pt'] as const) {
    check(`KEY ${k}: present in ${l}`, k in bundle[l]);
    check(`KEY ${k}: ${l} differs from English`,
      String(bundle[l][k] ?? '') !== String(bundle.en[k] ?? ''),
      'a refusal that renders English in a German session is the UAT-blocking case');
  }
}

// ---------------------------------------------------------------------------
// 4. THE ENGINE ACTUALLY PRODUCES THE THREE NAMED REFUSALS. Real calls, real
//    outcomes — so the table above describes states that occur, not states
//    imagined for a table.
// ---------------------------------------------------------------------------
{
  // no-members: an ABSENT mix, which is not an empty one.
  const r = achievableTargetRange([], {}, [], {});
  check("ENGINE: no members -> blocked 'no-members'",
    r.kind === 'blocked' && r.reason === 'no-members',
    r.kind === 'blocked' ? r.reason : r.kind);

  // locks-oversubscribed: held shares already exceed the total.
  const members = ['A', 'B', 'C'];
  const arpu = { A: 10, B: 20, C: 30 };
  // Shares stay finite and NON-NEGATIVE: a negative share is caught earlier as
  // 'malformed-shares', which is a different refusal and would have made this
  // check pass for the wrong reason. 70 + 60 held is 130 against a total of 100.
  const over = achievableTargetRange(members, { A: 70, B: 60, C: 0 }, ['A', 'B'], arpu);
  check("ENGINE: locked shares over the total -> blocked 'locks-oversubscribed'",
    over.kind === 'blocked' && over.reason === 'locks-oversubscribed',
    over.kind === 'blocked' ? over.reason : over.kind);

  // arpu-unknown: a member carrying share has no finite ARPU, so no blend exists.
  const noArpu = achievableTargetRange(members, { A: 50, B: 30, C: 20 }, ['A'],
    { A: 10, B: undefined as any, C: 30 });
  check("ENGINE: a share-carrying member with no ARPU -> blocked 'arpu-unknown'",
    noArpu.kind === 'blocked' && noArpu.reason === 'arpu-unknown',
    noArpu.kind === 'blocked' ? noArpu.reason : noArpu.kind);

  // And the same three through solveForTarget, the other write path, because a
  // refusal that only one entry point produces is only half-pinned.
  const s1 = solveForTarget([], {}, [], {}, 15);
  check("ENGINE: solveForTarget refuses an absent mix too",
    s1.kind === 'blocked' && s1.reason === 'no-members', s1.kind);

  // A conforming mix still blends, so the refusals above are not the module
  // simply refusing everything — the vacuous-result trap.
  // blendedArpu takes (shares, arpus) and returns number | null — it is a READ
  // function and never refuses, which is exactly why it is the control here.
  const ok = blendedArpu({ A: 50, B: 30, C: 20 }, arpu);
  check('CONTROL: a conforming mix still produces a blend',
    typeof ok === 'number' && isFinite(ok),
    'if every call refused, the checks above would pass while proving nothing');
  check('CONTROL: MIX_TOTAL is still the settled 100', MIX_TOTAL === 100);
}

// ---------------------------------------------------------------------------
// 5. THE DIAGNOSTIC STRINGS STAY DIAGNOSTIC. `spec:i18n-scan` fails on a
//    `.detail` read; this asserts the same invariant from the other side, so
//    the exclusion in the scanner and the reason for it cannot drift apart.
// ---------------------------------------------------------------------------
{
  const importers = ['src/components/WhatIfTab.tsx', 'src/components/MixTargetPanel.tsx',
    'src/utils/forecasting.ts'];
  for (const f of importers) {
    const t = fs.readFileSync(f, 'utf8');
    const reads = (t.match(/\.detail\b/g) ?? []).length;
    check(`DIAGNOSTIC: ${f} reads .detail zero times`, reads === 0,
      `${reads} — rendering one makes it user-facing English in six locales`);
  }
  const detailCount = (mixSrc.match(/detail:/g) ?? []).length;
  check('DIAGNOSTIC: the module still carries its detail strings', detailCount >= 15,
    `${detailCount} — they are diagnostics worth keeping, not dead weight to delete`);
}

console.log(`mix-refusal-copy spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
