# Working-agreement v3 — verified against the repo

## FOR ADVISOR

```
Generated: 2026-08-11 13:40 +0100 (UTC 2026-08-11 12:40)
Verified against: HEAD fc8b6fb, branch main, tree CLEAN. NO CODE CHANGED.
Repo: committed (this report is the session's only artefact), pushed (origin in sync)
27 of 28 NAMED HASHES VERIFIED: exist, ancestors of main, subjects consistent.
ONE CONTRADICTED: c1e0af0 IS NOT A COMMIT. The @types/react mechanism is 5a35ac7;
  the merge c1ef1a0 beside it is named correctly.
ALL SEVEN SYMBOLS VERIFIED: missingLeavesForKey :2192, hasAnyUsableForecast
  :2029, canShowBaseForecast :887, parseStoredMonths :926, restoreSeedKnown :949
  (forecasting.ts); forecastForStep1Selection viewFilter.ts:155; seedBaseKnown
  types/forecast.ts:281.
COUNTS VERIFIED on a fresh run: 30 spec:* suites all green; guard-traps 49/49;
  traps 3/3; tsc clean; build clean; i18n parity 0 missing / 10 deferred.
BOTH RULE PLACEMENTS VERIFIED: CLAUDE.md:108 report-trigger, :136 stability;
  report-writing carries the state-changing trigger vocabulary and the Repo line
  (:71); session-close step 4 is commit-and-push BEFORE the report. 4 skills.
PINS VERIFIED: setForecastData 7, setBaseForecast 12 (pin and site count both),
  traps 38/48/49/50/51 present. FIXTURES EXACT: 12,112 / 77,760 x2 / 90,720 x2 /
  12,432, twin caveat holds.
FOUR STALE FIGURES, drift not error: HEAD is fc8b6fb, not 0d4c40c (two
  report-only commits after; origin in sync).
  bulk_* keys are 54 with 51 de-identical, not "42 of 45" — debt is larger.
  Orphaned locale keys are 6, not 5 (Unit B added one).
  makeForecastKey is App.tsx:1512 — the doc's own correction (1505) is stale too,
  though the EXPECTED.md 1373 citation it flags IS still wrong.
Decisions needed: none. All six corrections are editorial.
State: read-only. Doc is sound; six corrections for the next revision.
```

---

## Method and scope

Verified against **HEAD `fc8b6fb`**, tree clean. The task named `0d4c40c`; that
commit is an ancestor, and the two commits since (`2dd7234`, `fc8b6fb`) touch
only `reports/`, so no code-bearing claim is affected. Where a figure differs
because of those two commits I say so rather than treating the doc as wrong.

Every claim below names the instrument. **NOT-CHECKABLE** is used for claims
about people, intent, or events outside the repo — not as a shelf for things I
could have checked and did not.

## 1. Commit hashes — 27 VERIFIED, 1 CONTRADICTED

Instrument: `git cat-file -e <h>^{commit}`, `git merge-base --is-ancestor <h> main`,
`git log -1 --format=%s`.

