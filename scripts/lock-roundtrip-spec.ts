/**
 * THE PADLOCK SURVIVES THE SAVE — both carriers.
 *
 *   npm run spec:lock-roundtrip
 *
 * Jon, 2026-09-03, decision 1: lock state PERSISTS; a lock is the user's, and
 * only the user unlocks it. That makes the round trip the decision's whole
 * content — a lock that does not survive the save has been unlocked by the
 * tool, which is the one thing the decision forbids.
 *
 * DRIVES THE REAL WRITER AND THE REAL READER, imported from the app. Both
 * carriers are exercised, because the field is one concept with two homes and
 * "it works on the promotion" would say nothing about the Value card.
 *
 * THE OLD-WORKBOOK CASE IS THE POINT OF THE ABSENCE CARRIER. A file written
 * before the column existed must load with NO locks — never a crash, and never
 * a phantom lock, which is worse: a padlock the user did not set, cannot
 * explain, and can only discover by finding a slider that will not move.
 */
import {
  marketEventExportRow, marketEventFromRow,
  yieldEventExportRow, yieldEventFromRow,
} from '../src/utils/forecasting';
import { rebalance } from '../src/utils/mixConstraint';
import fs from 'fs';
import type { MarketEvent } from '../src/utils/forecasting';
import type { YieldEvent } from '../src/types/forecast';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const MIX = { Low: 20, Medium: 30, High: 50 };
const LOCKS = ['Medium', 'High'];

const promo = {
  id: 'p1', sequence: 1, scenario: 'Inflow', date: '2026-09',
  segment: 'Corporate', product: 'Mobile Voice', productL2: 'All',
  channel: 'All', channelL2: 'All', tariffL1: 'All', tariffL2: 'All',
  subscriberVolume: 1000, customerVolume: 0, revenue: 35000, arpu: 35,
  name: 'promo', campaignName: '', comment: '', amountType: 'absolute',
  isPromotion: true, promoRebanded: false, promoMixAxis: 'value',
  promoMix: MIX, mixLocked: LOCKS,
} as unknown as MarketEvent;

const yieldEvt = {
  id: 'y1', ibro: 'Retention', segment: 'Corporate', product: 'Mobile Voice',
  channelL1: 'All', channelL2: 'All', month: '2026-09', mixAxis: 'value',
  tariffMix: MIX, tariffBaseArpu: { Low: 10, Medium: 20, High: 40 },
  rollForward: false, name: 'yield', mixLocked: LOCKS,
} as unknown as YieldEvent;

// ── 1. THE COLUMN IS WRITTEN, AND IS APPENDED ──────────────────────────────
{
  const row = marketEventExportRow(promo) as Record<string, unknown>;
  const keys = Object.keys(row);
  check('promo: the lock column exists', 'Promo_Mix_Locked' in row);
  check('promo: it holds the stated locks',
    row.Promo_Mix_Locked === JSON.stringify(LOCKS), String(row.Promo_Mix_Locked));
  // APPENDED, not inserted: every column that existed before it still precedes
  // it, so a human diffing two exports sees one new column at a known place
  // rather than a shifted sheet.
  check('promo: the lock column comes AFTER Promo_Mix_JSON',
    keys.indexOf('Promo_Mix_Locked') > keys.indexOf('Promo_Mix_JSON'),
    `${keys.indexOf('Promo_Mix_JSON')} -> ${keys.indexOf('Promo_Mix_Locked')}`);

  const yrow = yieldEventExportRow(yieldEvt) as Record<string, unknown>;
  const ykeys = Object.keys(yrow);
  check('yield: the lock column exists', 'Tariff_Mix_Locked' in yrow);
  check('yield: it holds the stated locks',
    yrow.Tariff_Mix_Locked === JSON.stringify(LOCKS), String(yrow.Tariff_Mix_Locked));
  check('yield: the lock column comes AFTER Tariff_Mix_JSON',
    ykeys.indexOf('Tariff_Mix_Locked') > ykeys.indexOf('Tariff_Mix_JSON'),
    `${ykeys.indexOf('Tariff_Mix_JSON')} -> ${ykeys.indexOf('Tariff_Mix_Locked')}`);
}

// ── 2. THE ROUND TRIP, through the real reader ─────────────────────────────
{
  const back = marketEventFromRow(marketEventExportRow(promo) as Record<string, any>, 'session');
  check('promo round trip: the locks survive',
    JSON.stringify(back.mixLocked) === JSON.stringify(LOCKS), JSON.stringify(back.mixLocked));
  check('promo round trip: the mix survives beside them',
    JSON.stringify(back.promoMix) === JSON.stringify(MIX), JSON.stringify(back.promoMix));

  const yback = yieldEventFromRow(yieldEventExportRow(yieldEvt) as Record<string, any>);
  check('yield round trip: the locks survive',
    JSON.stringify(yback.mixLocked) === JSON.stringify(LOCKS), JSON.stringify(yback.mixLocked));
  check('yield round trip: the mix survives beside them',
    JSON.stringify(yback.tariffMix) === JSON.stringify(MIX), JSON.stringify(yback.tariffMix));
}

