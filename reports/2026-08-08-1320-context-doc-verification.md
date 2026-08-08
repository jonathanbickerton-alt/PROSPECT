# Context-document verification — "PROSPECT — Development History & Working Agreement"

## FOR ADVISOR

```
Generated: 2026-08-08 13:20 +0100 (UTC 2026-08-08 12:20)
Verified against: HEAD 89f82dd935ee644e45c0215218ee0eed9a36fd1f, branch main, tree CLEAN
Counts: VERIFIED 47 | CONTRADICTED 5 | NOT-CHECKABLE 31
ROOT CAUSE OF ALL FIVE: the doc is dated "post Session K"; HEAD is two merges later
  (Session L, ec77b34) — every contradiction is staleness, none is a wrong claim about K.

C1 §6 "OPEN — walk finding C-17" — C-17 is FIXED and merged (Session L, ec77b34).
   -> "CLOSED — walk finding C-17, fixed in Session L (ec77b34): the Step 1 panel now
      derives from the store via stdPanelRows, so restore needs no writer."
C2 §5/K "showResolvedAggregate now populates forecastData" — it no longer does.
   -> "showResolvedAggregate sets baseForecast only; Session L made the panel derive,
      removing that write rather than adding a third one."
C3 §5/K "23 suites green, guard-traps 32/32" — measured 23 suites / 786 checks, 33/33.
   -> "23 suites green (786 checks), guard-traps 33/33."
C4 §6 "Walk position: resumes at A step 8 (third attempt)" — superseded.
   -> "resumes at C step 17; A 8-10 re-mounted and verified in Session L."
C5 §7 "8,925 noImplicitAny errors sized" — measured 22 (--noImplicitAny), 23 (--strict),
   0 baseline. Instrument: npx tsc --noEmit --noImplicitAny at HEAD.
   -> either restate as a historical measurement with its commit, or "~22 at HEAD".

VERDICT: INSTALL WITH LISTED CORRECTIONS
```

---

## Provenance

`git rev-parse HEAD` → `89f82dd935ee644e45c0215218ee0eed9a36fd1f`; `git branch
--show-current` → `main`; `git diff --quiet HEAD` → clean. Nothing was edited:
this run made no writes outside this report file.

