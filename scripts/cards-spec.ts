/**
 * Spec for cross-card consistency in the Market Events step.
 *
 *   npm run spec:cards
 *
 * The four cards — Volume, Value, Pricing, Promotion — describe the same
 * concepts and drifted into four names, two grid ladders and two vertical
 * alignments. A planner moving between them re-learned the form each time.
 *
 * These assertions are the MECHANICAL half of the guard: names, order, ladder,
 * alignment, and the differences that are deliberate. The judgement half —
 * whether a NEW control belongs in shared targeting or after it — lives in
 * .claude/agents/ui-consistency.md, because no grep decides that.
 *
 * Every assertion here is mutation-tested, including the negative ones. A
 * negative assertion that cannot fail is the unreachable-guard problem: it
 * reads as protection while providing none.
 */
import * as fs from 'fs';
import * as path from 'path';

let pass = 0; const fails: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++; else fails.push(`${name}${detail ? ' — ' + detail : ''}`);
};

const SRC = path.join('src', 'components', 'WhatIfTab.tsx');
const src = fs.readFileSync(SRC, 'utf8');

/** The four cards, sliced by their own markers so an assertion cannot
 *  accidentally be satisfied by a different card's markup. */
const between = (from: string, to: string) => {
  const a = src.indexOf(from);
  const b = to ? src.indexOf(to, a + 1) : src.length;
  return a < 0 ? '' : src.slice(a, b < 0 ? src.length : b);
};
const volume = between('{/* Add event form */}', '{/* Volume spread section');
const pricing = between('{/* ── PRICING TAB', '{/* Amount + toggles */}');
const cards = { volume, pricing };

check('the volume card region was located', volume.length > 1000, `${volume.length} chars`);

