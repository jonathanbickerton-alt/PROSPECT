/**
 * LOCALE PARITY — a value identical to English is a DEFECT unless allowlisted.
 *
 *   npm run spec:i18n-parity
 *
 * Recorded decision, Jon 2026-09-02 (test-data/EXPECTED.md, "LOCALE PARITY —
 * de and it are CORE UAT LANGUAGES"): every user-visible string renders in the
 * selected language, and de/it are UAT-blocking rather than cosmetic.
 *
 * WHY THIS SPEC EXISTS RATHER THAN THE SCAN THAT WAS ALREADY THERE.
 * `scripts/scan-i18n.ts` has a block headed LOCALE PARITY. It asks only whether
 * the KEY EXISTS in each locale:
 *
 *     const missingFrom = LOCALES.filter(l => !(key in others[l]));
 *
 * Twelve lines below it, the staleness check carries a comment reading
 * "PRESENCE IS NOT TRANSLATION" and explains that exact error — a key carrying
 * identical English in all six read as translated — and fixes it, but only for
 * itself. The main parity check still asks the cheaper question, in the same
 * block, under the comment explaining why that is wrong. So the class this spec
 * measures was unmeasurable by the tool named for it: on 2026-09-02 the scan
 * was green while 703 of 831 German keys carried English.
 *
 * THE ALLOWLIST IS EXACT-COUNT, NOT A FLOOR.
 * A floor stops discriminating the moment anything is added — trap 77 proved
 * that here in August. An allowlist is precisely the structure where that
 * failure would be silent, because the cheapest way to make a parity failure
 * go away is to allowlist the key. An exact count means every addition is a
 * deliberate, reviewed edit to the pin.
 *
 * AND EVERY ENTRY IS CHECKED FOR BEING STILL NEEDED. An allowlist entry whose
 * key no longer equals English is stale, and stale exemptions are how a list
 * like this quietly grows into a blanket. Those fail too.
 *
 * SCOPE, which must be stated whenever this is reported: parity is not quality.
 * This proves a translated string EXISTS and differs from English. Whether it
 * is what a native speaker would have written is Marcel's (de) and
 * Alessandro's (it) call in UAT, and this spec does not stand in for it.
 */
import * as fs from 'fs';

const LOCALES = ['de', 'es', 'fr', 'it', 'pt'] as const;
type Loc = (typeof LOCALES)[number];

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const read = (l: string) =>
  JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8')) as Record<string, string>;
const en = read('en');
const loc: Record<Loc, Record<string, string>> =
  Object.fromEntries(LOCALES.map(l => [l, read(l)])) as never;

/**
 * Keys that may legitimately carry the English string, with the locales it
 * applies to and a one-line reason. `ALL` means all five.
 *
 * TERMBASE §1 is the authority for the never-translate vocabulary (Inflow,
 * Outflow, Retention, Base, ARPU, IBRO, PROSPECT, model names, MAPE, formulae);
 * §5 for dimension words that coincide (Volume is Volume in fr/it/pt but
 * Volumen in de/es); §6 for Mix, which is Mix in all six.
 */