**The document's own header says "Last updated: 2026-08-08 (post Session K
merge; walk finding C-17 open)".** HEAD is two merges past that point —
`ec77b34 Merge Session L` and `89f82dd Record the Session L merge`. All five
contradictions below descend from that single fact. The document is not wrong
about Session K; it is a correct snapshot of a superseded state, which is
exactly the failure mode its own opening line warns about ("a stale copy
silently applied is worse than no copy").

---

## 1. Commits (§5) — all 15 VERIFIED

`git cat-file -e <h>^{commit}` + `git merge-base --is-ancestor <h> main` +
`git log -1 --format=%s`. Every hash resolves, every one is an ancestor of
`main`, every subject is consistent with the doc's description.

| hash | ancestor | subject | doc description | verdict |
|---|---|---|---|---|
| 9177d9b | yes | Merge phase0-skip-reporting: name the leaves a bulk run skips | "Phase 0 named-skip amber panel" | VERIFIED |
| c1ef1a0 | yes | Merge foundation-typecheck: restore the compiler to component state | "@types/react never installed" | VERIFIED |
| 631729c | yes | Merge phase1-provenance: modelUsed and fittedParams into a provenance union | "Phase 1 provenance union" | VERIFIED |
| d1180ad | yes | Merge session-a-derive-aggregate: the derivation core | "Session A deriveAggregate + quadrature core" | VERIFIED |
| c806370 | yes | Merge session-b1-resolve-forecast: the seam, built but unwired | "B1 resolveForecast seam unwired" | VERIFIED |
| eb036c6 | yes | Merge Session B: the seam, wired — read-time derivation for aggregates | "Session B seam wired everywhere" | VERIFIED |
| 6726d4c | yes | Merge Session C: delete the borrow-a-neighbour fallbacks in the table | "Session C boundary 1" | VERIFIED |
| 52843af | yes | Merge Session D: the chart-side deletions and the guards that hold them | "Session D merged" | VERIFIED |
| 2531585 | yes | Merge Session E: export buildCohortAccuracy, close the leaf-grain gap | "Session E (buildCohortAccuracy exported)" | VERIFIED |
| 67eca3b | yes | Merge Session F: close the NaN gap at both levels, delete chartData | "Session F (two-level NaN gap; chartData deleted)" | VERIFIED |
| 4fb6b15 | yes | Merge Session G: fit-on-aggregate retired, and the seam made the only door | "Session G merged" | VERIFIED |
| a39a6d0 | yes | Merge Session H: an aggregate selection generates its leaves | "Session H merged" | VERIFIED |
| 18f6622 | yes | Merge Session I: coverage statement, copy batch, one population for the chart | "Session I merged" | VERIFIED |
| a51ec8e | yes | Merge Session J: the four defects Jon's walk found at section A | "Session J merged (all four walk defects)" | VERIFIED |
| d4a7f8a | yes | Merge Session K: the panel gate, and the machine's scope | "Session K merged" | VERIFIED |

Also checked because §5 names it: **e3ee2f0** resolves, is an ancestor, subject
`Record the Session F merge` — consistent with "design pass approved off
e3ee2f0". VERIFIED.

## 2. Symbols and seams (§1, §3, §5)

| claim | instrument | verdict |
|---|---|---|
| `makeForecastKey` exported once, App delegates | `forecasting.ts:1852` sole `export function`; `App.tsx:6` imports it as `sharedMakeForecastKey`; `App.tsx:1504` `const makeForecastKey = sharedMakeForecastKey;` | VERIFIED |
| `resolveForecast` exists | 39 refs; a `useCallback` closure in App (doc claims no export) | VERIFIED |
| `resolveFromStore(store, leafMap, key)` pure | `forecasting.ts:2105`, exactly that signature, module-level, no React imports in scope | VERIFIED |
| `deriveAggregate` | `forecasting.ts:1211`, exported | VERIFIED |
| `isRetiredAggregateFit` at the seam | `forecasting.ts:1912` exported; called inside `resolveFromStore` (`:2110` region) and `canResolve` | VERIFIED |
| `restrictToLeafKeys` | `App.tsx:3905` option decl; `:3963` filters targets; `:2163` the Step 1 call | VERIFIED |
| `buildCohortAccuracy` exported | `ForecastVsActualsTab.tsx:605` `export function` | VERIFIED |
| **`showResolvedAggregate` writes `forecastData`** | body contains `setBaseForecast` + `setNotice` only; **no `setForecastData`** | **CONTRADICTED — C2** |
| `applyEventsToMonth` | `forecasting.ts:1731`, exported | VERIFIED |
| `buildRollUpIndex` | `forecasting.ts:2159`, exported | VERIFIED |
| top-level `ErrorBoundary` | `src/main.tsx:5` import, `:12`–`:14` wraps the app | VERIFIED |
| `provenanceModel()` returns null, never a default | `types/forecast.ts:233-235`: `p.kind === 'derived' ? null : p.modelUsed` | VERIFIED |
| four models SES / Holt Linear / Damped Trend / Holt-Winters | `types/forecast.ts`, all four literals present | VERIFIED |
| `bulk_complete_retired` states it on screen | 1 use in `BulkGenerateModal.tsx`, key present in `en/translation.json` | VERIFIED |

**`chartData` deleted (rename test):** VERIFIED with a scoping note. The dead
`ForecastVsActualsTab` memo is gone — `FvA:2026` reads
`// ── chartData DELETED — it was dead code`. Instrument: `grep -rn "\bchartData\b"
src/ --include=*.ts --include=*.tsx`, which covered all of `src/`. Of 39 exact
matches, all in `ForecastVsActualsTab.tsx` are prose comments about the deletion
plus one unrelated local property at `:2643`. **There is, however, a live and
unrelated `const chartData` in `ScenarioCompareTab.tsx:194`** — so the doc's
scoped phrasing is right, and a future edit must not shorten it to "chartData no
longer exists", which would be false.

## 3. Counts at HEAD — measured, not copied

I ran the suites; I did not fall back to a gate artefact.

- **23 suites**, all green, **786 checks total**. My first enumeration regex
  `"spec:[a-z-]+"` returned **22** and silently omitted `spec:step1-panel`
  because the character class excluded digits — the standing rule biting the
  verifier. Corrected instrument: `grep -oE '"spec:[a-z0-9-]+":' package.json`.
  Recording it because an enumeration is only evidence about what it found.
- `npm run guard-traps` → **33/33 caught**.
- `npm run traps` → 3 pass, 0 fail, 0 inconclusive.
- `npx tsc --noEmit` → 0 errors.

Doc says "23 suites green, guard-traps 32/32". Suite count VERIFIED; trap score
**CONTRADICTED — C3** (Session L added trap 35 and retired 28/31).

## 4. EXPECTED.md and agents (§4, §6)

- **74/72/2** — `EXPECTED.md:5282`, "74 leaves, 72 fit, 2 skipped". VERIFIED.
- **C-17 entry** — `EXPECTED.md:5004`, "A restored session never rendered in
  Step 1 — **DESIGN GAP, 2026-08-08**". Present, but recorded as a *closed*
  design gap, not an open finding. Feeds **C1**.
- **Six agent definitions with model frontmatter**: debugger sonnet,
  dependency-mapper sonnet, qa-tester sonnet, regression-guard sonnet,
  ui-consistency haiku, ux-design opus. CLAUDE.md's routing table lists the same
  six with the same models. VERIFIED (instrument covered all of
  `.claude/agents/*.md`).
- **§4 standing rules vs EXPECTED.md** — diff of substance. Every §4 rule has a
  counterpart: provenance/artefact-provenance, no-figure-for-an-unopened-
  population, surface-not-store (incl. the mount-above-every-gate extension
  added in Session K), enumeration-is-not-absence, introduced-vs-pre-existing
  with the blast-radius corollary, planted-violation, removal test, rename test,
  JSON.stringify/NaN (in `qa-tester.md` as the doc says), deployment-layer
  translation, marker-is-not-the-thing, third-instance. **No §4 rule is absent
  from the repo's records. One repo rule is arguably under-represented in §4:**
  the reserved-decisions rule in `CLAUDE.md` ("a decision stays reserved even
  where the answer looks self-evident") has no §4 line — a gap in the doc, not a
  contradiction. Worth adding.

## 5. Structure claims

| claim | instrument | verdict |
|---|---|---|
| `server.ts` tracked in git | `git ls-files` → `server.ts` | VERIFIED |
| exclusion at the Docker layer, not gitignore | **`.dockerignore:48-49`**: `# Local-only Express dev server — never part of the production image.` / `server.ts`. Not in `.gitignore`. | VERIFIED — but the doc says "the Dockerfile"; the line is in **`.dockerignore`**. Precision note, not a contradiction of substance |
| `.xlsx` untracked | `git ls-files \| grep -c "\.xlsx$"` → **0**; responsible line **`.gitignore:15` `/test-data/*.xlsx`**; also `.dockerignore:19` keeps them out of the build context | VERIFIED |
| fixture builder committed and deterministic | `scripts/build-trimmed-fixture.mjs` tracked; `grep -l "Math\.random"` over `scripts/build-*.mjs` returned no match | VERIFIED for the *trimmed* builder. The edge fixture's generator is not in the repo — the doc says so itself ("lives on Jon's work laptop in Copilot"), so this is internally consistent |
| `ai-capability` branch exists | `git branch -a --list "*ai-capability*"` → local `ai-capability` and `remotes/origin/ai-capability` | VERIFIED |
| legacy pre-option-C import NOT routed through the retirement rule | `App.tsx`, comment `// RAW ON PURPOSE - the retirement rule must NOT be applied here`, followed by `setBaseForecast(restoredBf)` with no rule call | VERIFIED |
| reports named `<yyyy-mm-dd-HHMM>-<topic>.md` | 23 files; **20 conform, 3 do not** — `2026-08-05-b3-mix-panel-filterbar.md`, `2026-08-05-b3-walk-grading.md`, `2026-08-05-session-b-merged.md`, all predating the HHMM amendment | VERIFIED going forward; the three legacy names are consistent with the convention having been added later |
| fixture row counts (§2): edge 12,112; Dec2025 77,760; Jun2026 90,720 | measured on the **local working copy** (files are untracked, so this is not a repo fact): edge **12112**; both Dec2025 files **77760**; both Jun2026 files **90720** | VERIFIED, instrument named |

## 6. Open-item sanity (§6)

**C1 — the material finding.** §6 lists C-17 as OPEN with a fix "drafted". On
`main` it is **fixed and merged**: `ec77b34 Merge Session L: the Step 1 panel
derives from the store`. Instruments: `App.tsx:3383` `const stdPanelRows =
useMemo`; `App.tsx:4443` `forecastData={stdPanelRows}`; and the restore branch
contains **zero** `setForecastData` calls — by design, because the panel derives
rather than being written. §6's own proposed approach ("store-derived panel
visibility via one resolver, not a third writer") is precisely what shipped.

**C4.** §6's "Walk position: resumes at A step 8 (third attempt)" is superseded.
Session L re-mounted A 8–10 and C-17 and moved the resume point to **C step 17**
(`reports/2026-08-08-1246-session-l-panel-derives.md`).

**Nothing listed as merged is missing** — all 15 §5 hashes are ancestors of main
(§1 above).

**Two subsidiaries §6 lists as queued are also done** in Session L: the
placeholder/button contradiction (placeholder stands down for
covered/blocked/never) and the covered-state red styling (now the file's own
`bg-slate-200 text-slate-400`). The third, unfittable-set state after restore, is
resolved and documented (it resets, deliberately).

**C5 — §7 "8,925 noImplicitAny errors sized".** Measured at HEAD:
`npx tsc --noEmit --noImplicitAny` → **22** errors; `--strict` → 23; baseline → 0.
`tsconfig.json` sets neither `strict` nor `noImplicitAny`. I cannot reconcile
8,925 with any flag combination I tried, and I am not assuming the figure was
wrong when written — it may have been measured before `c1ef1a0` installed
`@types/react`, which the doc itself says made "every state binding `any` from
day one". That would plausibly produce a number of that order. Recommend
restating it as a historical measurement with its commit, or replacing it with
the current figure.

## 7. NOT-CHECKABLE (31)

Listed, not guessed at. These live outside the repo:

**People and product intent (§1, §2):** Jon writes no application code; origin in
Google AI Studio and the migration reason; Alessandro Russo and Marcel Wiegand as
business users; "in testing, not yet UAT — numbers unused"; the UAT bar; the
roadmap (Cloud Run, BigQuery, AI Booster, four AI use cases, AISHA closing the
loop); "AI capability parked pending prod approval" (the *branch* is verified;
the approval status is not).

**Advisor-chat process (§2):** the two-tier structure and Fable 5 assignment;
"nearly every turn ends in a pastable prompt"; reports attached as uploads
because long pastes arrive empty; "reports are per-chat uploads, never project
context"; the session-close ritual.

**Walk events and screenshots (§2, §6):** the screenshot-gated step-zero ritual;
the C-17 screenshots; the flagged Base-Forecast-near-zero observation awaiting
Jon's read; "the leaf-selection screenshot never arrived"; step 23 being the one
check only Jon's eyes can make; the three walk defects Session B's walks caught;
"his console screenshot diagnosed in three lines what a full headless session
couldn't".

**Usage panel (§2):** "~87% of cost is the Opus 5 main loop (panel attribution
verified honest, no bug)". Not visible from inside the repo. Note for the
record: a session audit on 2026-08-08 found all six agent `model:` fields present
and correct and no overriding setting, and could not determine from inside
whether the override is applied or the panel merely attributes subagent tokens to
the session line.

**Historical/measured-elsewhere figures (§3, §5, §7):** the 28.5× bulk speedup;
540 leaves vs 31,856 enumerated; write-time rejection figures (14.7× inflation,
~1.5GB export); "bands narrow 38–40% under quadrature"; "31 consumer sites";
Session B's eleven sub-sessions; the −2.06%/+2.20% artefact measurement (measured
against Jon's save file, which is not in the repo); "540/541 unchanged"; the
promoRebanded 25.18-vs-25.00 gap; "the synthetic-source generator lives on Jon's
work laptop".

---

## Recommendation

**INSTALL WITH LISTED CORRECTIONS.** The document is accurate about everything it
claims for Sessions A–K, and the five contradictions are all one thing: it
predates Session L. The two that matter most in persistent context are **C1** and
**C2** — an advisor reading C-17 as open would draft a fix session for work
already merged, and C2 states a behaviour the code no longer has.

Two additions worth making while correcting: a §4 line for the reserved-decisions
rule, and the Session L entry in §5.
