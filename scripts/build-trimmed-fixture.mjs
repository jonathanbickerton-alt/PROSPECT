/**
 * Build the trimmed fixture CLAUDE.md tells routine agent runs to use.
 *
 * Selects whole LEAF cohorts and keeps every row of each — never samples rows
 * or months, which would break the time series the forecaster needs (and the
 * >=8-point minimum in calculateBaseForecast).
 *
 * Must preserve:
 *   - EXPECTED.md section 4's reference cohort (Corporate/IoT Connectivity/Indirect)
 *   - the full tariff hierarchy (every L1, and L2s under them)
 *   - the RED ULTD edge case: segments that sell a tariff but NOT under
 *     Mobile Voice / Direct, which is what forces the share-scaled fallback
 *   - the Corporate/Mobile Voice/Direct tariff canary rows
 *   - at least two cohorts per segment
 */
import XLSX from 'xlsx';

const SRC = 'test-data/VBU_IBRO_Synthetic_ForecastTest_TariffHierarchy_Jan2023_Jun2026.xlsx';
const OUT = 'test-data/VBU_IBRO_Trimmed_TariffHierarchy_Jan2023_Jun2026.xlsx';

const wb = XLSX.readFile(SRC);
const sheet = wb.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet]);

const F = { seg: 'Customer_Segment', p1: 'Product_L1', p2: 'Product_L2_Value_Tier',
  c1: 'Channel_Level_1', c2: 'Channel_Level_2', t1: 'tariff_tier_l1', t2: 'tariff_tier_l2' };
const v = (r, k) => String(r[k] ?? '').trim();
const leaf = (r) => [F.seg, F.p1, F.p2, F.c1, F.c2, F.t1, F.t2].map(k => v(r, k)).join('|');

const allLeaves = [...new Set(rows.map(leaf))];
const segs = [...new Set(rows.map(r => v(r, F.seg)))].sort();
const keep = new Set();

// 1. The section-4 reference cohort: every leaf under Corporate/IoT Connectivity/Indirect.
for (const k of allLeaves) {
  const [s, p1, , c1] = k.split('|');
  if (s === 'Corporate' && p1 === 'IoT Connectivity' && c1 === 'Indirect') keep.add(k);
}
const refCount = keep.size;

// 2. Corporate / Mobile Voice / Direct — the tariff canary rows, every tariff.
for (const k of allLeaves) {
  const [s, p1, , c1] = k.split('|');
  if (s === 'Corporate' && p1 === 'Mobile Voice' && c1 === 'Direct') keep.add(k);
}

// 3. The RED ULTD edge case: for every segment, keep its RED ULTD leaves
//    WHEREVER they live. For LE and MNC those are outside Mobile Voice/Direct,
//    which is exactly the "sells the tariff, but not through that combo" shape.
for (const k of allLeaves) {
  if (k.split('|')[5] === 'RED ULTD') keep.add(k);
}

// 4. Tariff-hierarchy completeness: at least one leaf per (tariffL1, tariffL2).
const tarPairs = new Map();
for (const k of allLeaves) {
  const p = k.split('|');
  const pair = `${p[5]}|${p[6]}`;
  if (!tarPairs.has(pair)) tarPairs.set(pair, k);
}
for (const k of tarPairs.values()) keep.add(k);

// 5. At least two leaves per segment (segments not otherwise represented).
for (const s of segs) {
  const mine = [...keep].filter(k => k.startsWith(s + '|'));
  if (mine.length >= 2) continue;
  for (const k of allLeaves) {
    if (k.startsWith(s + '|') && !keep.has(k)) { keep.add(k); if ([...keep].filter(x => x.startsWith(s + '|')).length >= 2) break; }
  }
}

const out = rows.filter(r => keep.has(leaf(r)));
const nb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(nb, XLSX.utils.json_to_sheet(out), sheet);
// compression is off by default in SheetJS — without it the trimmed file is
// LARGER than the 8.3 MB source despite holding 13.7% of the rows.
XLSX.writeFile(nb, OUT, { compression: true });

// ── Report what survived ────────────────────────────────────────────────────
const outSegs = [...new Set(out.map(r => v(r, F.seg)))].sort();
const srcT1 = [...new Set(rows.map(r => v(r, F.t1)))].filter(x => x && x !== 'undefined').sort();
const outT1 = [...new Set(out.map(r => v(r, F.t1)))].filter(x => x && x !== 'undefined').sort();
const srcT2 = new Set(rows.map(r => `${v(r, F.t1)}|${v(r, F.t2)}`));
const outT2 = new Set(out.map(r => `${v(r, F.t1)}|${v(r, F.t2)}`));
const months = [...new Set(out.map(r => String(r['Month'])))];
const ref = out.filter(r => v(r, F.seg) === 'Corporate' && v(r, F.p1) === 'IoT Connectivity' && v(r, F.c1) === 'Indirect');

const mvDirect = (seg, tar) => rows.filter(r => v(r, F.seg) === seg && v(r, F.p1) === 'Mobile Voice'
  && v(r, F.c1) === 'Direct' && v(r, F.t1) === tar).length;
const mvDirectOut = (seg, tar) => out.filter(r => v(r, F.seg) === seg && v(r, F.p1) === 'Mobile Voice'
  && v(r, F.c1) === 'Direct' && v(r, F.t1) === tar).length;

console.log(`rows        ${rows.length} -> ${out.length}  (${((out.length / rows.length) * 100).toFixed(1)}%)`);
console.log(`leaves      ${allLeaves.length} -> ${keep.size}   (reference cohort contributed ${refCount})`);
console.log(`segments    ${segs.length} -> ${outSegs.length}   ${outSegs.join(', ')}`);
console.log(`  per-segment leaf counts: ${outSegs.map(s => `${s}=${[...keep].filter(k => k.startsWith(s + '|')).length}`).join('  ')}`);
console.log(`tariff L1   ${srcT1.length} -> ${outT1.length}   ${outT1.join(', ')}   ${srcT1.length === outT1.length ? 'COMPLETE' : 'MISSING ' + srcT1.filter(x => !outT1.includes(x))}`);
console.log(`tariff L1|L2 pairs ${srcT2.size} -> ${outT2.size}   ${srcT2.size === outT2.size ? 'COMPLETE' : 'partial'}`);
console.log(`months      ${months.length} distinct`);
console.log(`section-4 reference cohort rows: ${ref.length}   ${ref.length > 0 ? 'PRESENT' : 'MISSING'}`);
console.log('\nRED ULTD edge case (rows under Mobile Voice / Direct — 0 is the case that forces the fallback):');
for (const s of segs) console.log(`  ${s.padEnd(17)} source=${String(mvDirect(s, 'RED ULTD')).padStart(4)}  trimmed=${String(mvDirectOut(s, 'RED ULTD')).padStart(4)}  ${mvDirect(s, 'RED ULTD') === 0 ? '<- zero preserved' : ''}`);