type Entry = { locales: 'ALL' | Loc[]; why: string };
const ALLOW: Record<string, Entry> = {
  // --- Language endonyms. A language names itself in its own language in the
  // picker; translating them is what would be wrong.
  english:    { locales: 'ALL', why: 'endonym — the picker names each language in itself' },
  german:     { locales: 'ALL', why: 'endonym' },
  spanish:    { locales: 'ALL', why: 'endonym' },
  portuguese: { locales: 'ALL', why: 'endonym' },
  french:     { locales: 'ALL', why: 'endonym' },
  italian:    { locales: 'ALL', why: 'endonym' },

  // --- TERMBASE §1: never-translate vocabulary, alone or in compounds built
  // only from it. Each of these is entirely §1 words.
  actuals_unit_arpu:      { locales: 'ALL', why: '§1 ARPU' },
  whatif_measure_arpu:    { locales: 'ALL', why: '§1 ARPU' },
  actuals_inf_arpu:       { locales: 'ALL', why: '§1 — Inf(low) + ARPU, both never-translate' },
  actuals_inflow_arpu:    { locales: 'ALL', why: '§1 Inflow + ARPU' },
  actuals_out_arpu:       { locales: 'ALL', why: '§1 — Out(flow) + ARPU' },
  actuals_outflow_arpu:   { locales: 'ALL', why: '§1 Outflow + ARPU' },
  actuals_ret_arpu:       { locales: 'ALL', why: '§1 — Ret(ention) + ARPU' },
  actuals_retention_arpu: { locales: 'ALL', why: '§1 Retention + ARPU' },
  actuals_base_arpu:      { locales: 'ALL', why: '§1 Base + ARPU' },
  actuals_mape:           { locales: 'ALL', why: '§1 MAPE — acronym kept, expansion translated (§4)' },
  baseline_ses:           { locales: 'ALL', why: '§1 model name (Simple Exponential Smoothing)' },
  whatif_base_t_base_t_1_inflow_t_1_outflow_t_1:
                          { locales: 'ALL', why: '§1 formula — Base(t) = Base(t−1) + Inflow(t−1) − Outflow(t−1)' },
  prospect_acronym_full:  { locales: 'ALL', why: 'the PROSPECT backronym — the letters only spell it in English' },

  // --- TERMBASE §6: Mix is Mix in every locale.
  whatif_mix:     { locales: 'ALL', why: '§6 Mix is Mix in all six' },
  whatif_mixpct:  { locales: 'ALL', why: '§6 Mix + %' },
  whatif_mix_pct: { locales: 'ALL', why: '§6 Mix + %' },

  // --- Product feature names verified against the translated user guide, not
  // assumed. The German guide uses "Yield" 16 times with no German alternative,
  // and "Pricing" attributively ("die Pricing-Karte", "die Pricing-Ziele").
  whatif_yield:   { locales: 'ALL', why: 'feature name — guide uses Yield in every translated block' },
  whatif_pricing: { locales: 'ALL', why: 'feature name — guide uses Pricing attributively in every block' },

  // --- Pure placeholders and markup: nothing to translate.
  whatif_summary_volume:  { locales: 'ALL', why: 'placeholders only — {{scenario}} {{amount}}' },
  actuals_andrdquo:       { locales: 'ALL', why: 'an HTML entity, &rdquo;' },
  baseline_en_us:         { locales: 'ALL', why: 'a BCP-47 locale code, not copy' },
  whatif_amount_unit_pct: { locales: 'ALL', why: 'the per-cent sign' },

  // --- Words that genuinely coincide. Per-locale, because the same English
  // word translates in some locales and not others — and forcing a difference
  // to satisfy this spec would make the UI worse, which is the failure the
  // allowlist exists to prevent.
  common_volume:         { locales: ['fr', 'it', 'pt'], why: '§5 Volume — Volumen in de/es, Volume in fr/it/pt' },
  baseline_volume:       { locales: ['fr', 'it', 'pt'], why: '§5 Volume' },
  whatif_volume:         { locales: ['fr', 'it', 'pt'], why: '§5 Volume' },
  whatif_measure_volume: { locales: ['fr', 'it', 'pt'], why: '§5 Volume' },
  compare_volumes:       { locales: ['fr', 'pt'],       why: 'plural of §5 Volume; Volumen/Volumi elsewhere' },
  common_segment:        { locales: ['de', 'fr', 'pt'], why: 'Segment is the word in de/fr/pt; Segmento in es/it' },
  actuals_segment:       { locales: ['de', 'fr'],       why: 'Segment = {{p0}} — same word' },
  whatif_scenario:       { locales: ['it'],             why: '§3 Scenario — Scenario in it' },
  actuals_scenario:      { locales: ['it'],             why: '§3 Scenario' },
  whatif_promotion:      { locales: ['de', 'fr'],       why: 'Promotion is the word in de/fr' },
  whatif_summary_promo_volume: { locales: ['de', 'fr'], why: 'Promotion + placeholder' },
  whatif_delta:          { locales: 'ALL',              why: 'Delta is the word in all five' },
  home:                  { locales: ['it'],            why: 'Italian UI uses Home; de/es/fr/pt translate it' },
  dashboard:             { locales: ['de', 'it'],      why: 'established loanword in de/it; Panel/Painel elsewhere' },
  actuals_band:          { locales: ['de'],            why: 'Band is the German word (§4 Konfidenzband)' },
  overall_status:        { locales: ['de'],            why: 'Status is the German word' },
  overall_actions:       { locales: ['fr'],            why: 'Actions is the French word' },
  baseline_trend:        { locales: ['de'],            why: 'Trend is the German word' },
  baseline_date:         { locales: ['fr'],            why: 'Date is the French word' },
  whatif_mode:           { locales: ['fr'],            why: 'Mode is the French word' },
  whatif_summary_col_name: { locales: ['de'],          why: 'Name is the German word' },
  bulk_optional:         { locales: ['de', 'it'],      why: '(optional) is the same in de/it' },
  whatif_pricing_mode_direct:   { locales: ['fr'],     why: 'Direct is the French word' },
  whatif_pricing_mode_dilution: { locales: ['fr'],     why: 'Dilution is the French word' },
};

