/**
 * THE COMPLETION MODAL IS A COVERAGE STATEMENT, AND THE COPY SAYS ITS GRAIN.
 *
 *   npm run spec:coverage-copy
 *
 * Two failures of the same kind, which is why they are one spec: a number
 * displayed without the population it counts, and a heading describing the RUN
 * when the reader is asking about the RESULT.
 *
 * ── The modal ─────────────────────────────────────────────────────────────
 *
 * "Bulk generation complete" was true of the run and misleading about the book.
 * It read as "everything is forecast" while leaves were missing. Now the
 * heading reads the uncovered count: a run can finish cleanly and still leave
 * gaps, and that is the case the old heading hid.
 *
 * The panel also stacked two counters from DIFFERENT populations as though they
 * were two views of one number. `generated` counts chart series — the 5-part
 * Step 1 cohorts. `skipped` counts forecast leaves — the 7-part keys every
 * aggregate is summed from. "31,852 generated / 2 skipped" invited a
 * subtraction that means nothing. Both now name their grain, and both skip
 * wordings come from one enum.
 *
 * ── The cohort-months rename, and why it needed measuring first ───────────
 *
 * The design pass proposed renaming "{n} months compared" to "{n} cohort-months
 * compared" and explicitly declined to assert the grain was right, flagging it
 * as a check to run at build time rather than a fact. The check ran:
 * `summaryMape.monthsWithActuals` is
 * `perForecast.reduce((s, m) => s + m.monthsWithActuals, 0)` — a SUM ACROSS
 * MATCHING FORECASTS. Forty cohorts over six months reads 240. It is
 * cohort-months, the rename is correct, and the string had no i18n key at all
 * before this — hardcoded English, never translated in any locale.
 */
import * as fs from 'fs';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

const modal = fs.readFileSync('src/components/BulkGenerateModal.tsx', 'utf8');
const fva   = fs.readFileSync('src/components/ForecastVsActualsTab.tsx', 'utf8');
const dims  = fs.readFileSync('src/components/CohortDimCheckboxes.tsx', 'utf8');
const en    = JSON.parse(fs.readFileSync('src/locales/en/translation.json', 'utf8'));
const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'] as const;

