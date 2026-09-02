# Locale follow-up — mix refusals, identifier split, axis dates

## FOR ADVISOR

```
Generated: 2026-09-02 12:42 +0100 (UTC 2026-09-02 11:42)
Certifies: __HASH__
Repo: __REPO__
__PENDING__
```

---

## Base check

`HEAD` **`fe0fae3`**; the 1028 report's Repo line names **`59731fa`**. Two commits
apart, both **report-only**, and
`git diff --stat 59731fa..HEAD -- src/ scripts/ test-data/ package.json` is
**empty**. The STOP condition did not fire.

## Item 1 — mixConstraint's seventeen refusal reasons

### The premise is refuted, and the refutation is mine to own

**The seventeen strings are not user-facing.** The 1028 report called them
*"the mix card's refusal reasons — genuinely user-facing"*, this brief inherited
that, and it is wrong.

`mixConstraint.ts` carries a comment saying so, written before the mistake and
anticipating it almost word for word:

> `detail` strings on every blocked outcome below are **DIAGNOSTIC ONLY and are
> never rendered**. The card branches on `reason` and renders its own keyed copy
> through `t()`, in all six locales; nothing puts `detail` on screen, verified by
> grep across `src/components/` and `src/App.tsx`.
>
> *Stated because the i18n scanner flags them as must-key and a future reader
> would otherwise have to re-derive whether that is a real gap. It is not — but
> the moment one of these is rendered, it becomes one.*

I was that future reader, and I re-derived it wrongly by reading the scanner's
`MUST KEY` label instead of the module.

**Verified independently rather than taken on trust**, because a stale comment
asserting safety is exactly the shape this codebase has been bitten by:

| Check | Result |
|---|---|
| Components importing `mixConstraint` | `WhatIfTab.tsx` only (plus `forecasting.ts`, which imports `blendedArpu` alone) |
| `.detail` reads in `WhatIfTab.tsx` | **0** |
| Outcome bindings in the card | `out`, `outcome` — **0** `.detail` reads on either |
| What the card renders instead | `reason` → `whatif_mix_bound_above` / `_below` / `_target_blocked_other`, all keyed |

**So keying them would have been 17 × 6 = 102 translations of strings nothing
can display**, plus seventeen entries on the parity spec's surface — work that
makes the codebase worse while looking like diligence.

### What the hunt found instead — five that ARE rendered

Twenty lines from the mix engine, in the same file the hunt led to,
`groupByCampaign` assigns five English sentences to `g.reason`:

```tsx
g.reason = 'Percentage events are edited individually, not as a campaign spread';
g.reason = 'Events in this campaign target different scenarios or cohorts — edit rows individually';
g.reason = 'Multi-month ARPU campaigns cannot be edited as a spread — edit rows individually';
g.reason = 'Campaign spans more than 24 months — edit rows individually';
g.reason = 'Campaign has an invalid month — edit rows individually';
```

They render at two sites as `title={group?.reason || campaignLabel}` — **the
tooltip a user hovers to find out why the edit pencil is greyed out**. English in
all six locales.

**Now keys, resolved at the render site**, not sentences translated in
`groupByCampaign`: that function is module-level and has no `t`, but the better
reason is item 2's — a data structure carries the identifier, the component
renders the display form. `percentage-events-spec` asserted the English
sentence and is re-aimed at the key.

### The enforcement, which is the half of item 1 worth keeping

The brief's diagnosis of *why* seventeen went untracked is exactly right, and the
cause is one line: **`scan-i18n` only enforces under `--check`, and nothing ran
it with the flag.** All the failure logic was already written.

Three things stood between `--check` and a clean exit, and all three are fixed:

1. **A false positive that would have made the gate un-passable.** The
   identifier-position rule flagged `const parts: string[] = [t(…)]` in
   `promoEventSummary` as *"array bound as key list"*. Its own comment says
   `.join()`/`.map()` mean display — but the upward walk stops at the variable
   binding, and the join happens *later in the function*, not above the array in
   the tree. The rule now takes **positive evidence**: if the bound name is
   joined anywhere in the enclosing function, it is display. Not finding a join
   still flags — the refinement can clear a warning, never invent one.
