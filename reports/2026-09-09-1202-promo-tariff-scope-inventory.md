# Promotion tariff scope — read-only inventory

```
FOR ADVISOR
Generated: 2026-09-09 12:02 +0100 (UTC 2026-09-09 11:02)
Certifies: 9c93807 (read-only; nothing committed but this report)

BASE 9c93807 + 9eefbfc (reports/ ONLY; ZERO drift in gated paths). Proceeded.
1 SCOPE = `selectedTariffs: string[]` App:1238; exported App:637-640, restored
  App:994-999. Readers: mix axis, targetTariffTree :1994, auto-clear :2006 and
  :2011 (volume + pricing ONLY, not promo). THE ENGINE NEVER READS IT.
2 buildPromoEvents writes tariffL1 = p.draft.tariffL1 :592, literal 'All' :367;
  every ramp row identical :573; no separate mix rows.
3 eventScopeMatchesView fc:565-575 is TRUE at every view when the event holds
  All; leafWithinScope fc:3090-3100 skips the dim, so forecastCoverage fc:3259
  gives inBoth/inView = 1 at RED S. Neither sees selectedTariffs: the defect.
4 NO list-valued dim. EventScopeDims is all `string?` and DECLARED TWICE
  (fc:532, fc:3570 — merged). Only carrier list: mixLocked, fc:379 / fc:1259.
5 COMPARE: sites 9-12 sh:215/367/423/488, matches sh:223/369/431/495, weighting
  sh:131 + sh:252 (eventCoverage, NOT forecastCoverage). A change lands twice.
6a SPLIT: per-tariff-per-month baseline EXISTS, leaves :2947-2966; T x R rows.
6b LIST SCOPE: event field + JSON column; a branch in eventScopeMatchesView
  (16 callers) AND leafWithinScope, both EventScopeDims, sh:116/226/434/498.
7 CONFIRMED: targetTariffTree :1994 filters to selectedTariffs; promo :7462.
FEWER SITES: 6a — one function, emitting events every existing site handles.
WRONG NOT MERELY EXPENSIVE: 6a freezes the split at SAVE time where coverage
  is per month per view today, and multiplies a campaign's row count. 6b needs
  the list ON THE EVENT, or the predicates take app state they are pure of.
```

## Base

`git log --oneline -1` read `9eefbfc` — `9c93807` plus one reports-only fill
commit (the REQ-D6-02 report). `git diff 9c93807 --stat` is that file alone.
The permitted case.

## 1. Where "Tariffs in scope" lives

```
src/App.tsx:1238   const [selectedTariffs, setSelectedTariffs] = useState<string[]>([]);
```

**It is exported and it does survive reload.** Sheet `Tariff_Selection`
(`App.tsx:637-640`) writes one `Tariff_L1` row per selected tariff, or a
`Note` row when none; `Metadata` carries `Selected_Tariffs` as a **count**
(`:661`). Restore reads the sheet back and repopulates the state
(`App.tsx:994-999`), filtering the Note row and blanks.

**Every reader, and none of them is the engine:**

| reader | site | what it does |
|---|---|---|
| mix membership | `WhatIfTab.tsx:287`, `:305` | a tariff-axis mix has no members outside the selection |
| mix availability | `:2130` (yield), `:2399` (promo) | the tariff axis is offered only when the selection is non-empty |
| `targetTariffTree` | `:1994-2001` | filters `fullTariffTree` to the selection — see §7 |
| auto-clear effects | `:2006-2009`, `:2011-2014` | reset a draft's tariff to `All` when it leaves the selection |
| the picker itself | `:5287-5294` | the control that sets it |

**The engine never receives it.** `computeAdjustedForecast`'s input
(`WhatIfTab.tsx:970-984`) takes `wiTariffL1Col` / `wiTariffL2Col` — column
*names* — and the view's tariff, but not `selectedTariffs`. Nor does
`scenarioHelper`. So no apply-path decision can consult it today.

**The two auto-clear effects cover the volume and pricing drafts only.** There
is no `newPromo` equivalent, so a promotion draft holding a tariff that leaves
the selection keeps it. Not the reported defect — reported because it is the
same gap on a third form.

## 2. What `buildPromoEvents` writes

One event shape, one tariff expression, for every row:

```
src/components/WhatIfTab.tsx:592   tariffL1: p.draft.tariffL1, tariffL2: p.draft.tariffL2,
```

`p.draft.tariffL1` is the literal string `'All'` when the control says All —
the draft's default (`:367`), and what the dropdown writes back on change
(`v.l1 ?? 'All'`, `:7474`).

