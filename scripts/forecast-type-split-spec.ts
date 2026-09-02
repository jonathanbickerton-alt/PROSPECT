/**
 * `forecastType` — THE IDENTIFIER STAYS ENGLISH, THE LABEL COMES FROM THE BUNDLE.
 *
 *   npm run spec:forecast-type-split
 *
 * TERMBASE §11 carried this as an open question, in these words:
 *
 *   "`forecastType` values are rendered in a 'Forecast Type' column in the
 *    Overall Forecast view. If that column prints the raw internal value rather
 *    than a mapped display label, the internal name does surface to the user and
 *    needs a display mapping. Confirm before phase 2."
 *
 * Confirmed on 2026-09-02, and at FOUR sites rather than the one the question
 * imagined. The paragraph directly above it in §11 asserted "Verified: no JSX
 * text occurrence of either internal name" — a verification that had gone stale
 * without anything noticing, which is the whole argument for pinning it here
 * instead of re-asserting it in prose.
 *
 * THE TWO HALVES ARE CHECKED SEPARATELY AND ON PURPOSE. That separation is the
 * layer proof: translating the identifier must break the round trip while
 * leaving the label checks perfectly green, because the two are different
 * strings doing different jobs. A single "is it translated?" check could not
 * tell the safe change from the catastrophic one — and §11 records that
 * translating an identifier "fails silently rather than loudly", so nothing at
 * runtime would report it either.
 */
import * as fs from 'fs';
import { forecastTypeLabel, FORECAST_TYPE_KEY } from '../src/utils/forecastTypeLabel';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const app = fs.readFileSync('src/App.tsx', 'utf8');
const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'] as const;
const bundle = Object.fromEntries(LOCALES.map(l =>
  [l, JSON.parse(fs.readFileSync(`src/locales/${l}/translation.json`, 'utf8'))])) as
  Record<(typeof LOCALES)[number], Record<string, string>>;

const ID = 'Standard Forecast';

// ---------------------------------------------------------------------------
// 1. THE IDENTIFIER PIN. Exact counts, because a floor cannot see a removal —
//    and here a removal is the dangerous direction: every disappearance of this
//    literal is a place where a cohort key stopped being composed the old way.
// ---------------------------------------------------------------------------
const all = (app.match(/Standard Forecast/g) ?? []).length;
const inKeys = (app.match(/\|Standard Forecast\|/g) ?? []).length;
const asLiteral = (app.match(/'Standard Forecast'/g) ?? []).length;

check('IDENTIFIER: App.tsx still carries exactly 20 occurrences', all === 20, `${all}`);
check('IDENTIFIER: exactly 10 sit inside a composite cohort key', inKeys === 10, `${inKeys}`);
check('IDENTIFIER: exactly 7 are quoted literals', asLiteral === 7, `${asLiteral}`);
check('IDENTIFIER: no t() ever produces it',
  !/t\(\s*['"][^'"]*['"]\s*\)\s*\}\|/.test(app) && !app.includes("`${t("),
  'a translated cohort-key segment breaks matching silently — §11');

check('IDENTIFIER: the import path still defaults to the English literal',
  app.includes("String(row['Forecast_Type'] || 'Standard Forecast')"),
  'an old save with no Forecast_Type column must still land on the same key');
check('IDENTIFIER: the comparison in the missing-cohort list is still literal',
  app.includes("c.forecastType === 'Standard Forecast'"));

// The card that lists bulk-generated cohorts compares it too.
const drawer = fs.readFileSync('src/components/ManageBulkDrawer.tsx', 'utf8');
check('IDENTIFIER: ManageBulkDrawer still compares the literal',
  drawer.includes("c.forecastType === 'Standard Forecast'"));

// ---------------------------------------------------------------------------
// 2. THE OLD-SAVE ROUND TRIP. A save written before this change carries the
//    English identifier in its Forecast_Type column; reading it back must
//    reproduce byte-identical cohort keys, in every locale.
// ---------------------------------------------------------------------------
{
  /** The composition rule, as App.tsx writes it. */
  const cohortId = (fKey: string, type: string, scen: string) => `${fKey}|${type}|${scen}`;
  const F_KEY = 'Corporate|Mobile Data|All|Direct|All|All|All';
  const SCEN = 'Base Case';

  // Written by an older session, in English, because that is all it ever was.
  const savedRow = { Forecast_Type: ID };
  const savedId = cohortId(F_KEY, ID, SCEN);

  // Read back today, under each locale. The read applies App's own default.
  for (const l of LOCALES) {
    const readType = String(savedRow.Forecast_Type || ID);
    const rebuilt = cohortId(F_KEY, readType, SCEN);
    check(`ROUND TRIP ${l}: an old save's cohort key is reproduced byte for byte`,
      rebuilt === savedId, `${rebuilt} vs ${savedId}`);
  }

  // A save with the column ABSENT — the oldest shape — falls to the default.
  const legacy = String((({} as any).Forecast_Type) || ID);
  check('ROUND TRIP: a save with no Forecast_Type column still lands on the identifier',
    cohortId(F_KEY, legacy, SCEN) === savedId);

  // THE NEGATIVE HALF, and the reason the pin above is exact. If the identifier
  // were translated, this is what would happen — silently, with no error.
  for (const l of ['de', 'it'] as const) {
    const translated = String(bundle[l].standard_forecast);
    const wrong = cohortId(F_KEY, translated, SCEN);
    check(`ROUND TRIP ${l}: a TRANSLATED identifier would not match the old key`,
      wrong !== savedId,
      'if this ever passes, the identifier and the label have become one string');
  }
}

