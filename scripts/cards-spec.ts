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
  // ── Track floor, and the truncation that makes a static floor valid ────
  //
  // History, because this assertion has been wrong twice.
  //
  // v1 asserted all four cards used ONE ladder. They did, and every card was
  // visibly broken: the ladder was uniformly WRONG. Consistency is not
  // correctness.
  //
  // v2 asserted the track floor cleared each control's intrinsic minimum. The
  // minimums came from a hand-written repro measured with an EMPTY dropdown.
  // Measured for real (scripts/layout-probe), a populated one is 236.7px in a
  // 172.2px cell — it overflowed 70.5px and painted 54.5px over the month
  // input. The month input was never starved. Both earlier assertions passed
  // while three of four cards were unusable.
  //
  // v3 asserts the property that makes a static floor MEANINGFUL: the
  // dropdown must be unable to exceed its cell, whatever is selected. Its
  // content is user data with no upper bound, so bounding it is not possible —
  // the variable has to be removed instead.
  const dd = fs.readFileSync(path.join('src', 'components', 'HierarchicalDropdown.tsx'), 'utf8');

  // Every box between the grid cell and the text must be able to shrink. A
  // flex item defaults to min-width:auto and will NOT go below its content, so
  // one missing min-w-0 anywhere in the chain restores the overflow.
  const root = /<div className="flex items-center gap-1\.5 relative min-w-0">/.test(dd);
  const inner = /<div className="relative min-w-0">/.test(dd);
  const trigger = (dd.match(/flex items-center gap-1 min-w-0/g) ?? []).length;
  check('dropdown root can shrink', root);
  check('dropdown inner wrapper can shrink (the box that actually overflowed)', inner);
  check('both trigger variants can shrink', trigger === 2, `${trigger} of 2`);
  check('the label truncates rather than pushing the box wider',
    /<span className="truncate">\{displayText\}<\/span>/.test(dd));
  check('the icons cannot be squeezed into the label',
    (dd.match(/shrink-0/g) ?? []).length >= 3, `${(dd.match(/shrink-0/g) ?? []).length} shrink-0`);

  // With truncation guaranteed, the only content with a fixed intrinsic
  // minimum is the native month input. Measured in Chrome at this font size
  // and padding; a native month input clips inside its shadow DOM and reports
  // scrollWidth === clientWidth even when cut, so this figure cannot be
  // derived at runtime and has to be recorded.
  const MONTH_INTRINSIC_MIN_PX = 155;

  // Annotated because `?? []` infers never[] when the match returns null,
  // which silently poisons every downstream string operation. Type-only:
  // this spec has always passed 36/36 at runtime.
  const grids: string[] = src.match(/grid grid-cols-\[repeat\(auto-fit,minmax\((\d+)px,1fr\)\)\][^"]*/g) ?? [];
  check('band 1 uses content-sized tracks, not a fixed column count',
    grids.length >= 4, `${grids.length} auto-fit grids`);
  check('...and no fixed-count ladder survives in the event forms',
    !/md:grid-cols-3 (lg|xl):grid-cols-\d/.test(src));

  const floors = [...new Set(grids.map(g => Number(/minmax\((\d+)px/.exec(g)![1])))];
  check('every track floor is the same value', floors.length === 1, JSON.stringify(floors));
  check(`the track floor clears the month input's intrinsic minimum (${MONTH_INTRINSIC_MIN_PX}px)`,
    floors.length === 1 && floors[0] >= MONTH_INTRINSIC_MIN_PX,
    `floor ${floors[0]}px vs required ${MONTH_INTRINSIC_MIN_PX}px`);
  check('the requirement is a real constraint, not trivially satisfied',
    MONTH_INTRINSIC_MIN_PX > 100 && floors[0] < MONTH_INTRINSIC_MIN_PX * 2,
    `floor ${floors[0]}, required ${MONTH_INTRINSIC_MIN_PX}`);

  check('every grid is top-aligned', grids.every(g => g.includes('items-start')),
    grids.filter(g => !g.includes('items-start')).join(' | '));

  // The probe is the instrument these figures came from. If it stops matching
  // what the cards render, the numbers above stop meaning anything.
  const probe = fs.readFileSync(path.join('scripts', 'layout-probe', 'main.tsx'), 'utf8');
  const probeGrid = /const BAND_GRID = '([^']+)'/.exec(probe)?.[1];
  check('the layout probe renders the same grid the cards do',
    !!probeGrid && grids.some(g => g.startsWith(probeGrid)),
    `probe: ${probeGrid}`);
  check('the probe imports the REAL dropdown, not a copy',
    /from '\.\.\/\.\.\/src\/components\/HierarchicalDropdown'/.test(probe));

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

  // The OPTIONS, not just the label. Unifying the field name was the point of
  // the 2B pass, and it left Promotion offering "Acquisition (Inflow)" where
  // Volume and Value offer "Inflow" — the same field, the same stored value,
  // two different words on screen. The label assertion above passed throughout,
  // because it only ever looked at the label.
  //
  // A control is its label AND its choices. Checking one and not the other is
  // the same shape as checking consistency and not correctness.
  {
    const optionSets = [...src.matchAll(/<option value="Inflow">([^<]*)<\/option>/g)]
      .map(m => m[1].trim());
    check('every IBRO Type control was found', optionSets.length >= 3,
      `${optionSets.length} Inflow options`);
    check('the Inflow option reads the same on every card',
      new Set(optionSets).size === 1, JSON.stringify([...new Set(optionSets)]));
    check('...and it is the bare stream name, not a card-specific gloss',
      optionSets.every(o => o === 'Inflow'), JSON.stringify(optionSets));

    const retention = [...src.matchAll(/<option value="Retention">([^<]*)<\/option>/g)]
      .map(m => m[1].trim());
    check('the Retention option reads the same on every card',
      new Set(retention).size === 1, JSON.stringify([...new Set(retention)]));

    // Cards legitimately offer DIFFERENT SUBSETS — Volume has Outflow and ARPU,
    // Value and Promotion do not. The rule is that a shared option must read
    // identically, not that every card offers every option.
    check('a card may still offer a narrower subset',
      /<option value="Outflow">/.test(src) && /<option value="ARPU">/.test(src));
  }

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