// ── 3. A RESTORED LOCK IS HONOURED BY THE NEXT REBALANCE ───────────────────
//
// The round trip alone would pass if the field were carried and then ignored.
// This drives the engine with the RESTORED locks and asserts the held share is
// still held — which is what "a lock is the user's" means in arithmetic.
{
  const back = marketEventFromRow(marketEventExportRow(promo) as Record<string, any>, 'session');
  const out = rebalance(Object.keys(MIX), MIX, back.mixLocked ?? [], 'Low', 40);
  check('restored locks are HONOURED: the outcome is ok', out.kind === 'ok', out.kind);
  if (out.kind === 'ok') {
    check('restored locks are HONOURED: Medium is untouched',
      out.shares.Medium === MIX.Medium, `${out.shares.Medium} vs ${MIX.Medium}`);
    check('restored locks are HONOURED: High is untouched',
      out.shares.High === MIX.High, `${out.shares.High} vs ${MIX.High}`);
    // And the move itself was clamped by what the padlocks hold: 100 - 80 = 20.
    check('restored locks are HONOURED: the moved member takes only the room left',
      Math.abs(out.shares.Low - 20) < 1e-9, String(out.shares.Low));
  }
}

// ── 4. A WORKBOOK WITHOUT THE COLUMN LOADS CLEAN ───────────────────────────
{
  const row = marketEventExportRow(promo) as Record<string, any>;
  delete row.Promo_Mix_Locked;
  const back = marketEventFromRow(row, 'session');
  check('old workbook: no crash, and NO locks', back.mixLocked === undefined,
    JSON.stringify(back.mixLocked));

  const yrow = yieldEventExportRow(yieldEvt) as Record<string, any>;
  delete yrow.Tariff_Mix_Locked;
  const yback = yieldEventFromRow(yrow);
  check('old workbook (yield): no crash, and NO locks', yback.mixLocked === undefined,
    JSON.stringify(yback.mixLocked));

  // A PHANTOM LOCK IS WORSE THAN NONE, so the malformed cases are pinned too:
  // each must read as absence rather than as a lock nobody set.
  for (const [label, raw] of [['empty string', ''], ['malformed JSON', '{oops'],
                              ['an empty array', '[]'], ['not an array', '{"a":1}']] as [string, string][]) {
    const r = { ...(marketEventExportRow(promo) as Record<string, any>), Promo_Mix_Locked: raw };
    check(`malformed lock column (${label}) reads as NO locks`,
      marketEventFromRow(r, 'session').mixLocked === undefined,
      JSON.stringify(marketEventFromRow(r, 'session').mixLocked));
  }
}

// ── 5. ABSENCE ON THE WAY OUT ──────────────────────────────────────────────
{
  const noLocks = { ...promo, mixLocked: undefined } as unknown as MarketEvent;
  const row = marketEventExportRow(noLocks) as Record<string, unknown>;
  check('no locks writes the EMPTY-STRING absence carrier, not "[]"',
    row.Promo_Mix_Locked === '', JSON.stringify(row.Promo_Mix_Locked));
}


// ── 6. THE VALUE CARD ACTUALLY PASSES ITS LOCKS ────────────────────────────
//
// A SOURCE CHECK, and the weaker kind — stated plainly rather than dressed up.
// The engine assertions above prove `rebalance` honours a lock set; they say
// nothing about whether the Value card hands one over, and a card passing `[]`
// would leave every one of them green.
//
// The mounted coverage that drives the Value padlock through the DOM does not
// exist yet and is recorded as the remaining piece. Until it does, this pins
// the wiring at the one line where it can be dropped.
{
  const raw = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
  const tab = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('the Value card passes its lock set to autoBalanceMix',
    tab.includes('autoBalanceMix(prev, changedTier, newValue, yieldMixLocked)'),
    'a hard-coded [] here silently unlocks every padlock the user set');
  check('autoBalanceMix forwards it to rebalance rather than dropping it',
    tab.includes('rebalance(members, seeded, locked, changedTier, newValue)'),
    'the parameter exists but is not used');
  check('both cards render the padlock through the ONE component',
    (tab.match(/<MixSliderRow/g) ?? []).length === 2,
    `${(tab.match(/<MixSliderRow/g) ?? []).length} usages, expected 2`);
  check('no raw range input survives in the tab',
    !tab.includes('type="range"'),
    'a second raw slider is a second padlock waiting to happen');
}

console.log(String.fromCharCode(10) + 'lock-roundtrip spec: ' + pass + ' passed, ' + fails.length + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