**The ramp rows do not differ.** The whole return is one
`pcts.map((pct, i) => …)` (`:573`); the index moves only the month and the
volume fraction. Every row of a 3-month ramp carries the same `tariffL1`.

**There are no separate mix or ARPU-bearing rows.** The mix is not a second
population — it rides the same rows as `promoMix`, `promoMixAxis`,
`mixLocked` and `promoBandArpuOverride` (`:614-624`), and reaches the event as
a single blended `arpu` (`:583-586`). So there is exactly one row set to
scope, not two.

## 3. How the scope match and the weighting treat All

**The predicate**, `src/utils/forecasting.ts:565-575`:

```ts
const ok = (dim: string | undefined, view: string | null) =>
  !dim || dim === 'All' || !view || view === 'All' || dim === view;
…
&& ok(d.tariffL1, v.tariffL1)
```

`dim === 'All'` short-circuits to **true for every view**, RED S included. The
predicate is a pure function of the event's dims and the view's dims; it has
no third argument and no access to `selectedTariffs`.

**The weighting agrees with it**, `leafWithinScope` (`fc:3090-3100`):

```ts
if (!want || want === 'All') continue;   // not narrowed on this dimension
```

so an All-tariff event is "in scope" for every leaf on the tariff axis. Both
weighting functions build on it:

- `forecastCoverage` (`fc:3259-3277`) sums each **view leaf's** fitted
  `months[month][metric].mean` into `inView`, and into `inBoth` when
  `leafWithinScope(event, leaf.cohort)`. At a RED S view every leaf is RED S
  and every leaf is in scope, so `inBoth === inView` and it returns **1**.
- `eventProRataShare` (`fc:3118-3160`) sums historical leaf volumes with the
  same predicate, and returns the cohort's share of the target — again 1 when
  the target covers everything the view contains.

So the full uplift lands at RED S, exactly as reported, and it is not a defect
in either function: they are answering the question they were asked.

## 4. Whether any dimension is already list-valued

**None is.** `EventScopeDims` is seven optional strings — and it is
**declared twice in the same file**, `fc:532-536` and `fc:3570-3578`, with
identical members, so TypeScript merges them silently. Either declaration
would have to change, and a reader who finds one may not know of the other.

`ViewScope` (`fc:539-544`) is `string | null` per axis, where `null` means All.

The only list on a carrier is **`mixLocked`** (`types/forecast.ts:482`), and it
is the useful precedent: exported as a single JSON column and read back —

```
fc:379   Promo_Mix_Locked: e.mixLocked && e.mixLocked.length ? JSON.stringify(e.mixLocked) : '',
fc:1259  const raw = String(row.Promo_Mix_Locked ?? '');
```

appended, never inserted. A `Tariff_Scope` column would follow the same rule.

## 5. Compare

The same two questions are asked again in `src/utils/scenarioHelper.ts`, over
**raw sheet rows** rather than typed carriers:

| what | site |
|---|---|
| apply sites 9, 10, 11, 12 | `sh:215`, `:367`, `:423`, `:488` |
| `eventScopeMatchesView` | `sh:223`, `:369`, `:431`, `:495` |
| pro-rata weighting | `sh:131` `eventProRataShare` |
| coverage | `sh:252` `eventCoverage` |
| raw tariff reads | `sh:116`, `:226`, `:434`, `:498` (`e.Tariff_L1`) |

**Compare calls `eventCoverage`, not `forecastCoverage`** — it has no per-leaf
forecasts to sum, only the sheet's leaves. Any change to what All means must
land in both engines, and in Compare it must land on the raw column too.

## 6. What each design needs

### (a) Split at build

**The per-tariff, per-month baseline quantity exists.**
`resolveEventScopeForecast(scope, resolveForecast).leaves`
(`WhatIfTab.tsx:2947-2966`) returns `BaseForecast[]`, one per leaf, each with
`cohort.tariffL1` (`CohortKey` carries tariff at `types:77-79`) and
`months[i].retention.mean` / `.inflow.mean` / `.outflow.mean`. It is the same
array `forecastCoverage` already sums, so a build-time split would weight by
exactly the quantity the apply path weights by today.

**It is conditional.** `viewLeafForecasts` is `[]` when `resolveForecast` is
absent, and `forecastCoverage` then returns `null` so the historical weighting
stands (`fc:3265`). A split with no leaves has no weights — and
`distributeProRata`'s even-split fallback would *invent* a distribution rather
than decline, which is a different failure from today's.

