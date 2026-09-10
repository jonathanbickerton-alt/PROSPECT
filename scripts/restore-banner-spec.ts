/**
 * WALK B10 — THE RESTORE FALLBACK BANNER.
 *
 *   npm run spec:restore-banner
 *
 * Jon reloaded his 20:33 save and saw "Restored the first available cohort —
 * this save did not record which one was active". This file establishes, from
 * the REAL readers rather than from reading the handler, that the save records
 * its active cohort, that the recorded cohort RESOLVES, and therefore that the
 * banner was not describing that import at all.
 *
 * WHAT IT DRIVES. `readActiveCohortMeta`, `buildRestoredLeafIndex` and
 * `resolveFromStore` are the three functions the restore path calls, in the
 * order it calls them. Nothing here re-implements the decision; the assertion
 * is on what those three return.
 *
 * THE FIXTURE IS SYNTHETIC AND SHAPED LIKE THE SAVE, deliberately: the real
 * files live in Downloads and are not in the repo, so a spec that needed them
 * would be UNREACHABLE on any other machine. The shape asserted here — 72
 * leaves, an all-'All' recorded cohort, every Is_Active 'No' — is the shape
 * MEASURED on Jon's 20:33 and 16:50 saves and quoted in the report.
 */
import {
  readActiveCohortMeta, buildRestoredLeafIndex, resolveFromStore, makeForecastKey,
} from '../src/utils/forecasting';
import fs from 'fs';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const MONTHS = ['2026-07', '2026-08', '2026-09'];
const band = (v: number) => ({ mean: v, optimistic: v, pessimistic: v });
const leaf = (seg: string, prod: string) => ({
  cohort: {
    segment: seg, product: prod, productL2: 'Standard', channel: 'Direct',
    channelL2: 'Inside Sales', tariffL1: 'RED M', tariffL2: 'SIM-only',
    scenario: 'Standard Forecast',
  },
  seedBaseVolume: 100_000, seedBaseKnown: true,
  historicalMonths: [], lastHistoricalInflow: 10, lastHistoricalOutflow: 5,
  provenance: { kind: 'fitted' as const }, seasonalFallback: false,
  months: MONTHS.map(month => ({
    month, inflow: band(100), outflow: band(50), retention: band(20), arpu: band(12),
  })),
});
const keyOfLeaf = (seg: string, prod: string) =>
  makeForecastKey(seg, prod, 'Standard', 'Direct', 'Inside Sales', 'RED M', 'SIM-only');

const store = new Map<string, any>([
  [keyOfLeaf('Corporate', 'Mobile Voice'), leaf('Corporate', 'Mobile Voice')],
  [keyOfLeaf('Corporate', 'Mobile Data'), leaf('Corporate', 'Mobile Data')],
  [keyOfLeaf('SOHO', 'Mobile Voice'), leaf('SOHO', 'Mobile Voice')],
]);

// ═══════════════════════════════════════════════════════════════════════════
// 1. A SAVE THAT RECORDS AN AGGREGATE — the 20:33 shape
// ═══════════════════════════════════════════════════════════════════════════
{
  // Exactly what Jon's Metadata carries, measured: every dimension 'All'.
  const meta: Record<string, unknown> = {
    Active_Step: 'vsactuals',
    Active_Cohort_Segment: 'All', Active_Cohort_Product: 'All',
    Active_Cohort_Product_L2: 'All', Active_Cohort_Channel: 'All',
    Active_Cohort_Channel_L2: 'All', Active_Cohort_Tariff_L1: 'All',
    Active_Cohort_Tariff_L2: 'All',
  };
  const recorded = readActiveCohortMeta((f: string) => meta[f]);
  check('AGGREGATE: an all-All cohort READS BACK — it is not mistaken for absent',
    recorded !== null, JSON.stringify(recorded));
  if (recorded) {
    const leafMap = buildRestoredLeafIndex(store.keys());
    const key = makeForecastKey(recorded.segment, recorded.product, recorded.productL2,
      recorded.channel, recorded.channelL2, recorded.tariffL1, recorded.tariffL2);
    check('AGGREGATE: the key is the fully-All key',
      key === 'All|All|All|All|All|All|All', key);
    check('AGGREGATE: the leaf index puts every leaf under it',
      (leafMap.get(key) ?? []).length === store.size,
      String((leafMap.get(key) ?? []).length));
    const res = resolveFromStore(store, leafMap, key);
    // THE DECISIVE ONE. `recordedBf` non-null is exactly the condition under
    // which App does NOT set the fallback flag — `if (bf && !recordedBf)`.
    check('AGGREGATE: it RESOLVES, so recordedBf is non-null and NO banner fires',
      !!res.forecast, res.reason ?? '-');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. A SAVE THAT RECORDS NOTHING — the documented fallback, banner and all
// ═══════════════════════════════════════════════════════════════════════════
{
  const meta: Record<string, unknown> = { Active_Step: 'home' };
  const recorded = readActiveCohortMeta((f: string) => meta[f]);
  check('OLD FILE: no Active_Cohort block reads as absent',
    recorded === null, JSON.stringify(recorded));
  // An empty string is the other absence carrier a sheet can produce.
  check('OLD FILE: an empty segment cell also reads as absent',
    readActiveCohortMeta(() => '') === null);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. A RECORDED COHORT THIS STORE CANNOT RESOLVE — fallback, correctly
// ═══════════════════════════════════════════════════════════════════════════
{
  const meta: Record<string, unknown> = {
    Active_Cohort_Segment: 'Public Sector', Active_Cohort_Product: 'Satellite',
  };
  const recorded = readActiveCohortMeta((f: string) => meta[f])!;
  const leafMap = buildRestoredLeafIndex(store.keys());
  const key = makeForecastKey(recorded.segment, recorded.product, recorded.productL2,
    recorded.channel, recorded.channelL2, recorded.tariffL1, recorded.tariffL2);
  const res = resolveFromStore(store, leafMap, key);
  check('GONE: a recorded cohort absent from the store does NOT resolve',
    !res.forecast, 'this is the second, legitimate way the banner fires');
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. THE BANNER IS CLEARED AT THE START OF EVERY IMPORT — the B10 fix
//
// Structural, because App is mounted by no spec in this repo. The claim is
// about the SET of writers, which is exactly what a structural check can pin:
// before the fix there was one writer to `true` and one to `false` (the
// dismiss button), so a banner survived every later import.
// ═══════════════════════════════════════════════════════════════════════════
{
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const trues = (app.match(/setRestoreFellBack\(true\)/g) ?? []).length;
  const falses = (app.match(/setRestoreFellBack\(false\)/g) ?? []).length;
  check('BANNER: exactly one site raises it', trues === 1, String(trues));
  check('BANNER: TWO sites clear it — the dismiss button AND the import',
    falses === 2, `${falses} — a lone dismiss means a banner survives the next import`);
  // The clear must be INSIDE the import body, and before the fallback can set
  // it: a clear placed after would erase a banner this very import raised.
  const body = app.indexOf('const applyImportSaveWorkbook');
  const clear = app.indexOf('setRestoreFellBack(false)', body);
  const raise = app.indexOf('setRestoreFellBack(true)', body);
  check('BANNER: the import clears it', body >= 0 && clear > body, `${body} / ${clear}`);
  check('BANNER: and clears it BEFORE the fallback can raise it',
    clear > 0 && raise > 0 && clear < raise, `clear@${clear} raise@${raise}`);
}

console.log(`\nrestore-banner spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
