/**
 * A NAV ITEM'S LABEL AND ITS DESTINATION ARE ASSERTED TOGETHER.
 *
 *   npm run spec:nav-target
 *
 * The top-nav item labelled `standard_forecast` set `activeView('overall')`.
 * Both halves were individually correct — the label named a real screen, the
 * target named a real screen — and they named DIFFERENT screens. Nothing that
 * checks one half can see that, which is why they are checked as a pair here.
 *
 * The label moved, not the target. That site is the ONLY one setting 'overall'
 * (`setActiveView('standard')` has six), so repointing it would have made the
 * Overall Forecast view — and the Generate Missing door on it — unreachable.
 *
 * These are source assertions rather than mounted ones: the nav lives in App's
 * own JSX and App cannot be mounted headlessly here. The pairing is what earns
 * its keep, not the mechanism.
 */
import * as fs from 'fs';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const app = fs.readFileSync('src/App.tsx', 'utf8');
const en = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'] as const;

/** Each nav button: the view it targets, and the key it renders. */
function navPairs(): { view: string; key: string }[] {
  const out: { view: string; key: string }[] = [];
  const re = /setActiveView\('([a-z]+)'\)\}[\s\S]{0,900}?\{t\('([a-z_]+)'\)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(app))) out.push({ view: m[1], key: m[2] });
  return out;
}

const pairs = navPairs();
check('ANCHOR: nav pairs were found at all', pairs.length >= 3,
  `${pairs.length} — the matcher is broken, not the code`);

const overall = pairs.find(p => p.view === 'overall');
check('PAIR: a nav item targets the overall view', !!overall,
  'the Overall Forecast view has no door — Generate Missing is unreachable');

// THE PAIRING. Either half alone looks fine; only together do they disagree.
check('PAIR: and its label names THAT view, not another one',
  !!overall && overall.key === 'nav_overall_forecast',
  overall ? `labelled '${overall.key}'` : 'n/a');
check('PAIR: the label text actually says what it goes to',
  /overall/i.test(String(en['nav_overall_forecast'] ?? '')),
  `got ${JSON.stringify(en['nav_overall_forecast'])}`);

// Anti-vacuity: the old mislabel must be detectable, or the check above passes
// for any key at all.
check('PAIR CONTROL: the previous label would NOT satisfy this',
  !/overall/i.test(String(en['standard_forecast'] ?? '')),
  'the old label also reads as "overall" — the pairing check cannot fail');

// Step 1 keeps its routes; the fix must not have taken one away.
// Counted across src/, not App.tsx alone: most of Step 1's routes are in
// components that receive setActiveView as a prop. Scoping this to App.tsx
// found 2 and failed a claim that is true of the codebase.
const srcFiles = ['src/App.tsx', 'src/components/HomeTab.tsx',
  'src/components/WhatIfTab.tsx', 'src/components/ForecastVsActualsTab.tsx'];
const allSrc = srcFiles.map(f => fs.readFileSync(f, 'utf8')).join(' ');
const step1Routes = (allSrc.match(/setActiveView\('standard'\)/g) ?? []).length;
check('ROUTES: Step 1 still has several routes in', step1Routes >= 5,
  `${step1Routes} across ${srcFiles.length} files — the label fix should not have touched these`);
const overallRoutes = (app.match(/setActiveView\('overall'\)/g) ?? []).length;
check('ROUTES: the overall view still has exactly one', overallRoutes === 1,
  `${overallRoutes} — if 0, the Generate Missing door is gone`);

for (const loc of LOCALES) {
  const d = JSON.parse(fs.readFileSync(`src/locales/${loc}/translation.json`, 'utf8'));
  check(`LOCALE ${loc}: nav_overall_forecast present`, 'nav_overall_forecast' in d);
}

console.log(`nav-target spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