// ── The grain claim, verified in source rather than assumed ───────────────
{
  const start = fva.indexOf('const summaryMape = useMemo');
  check('GRAIN ANCHOR: summaryMape was found', start !== -1,
    'renamed — this check is blind, fix it before trusting the label');
  const body = start === -1 ? '' : fva.slice(start, fva.indexOf('}, [forecastStore, activeFilter', start));
  check('GRAIN: monthsWithActuals SUMS across matching forecasts',
    /monthsWithActuals:\s*perForecast\.reduce\(/.test(body),
    'it no longer aggregates per forecast — the cohort-months label may now be wrong');
  // The label must follow the grain. If the sum ever becomes a distinct-month
  // count, this check and the copy have to move together.
  check('GRAIN: the label says cohort-months, matching that sum',
    /actuals_cohort_months_compared/.test(fva)
      && /cohort-months/.test(String(en['actuals_cohort_months_compared'] ?? '')),
    'label and grain disagree');
  check('GRAIN: the hardcoded English is gone from both KPI cards',
    !/month\{summaryMape\.monthsWithActuals !== 1/.test(fva),
    'a hardcoded, never-translated string remains');
  // It was rendered twice; both must be keyed or one locale silently keeps English.
  const occurrences = (fva.match(/actuals_cohort_months_compared/g) ?? []).length;
  check('GRAIN: both KPI card sites are keyed', occurrences === 2, `found ${occurrences}`);
}

// ── The modal as a coverage statement ─────────────────────────────────────
{
  check('MODAL: the heading is driven by what is UNCOVERED, not by run status',
    /const uncovered = skipped\.length \+ failed;/.test(modal)
      && /uncovered > 0/.test(modal),
    'the heading still reports that the run finished');
  check('MODAL: a run with gaps and a fully-covered run say different things',
    /bulk_complete_with_gaps/.test(modal) && /bulk_complete_full_coverage/.test(modal),
    'one heading for both outcomes');
  check('MODAL: the over-claiming heading key is gone from source AND locales',
    !/bulk_bulk_generation_complete/.test(modal) && !('bulk_bulk_generation_complete' in en),
    'the old heading is still reachable');

  // ONE SKIP VOCABULARY. The two populations may be counted separately - they
  // must be - but they may not be described in two different languages.
  check('MODAL: both uncovered counters name their grain',
    /bulk_complete_series_uncovered/.test(modal) && /bulk_complete_leaves_uncovered/.test(modal),
    'a counter is displayed without saying what it counts');
  check('MODAL: the generated counter names its grain too',
    /chart series/.test(String(en['bulk_complete_series_generated'] ?? '')),
    'the success counter is still grainless — the one most likely to be misread');
  check('MODAL: leaf and series wording are distinguishable',
    String(en['bulk_complete_leaves_uncovered'] ?? '') !== String(en['bulk_complete_series_uncovered'] ?? ''),
    'two populations described identically');
  check('MODAL: reasons come from the shared enum, not from local strings',
    /SKIP_REASON_KEY\[sk\.reason\]/.test(modal),
    'the modal has its own reason vocabulary again');
  check('MODAL: skipped leaves are still NAMED, not only counted',
    /skipped\.map\(sk =>/.test(modal) && /sk\.fKey/.test(modal),
    'the names were lost in the rewrite — the count alone cannot be acted on');
  // Anti-vacuity: the retired-aggregate notice from Session G must survive.
  check('MODAL: Session G\'s retired-aggregate notice is still present',
    /bulk_complete_retired/.test(modal),
    'a previous session\'s user-facing statement was dropped by this rewrite');
}

// ── The emphasis convention, kept while the grain was added ───────────────
// Found by the gate. The first version of this rewrite folded each count INTO
// the interpolated string to give it a grain, which silently dropped the
// <strong> the panel uses on every numeric row. The grain was the point; the
// emphasis did not have to be the price. Numbers stay bold and outside the
// string, grain nouns stay inside it.
{
  const rows = [
    ['generated', /<strong className="text-emerald-800">\{generated\}<\/strong>/],
    ['skipped leaves', /<strong className="text-amber-800">\{skipped\.length\}<\/strong>/],
    ['failed series', /<strong className="text-amber-800">\{failed\}<\/strong>/],
  ] as const;
  for (const [name, re] of rows) {
    check(`EMPHASIS: the ${name} count is bold, as every numeric row in this panel is`,
      re.test(modal), 'the count lost its emphasis when it gained its grain');
  }
  // And the grain must still be there — otherwise this could be "fixed" by
  // reverting to the old grainless markup, which passes the checks above.
  check('EMPHASIS: the grain survived alongside the emphasis',
    /chart series/.test(String(en['bulk_complete_series_generated'] ?? ''))
      && /forecast leaves/.test(String(en['bulk_complete_leaves_uncovered'] ?? '')),
    'the emphasis was restored by reverting the grain');
  // Singular form, because "1 forecast leaves" is the tell that a plural was
  // bolted on rather than written.
  check('EMPHASIS: the leaf row has a singular form',
    /bulk_complete_leaves_uncovered_one/.test(modal)
      && /forecast leaf /.test(String(en['bulk_complete_leaves_uncovered_one'] ?? '')),
    'one skipped leaf reads as "1 forecast leaves"');
}

// ── The copy batch ────────────────────────────────────────────────────────
{
  check('COPY: MAPE cards carry a lower-is-better subtitle',
    /actuals_mape_lower_is_better/.test(fva)
      && /lower is better/i.test(String(en['actuals_mape_lower_is_better'] ?? '')),
    'MAPE is still presented without saying which direction is good');
  check('COPY: "(not mapped)" is now "(not available in this view)"',
    String(en['cohortdims_not_mapped'] ?? '') === '(not available in this view)',
    `got ${JSON.stringify(en['cohortdims_not_mapped'])}`);
  check('COPY: and the key is still the one the checkbox list renders',
    /cohortdims_not_mapped/.test(dims),
    'the copy was changed on a key nothing reads');
}

// ── Every new key exists in all six locales ───────────────────────────────
{
  const NEW = ['bulk_complete_full_coverage', 'bulk_complete_with_gaps',
    'bulk_complete_series_generated', 'bulk_complete_leaves_uncovered',
    'bulk_complete_series_uncovered', 'bulk_complete_leaves_uncovered_one',
    'actuals_cohort_months_compared',
    'actuals_mape_lower_is_better'];
  const DEAD = ['bulk_bulk_generation_complete', 'bulk_leaves_no_forecast',
    'bulk_skipped_insufficient_data_points'];
  for (const loc of LOCALES) {
    const d = JSON.parse(fs.readFileSync(`src/locales/${loc}/translation.json`, 'utf8'));
    const missing = NEW.filter(k => !(k in d));
    check(`LOCALE ${loc}: all new keys present`, missing.length === 0, missing.join(','));
    const lingering = DEAD.filter(k => k in d);
    check(`LOCALE ${loc}: retired keys removed`, lingering.length === 0, lingering.join(','));
  }
}

console.log(`coverage-copy spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL ' + f));
process.exit(fails.length ? 1 : 0);