/** The pin. Changing either number must be a deliberate, reviewed edit. */
const ALLOW_ENTRIES = 52;
const ALLOW_PAIRS   = 184;

const applies = (e: Entry, l: Loc) => e.locales === 'ALL' || e.locales.includes(l);

// ---------------------------------------------------------------------------
// 1. Every English key exists in every locale. Absence renders English via
//    fallbackLng and is the same user-visible defect by another mechanism.
// ---------------------------------------------------------------------------
for (const l of LOCALES) {
  const missing = Object.keys(en).filter(k => !(k in loc[l]));
  check(`PRESENT ${l}: every en key exists`, missing.length === 0,
    `${missing.length} missing — first: ${missing.slice(0, 3).join(', ')}`);
}

// ---------------------------------------------------------------------------
// 2. THE CLASS. Zero non-allowlisted keys carrying the English string.
// ---------------------------------------------------------------------------
for (const l of LOCALES) {
  const offenders = Object.keys(en).filter(k => {
    if (!(k in loc[l])) return false;              // covered by check 1
    if (String(loc[l][k]) !== String(en[k])) return false;
    const e = ALLOW[k];
    return !(e && applies(e, l));
  });
  check(`PARITY ${l}: no non-allowlisted key equals English`, offenders.length === 0,
    `${offenders.length} — first: ${offenders.slice(0, 5).join(', ')}`);
}

// ---------------------------------------------------------------------------
// 3. THE PIN, exact on both axes.
// ---------------------------------------------------------------------------
check('ALLOWLIST: entry count is exactly the pinned number',
  Object.keys(ALLOW).length === ALLOW_ENTRIES,
  `${Object.keys(ALLOW).length} vs ${ALLOW_ENTRIES} — adding an exemption must be deliberate`);

const pairCount = Object.keys(en).reduce((n, k) => {
  for (const l of LOCALES) if (k in loc[l] && String(loc[l][k]) === String(en[k])) n++;
  return n;
}, 0);
check('ALLOWLIST: (key, locale) pairs equal the pinned number',
  pairCount === ALLOW_PAIRS,
  `${pairCount} vs ${ALLOW_PAIRS} — a floor would not see one going the other way`);

// ---------------------------------------------------------------------------
// 4. NO STALE EXEMPTIONS. An entry naming a key that no longer equals English —
//    or that no longer exists — is dead weight, and dead weight is how an
//    allowlist becomes a blanket.
// ---------------------------------------------------------------------------
for (const [k, e] of Object.entries(ALLOW)) {
  check(`ALLOWLIST ${k}: still exists in en`, k in en);
  if (!(k in en)) continue;
  const ls: Loc[] = e.locales === 'ALL' ? [...LOCALES] : e.locales;
  const notNeeded = ls.filter(l => k in loc[l] && String(loc[l][k]) !== String(en[k]));
  check(`ALLOWLIST ${k}: every listed locale still needs it`, notNeeded.length === 0,
    `now translated in ${notNeeded.join(', ')} — remove those from the entry`);
  check(`ALLOWLIST ${k}: carries a justification`, e.why.trim().length > 0);
}

// ---------------------------------------------------------------------------
// 5. HARDCODED LABELS. A literal that never reaches the locale files cannot be
//    caught by anything above: it renders English in all six while the parity
//    check reports clean. Pinned at zero.
// ---------------------------------------------------------------------------
const whatIf  = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
const compare = fs.readFileSync('src/components/ScenarioCompareTab.tsx', 'utf8');

check('LITERAL: the Subs/% amount unit is keyed, not literal',
  !whatIf.includes("'Subs' : '%'"),
  'the ternary is back — see whatif_amount_unit_subs / _pct');
check('LITERAL: whatif_amount_unit_subs is used', whatIf.includes("t('whatif_amount_unit_subs')"));
check('LITERAL: whatif_amount_unit_pct is used', whatIf.includes("t('whatif_amount_unit_pct')"));

check('LITERAL: the Compare window sizes are keyed, not literal',
  !compare.includes("'All Time'"),
  'the literal is back — see compare_window_all_time / _months');
check('LITERAL: compare_window_all_time is used', compare.includes("t('compare_window_all_time')"));
check('LITERAL: compare_window_months is used', compare.includes("t('compare_window_months'"));