2. **`testIdPrefix` was not on the skip list.** `data-testid` was; the custom
   prop that feeds it was not, so `` `compare-events-${f.fileName}` `` read as
   interpolated copy.
3. **The seventeen**, excluded — **conditionally**. The exclusion is wired to the
   invariant that makes it true, not to the filename: `--check` also asserts that
   nothing outside the module reads `.detail`, and the moment one is rendered the
   exclusion lapses and all seventeen return as failures. An exemption that
   cannot notice its own premise expiring is how `LOCALE_DEFERRED` sat for a
   year.

`spec:i18n-scan` now runs `scan-i18n --check` and is in the gate.

### And the refusals are driven — over the whole union, not three states

`spec:mix-refusal-copy` (68 checks). The brief asked for the three named
refusals; the spec asserts **all eight**, because driving three proves three
while enumerating the type proves the one somebody adds next month. The union is
read out of the source, so it cannot fall out of step with the type.

- **Engine:** `no-members`, `locks-oversubscribed` and `arpu-unknown` are
  produced by real calls to `achievableTargetRange` / `solveForTarget`.
- **Mapping:** every one of the eight reasons has a rendered key, and the table
  has no entry for a reason that no longer exists.
- **Card:** `WhatIfTab` really does branch that way — the heading, the two named
  bounds, and the catch-all are each asserted in source.
- **Locale:** each rendered key exists in all six and **differs from English** in
  all five.
- **Control:** a conforming mix still blends, so the refusals above are not the
  module simply refusing everything — the vacuous-result trap.

