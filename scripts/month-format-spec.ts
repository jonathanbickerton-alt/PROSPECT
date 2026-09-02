/**
 * MONTH LABELS FOLLOW THE APP'S LANGUAGE.
 *
 *   npm run spec:month-format
 *
 * A FORMATTED DATE IS INVISIBLE TO A TRANSLATION CHECK, which is the whole
 * reason this needed its own fix and its own spec. `spec:i18n-parity` compares
 * bundle values; "Oct 2026" is not in any bundle, so no amount of translating
 * could have reached it and no parity run could have flagged it. The 1028 sweep
 * saw it on screen in German — axis reading "Oct 2026" under a German heading —
 * and logged it as needing a formatter rather than a key.
 *
 * The assertions are `includes`, not equality, on purpose: date-fns writes
 * German abbreviations with a trailing point ("Okt. 2026") and Italian without
 * ("ott 2026"). Pinning the exact punctuation would make this spec fail on a
 * date-fns upgrade that changed nothing anyone can see, which is how a spec
 * teaches people to ignore it.
 */
import * as fs from 'fs';
import { monthLabel, dateLocaleFor } from '../src/utils/monthFormat';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

// The two months the brief names, because they are the two that differ most
// visibly from English and so are the ones a reviewer will look for.
const CASES: [string, string, string[]][] = [
  ['de', '2026-10', ['Okt']],
  ['de', '2026-12', ['Dez']],
  ['it', '2026-10', ['ott']],
  ['it', '2026-12', ['dic']],
  ['es', '2026-01', ['ene']],
  ['fr', '2026-12', ['déc']],
  ['pt', '2026-10', ['out']],
  ['en', '2026-10', ['Oct']],
];
for (const [lang, month, wanted] of CASES) {
  const got = monthLabel(month, lang);
  for (const w of wanted) {
    check(`${lang}: ${month} renders "${w}"`, got.includes(w), got);
  }
  check(`${lang}: ${month} keeps the year`, got.includes('2026'), got);
}

// The English months must NOT survive into a translated label — the actual
// defect, stated as a negative so it cannot pass by coincidence.
for (const lang of ['de', 'it', 'es', 'fr', 'pt']) {
  check(`${lang}: October is not "Oct"`, !monthLabel('2026-10', lang).includes('Oct'),
    monthLabel('2026-10', lang));
  check(`${lang}: December is not "Dec"`, !monthLabel('2026-12', lang).includes('Dec'),
    monthLabel('2026-12', lang));
}

// A regioned tag resolves to its primary language. Getting this wrong would
// fall back to English for every regioned locale and look exactly like the bug.
check('de-DE resolves to German', monthLabel('2026-10', 'de-DE').includes('Okt'),
  monthLabel('2026-10', 'de-DE'));
check('pt-BR resolves to Portuguese', monthLabel('2026-10', 'pt-BR').includes('out'),
  monthLabel('2026-10', 'pt-BR'));
check('an unknown language falls back to English, not to nothing',
  monthLabel('2026-10', 'zz').includes('Oct'), monthLabel('2026-10', 'zz'));
check('undefined falls back to English', monthLabel('2026-10', undefined).includes('Oct'));
check('dateLocaleFor never returns undefined', !!dateLocaleFor('zz') && !!dateLocaleFor(undefined));

// Unparseable input comes back unchanged rather than as "Invalid Date".
for (const bad of ['', 'not-a-month', '2026', '2026-13-99']) {
  const got = monthLabel(bad, 'de');
  check(`unparseable ${JSON.stringify(bad)} is returned unchanged`,
    got === bad || !/Invalid/.test(got), got);
}

// The card must USE it — a formatter nothing calls is not a fix.
{
  const card = fs.readFileSync('src/components/WhatIfTab.tsx', 'utf8');
  check('WhatIfTab imports the locale-aware formatter',
    card.includes("from '../utils/monthFormat'"));
  check('WhatIfTab binds fmtMonth to the active language',
    card.includes('monthLabel(m, i18n.language)'));
  check('WhatIfTab reads i18n from useTranslation',
    card.includes('const { t, i18n } = useTranslation();'));
  check('the English-only module formatter is gone',
    !/function fmtMonth\(m: string\) \{/.test(card),
    'a module-scope formatter cannot know the app language');
  // COMMENTS STRIPPED — the retired formatter is QUOTED in a comment where it
  // used to live, deliberately, so the next reader sees what was wrong. The
  // first version of this check matched that quotation and reported the defect
  // it was written to prove absent. Same trap as the reason-union parse in
  // mix-refusal-copy-spec, twice in one session.
  const cardCode = card.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check("no chart formats 'MMM yyyy' without a locale",
    !/format\([^)]*'MMM yyyy'\)/.test(cardCode),
    'that call is English regardless of the app language');
  check('ANCHOR: the comment-stripped source is still substantial',
    cardCode.length > card.length * 0.4,
    'if stripping ate the file, the check above would pass vacuously');
  // The tick formatter is still wired to the axis.
  check('the Step 2 axis still uses fmtMonth', card.includes('tickFormatter={fmtMonth}'));
}

console.log(`month-format spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