// The SAME literal existed a second time, on Step 2's own chart window control,
// and only the Compare one was briefed. Found by the driven German render check
// — `{size}M` renders identically in every locale, so nothing that compares
// bundle values could ever have seen it.
check('LITERAL: the Step 2 window sizes are keyed, not literal',
  !/\{size\}M/.test(whatIf),
  'the literal is back — see whatif_window_months');
check('LITERAL: whatif_window_months is used', whatIf.includes("t('whatif_window_months'"));

// The Step 2 chart legend showed "(Baseline)" / "(Adjusted)" in every locale —
// the same Recharts dataKey fallback item 4 fixed in Step 3. The fix must be a
// DISPLAY name, because measureKey's output is ALSO the exported column
// heading: translating it would give each locale different column names.
// So both halves are pinned — the key English and unchanged, the name keyed.
check('EXPORT: measureKey still emits the English column heading',
  whatIf.includes("if (measure === 'volume') return `${scenario} (${half})`;") &&
  whatIf.includes("return `${scenario} ${measure === 'revenue' ? 'Revenue' : 'ARPU'} (${half})`;"),
  'the export column headings must not vary by locale');
check('LEGEND: both Step 2 lines carry a display name',
  (whatIf.match(/name=\{measureDisplay\(t, kpi, activeMeasure, '(Baseline|Adjusted)'\)\}/g) ?? []).length === 2,
  'without name=, Recharts falls back to the dataKey and the legend reads English');
check('LEGEND: the display helper reads the locale, not the key',
  whatIf.includes("'whatif_series_baseline' : 'whatif_series_adjusted'"),
  'the half label must come from the bundle, not from the dataKey');

// ---------------------------------------------------------------------------
// 6. UAT-D2-01. Recharts falls back to the dataKey when a Line has no `name`,
//    so the Step 3 tooltip printed `inflowArpu_opt`. Every band line now names
//    itself from the locale, and the two that DID carry a name carried English.
// ---------------------------------------------------------------------------
const step3 = fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8');
const nameless = [...step3.matchAll(/<Line\b[^>]*?dataKey=\{`\$\{prefix\}_(opt|pess)`\}[^>]*?\/>/g)]
  .filter(m => !m[0].includes('name='));
check('TOOLTIP: no band Line falls back to its dataKey', nameless.length === 0,
  `${nameless.length} <Line> without name= — the tooltip would print the raw field`);

// The band pair is used twice — once per chart branch. The forecast/actual
// pair is used THREE times: twice on the Recharts lines, which drive the
// TOOLTIP, and once more inside the hand-written LEGEND that sits below the
// chart and maps over the scenarios itself.
//
// That third site is the point of these counts. The first pass at UAT-D2-01
// keyed the two Line props, the source checks went green, and the legend a few
// lines below still read "Inflow ARPU Forecast" in German — found only by the
// driven render check. A pair of separate render paths for the same words is
// exactly what a count pins and a boolean "is it keyed?" does not.
for (const [k, n] of [
  ['actuals_series_optimistic', 2], ['actuals_series_pessimistic', 2],
  ['actuals_series_forecast', 3],   ['actuals_series_actual', 3],
] as const) {
  const got = (step3.match(new RegExp(`t\\('${k}'\\)`, 'g')) ?? []).length;
  check(`TOOLTIP/LEGEND: ${k} used at every site`, got === n,
    `${got} vs ${n} — two Lines plus the hand-written legend`);
}
check('LEGEND: the Step 3 legend is keyed, not literal',
  !/\{scenarioLabel\(sc\)\} (Actual|Forecast)/.test(step3),
  'the hand-written legend has reverted to English');
check('MARKER: the forecast reference-line label is keyed',
  !step3.includes("value: 'Forecast →'") && step3.includes("t('actuals_forecast_marker')"));
for (const bad of ['`${scenarioLabel(sc)} Forecast`', '`${scenarioLabel(sc)} Actual`']) {
  check(`TOOLTIP: the hardcoded ${bad.includes('Forecast') ? 'Forecast' : 'Actual'} name is gone`,
    !step3.includes(bad));
}
for (const l of ['en', ...LOCALES]) {
  const d = read(l);
  const present = ['actuals_series_forecast', 'actuals_series_actual',
    'actuals_series_optimistic', 'actuals_series_pessimistic',
    'whatif_amount_unit_subs', 'whatif_amount_unit_pct',
    'compare_window_all_time', 'compare_window_months'].every(k => k in d);
  check(`NEW KEYS ${l}: all eight present`, present);
}

console.log(`i18n-parity spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