**The export round trip is N rows, not 1 — and it already is.** A ramp is
already R rows sharing a `campaignName`; a split makes it T × R rows of the
same shape. No new column and no new reader: `marketEventExportRow` (`fc:340`)
and `marketEventFromRow` (`fc:1228`) already carry `Tariff_L1` per row.

### (b) List-valued scope

- **carrier field**: `tariffScope?: string[]` on the shared event base, beside
  `mixLocked`;
- **predicate**: a branch in `eventScopeMatchesView` (`fc:565`) — one
  definition, **16 call sites** (11 `WhatIfTab`, 4 `scenarioHelper`, 1 inside
  `forecasting.ts`);
- **coverage**: the same branch in `leafWithinScope` (`fc:3090`), which feeds
  **both** `eventProRataShare` and `forecastCoverage`;
- **types**: both `EventScopeDims` declarations (`fc:532`, `fc:3570`);
- **export**: one JSON column on the `mixLocked` precedent, plus its reader;
- **Compare**: the four raw readers above, which parse strings from a sheet;
- **blast radius**: 25 `Tariff_L1` sites across `src/`; `tariffL1` appears 46×
  in `App.tsx`, 55× in `WhatIfTab.tsx`, 28× in `ForecastVsActualsTab.tsx`,
  9× in `scenarioHelper.ts`. Most are cohort plumbing that would not change —
  but each is a place a reader must decide whether it holds a scalar or a list.

## 7. The dropdown

**Confirmed.** `targetTariffTree` (`:1994-2001`) copies only the selected L1s
out of `fullTariffTree`:

```ts
if (!selectedTariffs.length) return new Map();
for (const l1 of selectedTariffs) if (fullTariffTree.has(l1)) t.set(l1, …);
```

All three event cards render `HierarchicalDropdown` from it — Volume `:5403`,
Pricing `:6745`, Promotion `:7462-7479` — and each is hidden entirely when the
tree is empty. "All" is the dropdown's `null` selection, mapped to the string
`'All'` on the way out (`:7474`).

**This is the strongest argument for Jon's rule.** The control lists RED M and
RED L and nothing else, so "All" in *that* control reads as "all of these";
the engine reads the same token as "unnarrowed". The two readings differ only
when the scope is a strict subset — which is exactly the reported case.

## Which design touches fewer sites

**(a), clearly.** It changes one function, `buildPromoEvents`, and emits
ordinary per-tariff events that every existing site — both engines, both
weightings, the export, Compare's raw reader, the campaign pill — already
handles correctly. Nothing learns a new concept.

**(b) changes the two functions the whole app agrees through.** That is not
fatal, but it is the opposite kind of change: one edit, sixteen call sites
that must still be right, and a second engine reading the same field off a
spreadsheet cell.

## What would make either wrong rather than merely expensive

**(a) freezes the split at save time.** Coverage today is recomputed per month
and per view; a split writes fixed volumes per tariff at the moment of saving.
If the leaf forecasts are regenerated, or the event is reloaded into a session
whose forecasts differ, the split no longer matches the baseline it was
derived from — and nothing would say so. Today's behaviour is wrong at RED S
but self-correcting everywhere else; a stale split is quietly wrong forever.

**(a) also multiplies a campaign's row count**, from R to T × R. The campaign
pill (REQ-D6-01) and D5-05's group-edit bar both reason over the rows of a
campaign, and the promotion's group-edit rules were written against R rows of
one ramp. That is a real interaction, not a cosmetic one.

**(b) makes `'All'` mean two things on one axis** unless the list lives on the
event. If the rule were implemented by handing `selectedTariffs` to the
predicate, the predicate would stop being a pure function of event and view —
and it is shared by three carriers, two engines and sixteen call sites
precisely because it is pure. Materialising the list onto the event **at save
time** avoids that: the event then says what it targets, and the predicate
still answers from the event alone.

**A third question neither design settles.** `'All'` on a *saved* event is
ambiguous between "all tariffs" and "all tariffs that were in scope when I was
saved". A workbook saved with a two-tariff scope and reopened with a different
one cannot tell which the author meant. Whatever is decided, the saved event
should carry the answer rather than depend on session state — which is an
argument for (b)'s field even if (a) does the arithmetic.

## Limits

- **Read-only, nothing run.** No suite, no guard-traps, no mount. Every claim
  is from source at `9c93807`; line numbers were re-read this session and will
  drift on the next `WhatIfTab.tsx` edit.
- **Not reproduced.** Jon's screen is the evidence that the full uplift shows
  at RED S; this report explains why the code would do that, and did not mount
  a fixture to watch it happen.
- **No decision recorded.** The D number, the design, and the meaning of a
  saved `'All'` are all open.