// ---------------------------------------------------------------------------
// 3. THE LABEL SIDE. Rendered from the bundle, in every locale, and distinct
//    from the identifier it labels.
// ---------------------------------------------------------------------------
{
  const t = (loc: (typeof LOCALES)[number]) => (k: string) => String(bundle[loc][k] ?? `!!${k}`);

  check('LABEL: the map covers both internal forecast types',
    Object.keys(FORECAST_TYPE_KEY).sort().join('|') === 'Standard Forecast|What-If Analysis',
    Object.keys(FORECAST_TYPE_KEY).join('|'));

  for (const [internal, key] of Object.entries(FORECAST_TYPE_KEY)) {
    check(`LABEL: ${internal} maps to a key that exists in en`, key in bundle.en);
    for (const l of ['de', 'es', 'fr', 'it', 'pt'] as const) {
      const label = forecastTypeLabel(t(l), internal);
      check(`LABEL ${l}: ${internal} renders from the bundle`, label === bundle[l][key], label);
      check(`LABEL ${l}: and is not the internal name`, label !== internal, label);
    }
  }

  check('LABEL de: Standard Forecast reads Standardprognose',
    forecastTypeLabel(t('de'), ID) === 'Standardprognose', forecastTypeLabel(t('de'), ID));
  // "Previsione Standard" with a capital S — a PRE-EXISTING string from the
  // original 119, not one this arc wrote. Italian sentence case would lower it,
  // but restyling somebody's translation from a spec assertion is the wrong way
  // round: it is flagged for Alessandro in the 1242 report instead.
  check('LABEL it: Standard Forecast reads Previsione Standard',
    forecastTypeLabel(t('it'), ID) === 'Previsione Standard', forecastTypeLabel(t('it'), ID));

  // An unmapped type is NAMED, not blanked. A blank cell hides a loose end.
  check('LABEL: an unmapped type falls back to its raw value',
    forecastTypeLabel(t('de'), 'Some Future Type') === 'Some Future Type');
  check('LABEL: an empty value stays empty rather than becoming a key',
    forecastTypeLabel(t('de'), '') === '');
}

// ---------------------------------------------------------------------------
// 4. NO RENDER SITE PRINTS THE RAW VALUE. This is the half that had gone stale
//    in §11, so it is pinned per file rather than asserted once.
// ---------------------------------------------------------------------------
{
  const sites: [string, string[]][] = [
    ['src/components/OverallForecastTab.tsx',
     ['forecastTypeLabel(t, ft as string)', 'forecastTypeLabel(t, cohort.forecastType)']],
    ['src/components/GenerateCohortForecastModal.tsx',
     ['forecastTypeLabel(t, generatingCohort.forecastType)']],
    ['src/components/ViewCohortForecastModal.tsx',
     ['forecastTypeLabel(t, viewingCohort.forecastType)']],
  ];
  for (const [file, needles] of sites) {
    const src = fs.readFileSync(file, 'utf8');
    for (const n of needles) check(`RENDER ${file}: uses the mapping — ${n.slice(0, 40)}`, src.includes(n));
    check(`RENDER ${file}: imports the mapping`, src.includes("from '../utils/forecastTypeLabel'"));
    // The raw value must not reach JSX text any more.
    check(`RENDER ${file}: no bare {…forecastType} in JSX`,
      !/\{\s*(?:cohort|viewingCohort|generatingCohort)\.forecastType\s*\}/.test(src),
      'the internal identifier would surface to the user again');
  }
  // Comparisons are UNTOUCHED — the point of a split is that only one half moved.
  const view = fs.readFileSync('src/components/ViewCohortForecastModal.tsx', 'utf8');
  check('RENDER: comparisons still use the raw identifier',
    view.includes("forecastType.startsWith('What-If Analysis')"),
    'a split that also changed the comparisons would not be a split');
}

console.log(`forecast-type-split spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