// ── One grid ladder, one alignment ───────────────────────────────────────
{
  // ── The track floor must clear the widest control's intrinsic minimum ──
  //
  // This replaced a uniformity assertion on 2026-08-02. Uniformity was the
  // wrong property: every card used one identical ladder and every card was
  // visibly broken, because the ladder was uniformly WRONG. Six equal
  // minmax(0,1fr) tracks gave each control 139px at the real container width,
  // and a native month input needs 155px — so it clipped, rendering
  // "ugust 2026".
  //
  // Intrinsic minimums measured in Chrome at this font size and padding:
  const INTRINSIC_MIN_PX: Record<string, number> = {
    'month input': 155,          // native <input type="month">, the widest
    'hierarchical trigger': 144, // "Direct — Call Centr…" at max truncation
    'native select': 100,
  };
  const WIDEST = Math.max(...Object.values(INTRINSIC_MIN_PX));

  const grids = src.match(/grid grid-cols-\[repeat\(auto-fit,minmax\((\d+)px,1fr\)\)\][^"]*/g) ?? [];
  check('band 1 uses content-sized tracks, not a fixed column count',
    grids.length >= 4, `${grids.length} auto-fit grids`);
  check('...and no fixed-count ladder survives in the event forms',
    !/md:grid-cols-3 (lg|xl):grid-cols-\d/.test(src));

  const floors = [...new Set(grids.map(g => Number(/minmax\((\d+)px/.exec(g)![1])))];
  check('every track floor is the same value', floors.length === 1, JSON.stringify(floors));
  check(`the track floor clears the widest control's intrinsic minimum (${WIDEST}px)`,
    floors.length === 1 && floors[0] >= WIDEST,
    `floor ${floors[0]}px vs required ${WIDEST}px`);

  // The check must be capable of failing: prove the floor is not so large that
  // any plausible value would pass, and that the required figure is real.
  check('the requirement is a real constraint, not trivially satisfied',
    WIDEST > 100 && floors[0] < WIDEST * 2,
    `floor ${floors[0]}, required ${WIDEST}`);

  check('every grid is top-aligned', grids.every(g => g.includes('items-start')),
    grids.filter(g => !g.includes('items-start')).join(' | '));
}

// ── One name per concept ─────────────────────────────────────────────────
{
  // Stream: Volume said Scenario, Promotion said Volume Target, Value said
  // IBRO Type. All three write the same axis; Promotion literally writes
  // MarketEvent.scenario (see buildPromoEvents).
  const streamUses = (src.match(/whatif_ibro_type/g) ?? []).length;
  check('all three cards with a stream control use one key',
    streamUses >= 3, `${streamUses} uses of whatif_ibro_type`);
  check('the retired stream labels are gone from the markup',
    !/t\('whatif_scenario'\)/.test(src) && !/t\('whatif_volume_target'\)/.test(src),
    'whatif_scenario / whatif_volume_target still referenced');
  check('no card hard-codes the stream label outside i18n',
    !/>IBRO Type</.test(src));

  // Month: the split is real and must survive. Volume and Promotion are point
  // events; Pricing persists via duration, Value via rollForward.
  check("Value's month follows rollForward rather than the card",
    /newYieldEvent\.rollForward \? t\('whatif_start_month'\) : t\('common_month'\)/.test(src));
  check('the inaccurate Activity Month label is retired',
    !/t\('whatif_activity_month'\)/.test(src));

  // Pricing's sub-control reads as a refinement of Target, not a peer of the
  // stream concept.
  check("Pricing's sub-control is renamed", /t\('whatif_applies_to'\)/.test(src));
  check('...and the peer-sounding name is gone', !/t\('whatif_cohort_type'\)/.test(src));
}

// ── Shared targeting order ───────────────────────────────────────────────
{
  /** Order of the shared targeting labels within a card's band 1. */
  const orderIn = (region: string) => {
    const keys = ['whatif_ibro_type', 'common_segment', 'common_product',
                  'common_channel', 'common_tariff'];
    return keys
      .map(k => ({ k, i: region.indexOf(`t('${k}')`) }))
      .filter(x => x.i >= 0)
      .sort((a, b) => a.i - b.i)
      .map(x => x.k);
  };
  check('Volume targets in the agreed order',
    orderIn(volume).join(' > ') === 'whatif_ibro_type > common_segment > common_product > common_channel > common_tariff',
    orderIn(volume).join(' > '));
  check('Pricing targets in the agreed order, minus the stream it does not have',
    orderIn(pricing).join(' > ') === 'common_segment > common_product > common_channel > common_tariff',
    orderIn(pricing).join(' > '));
  check('...and Pricing genuinely has no stream control in targeting',
    !orderIn(pricing).includes('whatif_ibro_type'));
}

// ── Deliberate differences. These are NEGATIVE assertions, so each one is
//    paired with a positive control proving the thing it looks for exists
//    somewhere — otherwise "not found" would pass for the wrong reason.
{
  // Value cannot filter by Product L2 or Tariff: YieldEvent has neither field,
  // and Product L2 is the axis being REDISTRIBUTED. Filtering to one tier and
  // then redistributing across tiers is incoherent.
  const yieldT = fs.readFileSync(path.join('src', 'types', 'forecast.ts'), 'utf8');
  const yi = yieldT.indexOf('export interface YieldEvent');
  const yieldIface = yieldT.slice(yi, yieldT.indexOf('\n}', yi));
  check('the YieldEvent interface was located', yieldIface.length > 100);
  check('YieldEvent carries no productL2 filter field',
    !/^\s*productL2/m.test(yieldIface), 'productL2 present');
  check('YieldEvent carries no tariffL1 filter field',
    !/^\s*tariffL1/m.test(yieldIface), 'tariffL1 present');
  // Positive control: the fields DO exist on the interface the other cards use,
  // so the absence above is a real distinction rather than a typo in the test.
  const me = fs.readFileSync(path.join('src', 'utils', 'forecasting.ts'), 'utf8');
  const mi = me.indexOf('export interface MarketEvent');
  const meIface = me.slice(mi, me.indexOf('\n}', mi));
  check('...while MarketEvent DOES carry both (the control that makes it a distinction)',
    /^\s*productL2\?/m.test(meIface) && /^\s*tariffL1\?/m.test(meIface));

  // Pricing's Applies-to must stay NESTED under Target: it is meaningless when
  // target is base-only, and promoting it to band 1 would create a control that
  // vanishes because of a control further down the form.
  const appliesIdx = src.indexOf("t('whatif_applies_to')");
  const targetGate = src.lastIndexOf("newPricingEvent.target === 'cohorts'", appliesIdx);
  check('Applies to is rendered inside the Target gate',
    appliesIdx > 0 && targetGate > 0 && appliesIdx - targetGate < 900,
    `gap ${appliesIdx - targetGate} chars`);
  check('...and the gate is a real conditional, not incidental text',
    /\{\(newPricingEvent\.target === 'cohorts' \|\| newPricingEvent\.target === 'cohorts\+base'\) && \(/.test(src));
  // Positive control: it must NOT appear in Pricing's band 1 grid.
  const pBand1 = pricing.slice(0, pricing.indexOf('gap-4 items-start') + 3000);
  check('...and it does not appear in band 1', !pBand1.includes("t('whatif_applies_to')"));
}

console.log(`cards spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