All of these exist, are ancestors of main, and carry subjects consistent with the
doc's description: `9177d9b c1ef1a0 631729c d1180ad c806370 eb036c6 6726d4c
52843af 2531585 67eca3b 4fb6b15 a39a6d0 18f6622 a51ec8e d4a7f8a ec77b34 f04ec6f
89f82dd ec3c79a a880356 1d0e921 abe1211 76c7c53 c161a42 f9b6fb4 676b3d2 0d4c40c`.

**CONTRADICTED — `c1e0af0` is not a commit in this repository.** §5 reads
"foundation-typecheck (c1e0af0-era @types/react gap, c1ef1a0)". `git cat-file`
returns no such object, and no commit hash in the repo begins `c1e0`.

The intended commit is almost certainly **`5a35ac7` — "Find the mechanism:
@types/react was never installed"**, which is the @types/react gap the sentence
describes. `c1ef1a0` (the merge) is named correctly beside it.

> **Correction:** "(c1e0af0-era @types/react gap, c1ef1a0)" → "(@types/react gap
> found at 5a35ac7, merged at c1ef1a0)".

## 2. Named symbols — all seven VERIFIED

Instrument: `grep -n "export function <name>"` / type-field grep.

| symbol | found at |
|---|---|
| `missingLeavesForKey` | `src/utils/forecasting.ts:2192` |
| `hasAnyUsableForecast` | `src/utils/forecasting.ts:2029` |
| `canShowBaseForecast` | `src/utils/forecasting.ts:887` |
| `parseStoredMonths` | `src/utils/forecasting.ts:926` |
| `restoreSeedKnown` | `src/utils/forecasting.ts:949` |
| `forecastForStep1Selection` | `src/utils/viewFilter.ts:155` |
| `seedBaseKnown: boolean` | `src/types/forecast.ts:281` |

`storedSeedKnown` (`:957`) also exists — the doc references it implicitly in §3's
seed-or-decline entry via `restoreSeedKnown`'s "value fallback", which is accurate.

## 3. Suite and trap counts — VERIFIED on a fresh run

Instrument: `package.json` script enumeration, then each suite run; `npm run
guard-traps`, `npm run traps`, `npm run lint`, `npm run build`, `scan-i18n`.

```
spec:* scripts            30      all green (restore-base green; it skips loudly if the save is absent)
guard-traps               49/49 caught
traps                     3 pass, 0 fail, 0 inconclusive
tsc --noEmit              clean
vite build                clean
scan-i18n LOCALE PARITY   0 missing (10 explicitly deferred)
```

§6's "30 spec suites green, guard-traps 49/49, traps 3/3, tsc clean, build clean,
i18n parity 0 missing" is **VERIFIED exactly**.

## 4. Rule placements — VERIFIED

Instrument: `grep -n` on `CLAUDE.md` and the skill files; heading enumeration.

- **Report-trigger rule** — `CLAUDE.md:108`, "### What triggers a report: CHANGED
  STATE, not the size of the task". VERIFIED, and it is inside the always-on
  reporting conventions as §2 claims.
- **Stability rule** — `CLAUDE.md:136`, "### COMMIT AND PUSH AT EVERY STABILITY
  POINT". VERIFIED.
- **report-writing skill** — carries the state-changing trigger vocabulary in its
  `description` (1 occurrence of the ALSO-TRIGGER clause), and the mandatory Repo
  line at `:71` in the FOR ADVISOR template. VERIFIED.
- **session-close skill** — `## 4. Commit and push — BEFORE the report`, with the
  report at `## 5`. VERIFIED: the ordering §2 describes is the skill's own
  sequence, not just prose.
- **Four skills present**: artefact-verification, fixture-handling,
  report-writing, session-close. VERIFIED.

## 5. Pins, traps and fixtures — VERIFIED

| claim | instrument | result |
|---|---|---|
| setForecastData pin 7 | `EXPECTED_WRITERS = 7` (walk-fixes-spec:468); 7 call sites in App.tsx | VERIFIED |
| setBaseForecast enumeration 12 | `EXPECTED_SITES = 12` (import-seam-spec:209); 12 call sites | VERIFIED |
| trap 38 pins the eighth-site door | trap id present in guard-traps.ts | VERIFIED |
| traps 48–50 constructed, 51 behavioural | all four ids present; 51 targets App.tsx's restore | VERIFIED |
| edge 12,112 | sheet row count | VERIFIED |
| Dec2025 files 77,760; Jun2026 files 90,720 | sheet row counts | VERIFIED — and the twin caveat holds: the counts identify the horizon, not the file |
| trimmed 12,432 | sheet row count | VERIFIED |
| server.ts tracked in git; excluded at the Docker layer | `git ls-files`; `.dockerignore` ~48–49 | VERIFIED |

## 6. Stale figures — drift, not error

These were true when written and have moved. Each is an editorial correction, not
a contradiction of substance.

**HEAD.** §§5–6 say "HEAD **0d4c40c**, committed and pushed (origin in sync)".
HEAD is **`fc8b6fb`**; `0d4c40c` is two commits back. Both later commits are
report-only (`2dd7234` the session report, `fc8b6fb` a FOR ADVISOR cap trim), so
every code claim still holds. Origin **is** in sync (`git log origin/main..main`
→ 0).

> **Correction:** HEAD `fc8b6fb`, or say "code state as at 0d4c40c" if the intent
> is to pin the last code-bearing commit.