**Two of my own checks were wrong first, and the anchors caught both.** The
reason-union parse read only three of eight members, because the doc comment on
`locks-oversubscribed` contains a semicolon (*"already exceed MIX_TOTAL; nothing
is left"*) and I sliced to the first `;` in the raw text. And
`locks-oversubscribed` was first driven with a negative share, which is caught
earlier as `malformed-shares` — the check would have passed for the wrong reason.

### One copy finding, reported rather than changed

**Six of the eight reasons render the same catch-all**, *"The current holds leave
nothing free to move."* That is accurate for `cannot-conserve` and
`range-collapsed`. It is **wrong for `no-members`** (there is no mix at all) and
**for `arpu-unknown`** (a member has no ARPU) — neither has anything to do with
holds. It is the two-meanings-of-null shape in copy rather than in data.

Changing what the card says in six languages is a product decision, so it is
reported, not taken.

## Item 2 — the display/identifier split

### TERMBASE §11 asked this exact question, and the answer had gone stale

§11 carries, verbatim:

> **Open question — needs confirmation:** `forecastType` values are rendered in a
> "Forecast Type" column in the Overall Forecast view. If that column prints the
> raw internal value rather than a mapped display label, the internal name does
> surface to the user and needs a display mapping. Confirm before phase 2.

**Confirmed — and at four sites, not one.** The paragraph directly above it
asserts *"Verified: no JSX text occurrence of either internal name"*, and that
verification had gone stale without anything noticing:

| Site | What it printed |
|---|---|
| `OverallForecastTab.tsx:147` | the type filter's `<option>` labels |
| `OverallForecastTab.tsx:253` | the Forecast Type table cell |
| `GenerateCohortForecastModal.tsx:72` | the generate modal's summary line |
| `ViewCohortForecastModal.tsx:54` | the view-cohort modal's title |

### The split

`src/utils/forecastTypeLabel.ts` maps internal → key, reusing the keys the app
already uses for these things in its own navigation (`standard_forecast`,
`what_if`) rather than minting new ones: a user who reads *Standardprognose* in
the nav should read it here too. An unmapped type falls back to its raw value —
a blank cell would hide a forecast type nobody has mapped.

**The identifier is untouched**, and pinned exactly: 20 occurrences in `App.tsx`,
10 inside composite cohort keys, 7 quoted literals, the import default
`String(row['Forecast_Type'] || 'Standard Forecast')`, and the comparisons in
`App.tsx` and `ManageBulkDrawer.tsx`. Exact counts because here a **removal** is
the dangerous direction — every disappearance is a place where a cohort key
stopped being composed the old way.

`spec:forecast-type-split` (54 checks) also round-trips an old save: a session
written before this change carries the English identifier, and its cohort key is
reproduced byte for byte under every locale, including a save with the
`Forecast_Type` column entirely absent.

## Item 3 — locale-aware axis dates

**Only Step 2 formats month names.** Step 3 and Compare render `dataKey="month"`
raw, which is `yyyy-MM` — already locale-neutral, and confirmed on screen
(*2023-01, 2023-06*). Nothing to localise there, so nothing was changed there;
whether those axes *should* show month names is a product question, not this one.

Step 2 formatted through a module-level `fmtMonth` calling
`format(d, 'MMM yyyy')` with **no locale**, which is English regardless of the
app's language. It fed the x-axis, the chart tooltip and eight table cells.

**A formatted date is invisible to a translation check** — "Oct 2026" is in no
bundle, so no amount of translating could reach it and `spec:i18n-parity` could
never have flagged it. That is why this needed a formatter and its own spec.

`src/utils/monthFormat.ts` picks the date-fns locale from `i18n.language`,
matching only the primary subtag so `de-DE` and `pt-BR` resolve rather than
silently falling back:

```
de     Jan. 2026 | Okt. 2026 | Dez. 2026
it     gen 2026  | ott 2026  | dic 2026
fr     janv.2026 | oct. 2026 | déc. 2026
zz     Jan 2026  | Oct 2026  | Dec 2026     ← unknown falls back to English
```

`fmtMonth` left module scope to become a `useCallback` bound to
`i18n.language` — a module-level function has no way to know the app's language.
All ten call sites are unchanged. Two further English-only formatters in the
spread and ramp month pickers were found **by the spec, not by me**, and fixed.

`spec:month-format` (42 checks) asserts the positives, the **negatives** (October
is not "Oct" in any of the five), region subtags, unparseable input, and that the
card actually uses it.

**Renaming a local caught a real trap.** Both pickers declared
`const monthLabel = …`, shadowing the newly imported `monthLabel`. Renaming it to
`spreadLabel` made the compiler point at two usages I would otherwise have left
resolving to a function reference rendered as a React child.

## Item 4 — layout at German and French widths

**PARTIALLY SHED, per the pre-authorised order** (item 4 is first). What was
measured, in German, driven with a real event in the table:

| Table | Cols | Table width | Wrapper | Overflows | Wrapper scrolls | Cells clipped |
|---|---|---|---|---|---|---|
| Step 2 events (`1440×900`) | 14 | 1266px | 1022px | yes | **yes** | **0** |
| Step 2 events (`845×914`) | 14 | 1266px | 764px | yes | **yes** | 1 (campaign name, `truncate`) |
| Step 2 stock-and-flow | 8 | 1022px | 1022px | no | yes | 0 |

**No CSS fix is warranted.** The events table is wider than the content column at
both widths, and its wrapper carries `overflow-x-auto` — horizontal scroll inside
the wrapper is the intended handling, not overflow. The single clipped cell at
the narrow width is the campaign name under a deliberate `truncate` class, and it
carries a `title` tooltip.

**NOT MEASURED, and shed rather than guessed: French, and Step 3's comparison
table.** The French run needed a return to the Home screen for the language
picker — it is the only screen carrying it — and coming back re-triggered the
generation modal over the tables. One bounded attempt was spent and the rest shed
**before** the gate rather than after, which is where shedding is free.

## Traps

**119 → 121.** Both planted by hand and confirmed red before being trusted.

### 123 is RE-AIMED, and the re-aiming is the finding

The brief asked for *"one mixConstraint reason back to a bare English literal"*.
**That trap cannot exist**: all seventeen already are bare English literals, and
are supposed to be. So it is aimed at the invariant that makes them safe:

```
WITH 123 PLANTED (a console.warn of outcome.detail in the mix card):
  FAIL: 1 site(s) read .detail from src/utils/mixConstraint.ts
        src\components\WhatIfTab.tsx:747
  scan --check exit: 1        (clean tree: 0)
```

### 124 is the layer proof, and it is exact

```
WITH 124 PLANTED (forecastType: 'Standardprognose'):
  spec:forecast-type-split   52 passed, 2 FAILED
      FAIL  IDENTIFIER: App.tsx still carries exactly 20 occurrences   [19]
      FAIL  IDENTIFIER: exactly 7 are quoted literals                  [6]

  — and every label-side check stays GREEN, in the same run and beside it:
      spec:i18n-parity        194 passed, 0 failed
      spec:month-format        42 passed, 0 failed
      spec:mix-refusal-copy    68 passed, 0 failed
      scan --check             exit 0
```

That is the split doing its job: **the identifier layer reddens and the label
layer does not notice**, because they are different strings doing different jobs.
§11 records that this failure is otherwise *silent* — cohort ids written under
one locale simply stop matching those written under another, with no error
anywhere — which is why it needs a trap rather than a note.

**`scan-i18n` is invoked with `--check` by the harness**, since without the flag
it prints its inventory and exits 0. Passing it is what makes trap 123 mean
anything. The positive control covers both new specs.

## Gate

```
guard-traps:          121/121 caught, 0 missed, 0 inconclusive   (was 119)
full suite:           51 specs, 0 failed
  new this session:   i18n-scan (--check, exit 0)   mix-refusal-copy 68
                      forecast-type-split 54        month-format 42
  mix-card (mounted) 235   pricing-roundtrip 117   i18n-parity 194
  amount-control 91   event-roundtrip 86   walk-fixes 82   derive 75
  pct 72   compare-events-panel 71   scope 61   churn-fold 56
  yield-roundtrip 56   step1-panel 54   interaction 46   compare-window 45
  generate-missing 44   events-summary 43   bulk-completion 40
  compare-render 40   cards 36   import-seam 36   nullrender 35
  coverage-copy 35   chart-scope 33   base-seed 31   provenance 29
  step2-unlock 26   retire 25   compare-filter 24   step1-selection 24
  active-cohort 23   prorata 21   skip 20   deletions 19   unscored 19
  challenger 18   mix 17   leafgrain 17   step3-transition 17
  scenario-pricing 16   edge 15   restore-base 15   triggers 14
  nav-target 13
  mix-constraint / override-arpu / scenario-arpu: every check green
lint (tsc --noEmit):  clean
build:                clean (5.96s)
```

**Trap COUNT: 119 → 121**, ids 123 and 124. The harness restored every file it
mutated — `console.warn(outcome.detail)` residue in `WhatIfTab.tsx` is 0, and
`App.tsx` is back to its 20 occurrences of the identifier.

## Limits of this check

**The three named refusals were driven at the ENGINE and MAPPING levels, not
mounted to the DOM.** `mix-card-spec` mounts the real card, but reaching
`no-members` / `arpu-unknown` / `locks-oversubscribed` through it needs data
states that harness does not construct, and there is no target-input testid to
drive. What is proven: the engine produces those three reasons; every one of the
eight maps to a key; the card branches that way in source; and each key resolves
differently from English in all five locales. What is not proven by a mount: that
the pixels say so.

**`spec:i18n-scan`'s exclusion is only as good as its premise check.** The
seventeen are excluded because nothing reads `.detail`, asserted by a regex over
files importing the module. A read that laundered the value through another name
first — `const { detail } = outcome` — would not be seen. Trap 123 plants the
straightforward form.

**"Previsione Standard" carries a capital S** — a pre-existing string from the
original 119, not from this arc. Italian sentence case would lower it. Flagged
for Alessandro rather than restyled from a spec assertion, which is the wrong way
round.

**The catch-all refusal copy is inaccurate for two of the eight reasons** — see
item 1. Reported, not changed.

**`<Trans>` fragments met and NOT converted, per the brief.** The five campaign
decline reasons were whole sentences and keyed cleanly. The fragments in the
retention-clamp warning (`whatif_retention_volume` … `whatif_exceeds_forecast_
outflow_for` … `whatif_the_retained_volume_will_be_clamped_to_the_av`) are still
assembled around interpolations at `WhatIfTab.tsx:5489` and remain on the
TERMBASE §12 backlog.

**Nothing here was re-verified in the browser after the gate.** The German
render evidence in items 3 and 4 was taken before `guard-traps` ran; the harness
restores every file it mutates, and the suite is green afterwards, but the
screenshots predate the final tree.