**Translation debt figures.** §7 says "42 of 45 keys English-identical in de".
Measured now: **54 `bulk_*` keys, 51 identical in `de`**. The confirm-first and
three-intent copy added keys after that count was taken. The claim's substance —
translation debt on this surface, pre-dating the pivot — is stronger, not weaker.

> **Correction:** "51 of 54".

**Orphaned locale keys.** §7 says 5 from the copy rewrite. Measured: **6**
unreferenced keys — the five `bulk_*` ones plus `standard_base_series_not_derivable`,
orphaned by Unit B and deliberately left in the locales (§3 records the leaving,
but the §7 count was not updated).

> **Correction:** "6 orphaned locale keys (5 from the copy rewrite, 1 from Unit B)".

**Line citations.** Two are stale, both because this arc's own edits moved them:

| doc says | actual now |
|---|---|
| `forecasting.ts:1242–1244` (as-of gate + seed sum) | `const present = asOf !== null …` is at **:1352** |
| `arpuOf` "~1301" | **:1416** |
| `makeForecastKey` is App.tsx:1505 | **:1512** |

The **substance** of each is VERIFIED — the as-of gate and seed accumulation are
where described, `arpuOf`'s `?? 0` is as described, and EXPECTED.md does still
cite `App.tsx:1373` for `makeForecastKey`, so the drift §7 flags is real. But the
doc's own correction (1505) has itself drifted to 1512.

> **Correction:** drop the specific line numbers, or state them as "at time of
> writing". This is the third revision in which a line citation has gone stale;
> naming the symbol is durable, naming the line is not.

## 7. NOT-CHECKABLE

Claims outside the repo's reach. Listed so their absence from the verified set is
deliberate rather than an oversight.

- **Jon's on-screen verification of 2026-08-11** (§5: Base line present, ~124K,
  round trip stable, Step 1/Step 3 consistent, Step 2 unlocks on generation). A
  walk event. The repo can show the code supports each claim — `spec:restore-base`
  15/15 drives the real save — but not that the screen was seen.
- **Business users, UAT status, roadmap, Cloud Run / BigQuery / AISHA** (§1).
- **Usage economics** — "~87% of cost is the Opus main loop" (§2).
- **The two-tier advisor arrangement and model routing of the advisor chat** (§2).
- **"The synthetic-source generator lives on Jon's work laptop in Copilot"** (§7).
- **The 07 Aug save's 425/425 positive seeds** (§5) — checkable only while that
  file is on this machine, and it is not a repo artefact. It was measured in
  `2026-08-10-0923`; `spec:restore-base` re-drives the same file and is green,
  which is consistent, but the file could differ on another machine.
- **"AI capability parked on ai-capability branch pending prod approval"** — the
  branch exists on origin, but "pending prod approval" is a decision, not a fact
  the repo records.

## 8. Two claims worth a second look, both sound

Flagged because they are the kind that quietly go wrong, and both survived.

**"Aggregates never appear in a missing set"** (§3). VERIFIED by
`spec:generate-missing` (44/44), which includes an anti-vacuity control proving
the old and new populations genuinely differ — so the claim is not passing
because nothing is being tested.

**"Guard-traps run as ONE sequential instance … backgrounding the single instance
is explicitly permitted"** (§2). VERIFIED in both agent definitions
(`qa-tester.md`, `regression-guard.md`), including the amendment's reasoning — the
120s foreground timeout made "never background" an ignored rule. The doc renders
this accurately, including the part that was corrected rather than restated.

## Summary for the advisor

The document is **sound**. One hash is wrong, four figures have drifted, and
everything else checkable is verified against a fresh run.

Corrections, in the order they appear:

1. §5 — `c1e0af0` does not exist; use `5a35ac7` (mechanism) with `c1ef1a0` (merge).
2. §5/§6 — HEAD is `fc8b6fb`, not `0d4c40c` (two report-only commits later).
3. §7 — bulk_* translation debt is **51 of 54**, not 42 of 45.
4. §7 — **6** orphaned locale keys, not 5.
5. §7 — `makeForecastKey` is App.tsx:**1512** (EXPECTED.md's 1373 citation is
   still stale, so that item stands).
6. §5/§7 — line citations `1242–1244` and `~1301` are now `:1352` and `:1416`;
   recommend naming symbols rather than lines.
