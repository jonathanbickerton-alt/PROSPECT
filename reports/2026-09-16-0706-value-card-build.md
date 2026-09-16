# REQ-D6-07 build — the Value card leads with the cohort ARPU

## FOR ADVISOR

```
Generated: 2026-09-16 08:53 +0100 (UTC 2026-09-16 07:53)
Certifies: PENDING
Repo: PENDING
The Value card answers in the reader's units: "Corporate Inflow ARPU,
Nov 2026: 13.87 -> 14.29", the two blends collapsed behind one closed line.
A typed target is a COHORT ARPU, solved on the preview seam (closed form,
then bisection to 0.005, cap 30) and handed to the mix solver as a blend.
Band readout, blocked sentence and clause-11's two refusals are all in
cohort terms; measured band on the trimmed fixture 3.83 - 27.49.
The summary cell states the RATIO; the pair rides in its title.
BRIEF vs MEASUREMENT: 1.5 named the padlock band as 5.50-27.61 at 2026-11;
that is the 0647 inventory harness's figure, not that spec's mount, whose
own band is 3.83-27.49. Literals were taken from the mount, not the brief.
BRIEF vs MEASUREMENT: 1.5 listed traps 192-194 and 198 as needing re-
anchoring; only 143 and 197 had aged out, and both were re-anchored.
The padlock mount now resolves a forecast and carries ARPU in its history:
without it the cohort band is [0.00, 0.00] and (f)/(g) measure nothing.
Nothing was shed. No decision is reserved for Jon.
guard-traps targeted __/__ CAUGHT (ids PENDING), rotation 20 (ids PENDING), NOT RUN __, last FULL run <hash> <date>
full suite:  73/73 green
```

## 0. Base

The brief's first act asked for two quotes. `git status --short` was empty.
`git diff 1bc094b HEAD --stat -- src scripts` was **not** empty — `scripts/`
differs by the four guard-traps harness commits (ed4dd8e, e7c88aa, 21581a2,
0af35c6) that landed after `1bc094b`. `git diff 0f11f33 HEAD --stat -- src
scripts` **is** empty, and `src` alone is empty against both. That discrepancy
was reported before any code was written rather than resolved silently.

BASE for the STOP diffs: `0f11f33`.

## 1. Item 0 — clauses 6-11 recorded

Committed alone as `0a655e5`, before any code, verbatim from the brief.

## 2. Item 1 — the card

### 1.1 The lead

The `yield-preview-*` pair is promoted to the card's lead: the label reads
`{cohort} {ibro} ARPU, {month}` (`whatif_value_lead_label`), the pair keeps its
three testids, and `yield-lead-scope` carries clause 10's suffix — "applies from
{month} onward" or "at {month} only". `yield-preview-absent` is untouched, and
so are the two rival lines.

The two blend boxes and the ratio caption moved, unreworded, into a `<details
data-testid="yield-how-computed">` that is closed by default. The keys are
re-homed: `whatif_baseline_blended_arpu`, `whatif_new_blended_arpu`,
`whatif_equal_weight_avg_of_tier_arpus` and `whatif_yield_ratio_caption` are the
same sentences in the same order.

### 1.2 The target

`MixTargetPanel` still computes nothing. It gained four OPTIONAL props —
`label`, `rangeOverride`, `onCommit`, `refusal` — and one conditional: the
blocked sentence uses the cohort wording only when a caller states its own band.
The Promotion arm passes none of them.

ONE new function, `solveForCohortTarget` (`src/utils/mixConstraint.ts`), beside
`solveForTarget`: closed-form first guess (`target x equalWeight / fitted`)
clamped into the blend band, then bisection on an injected `deliver(blend)` to a
tolerance of 0.005, cap 30, returning the closest attempt with `converged:false`
rather than silence if the cap is reached. `deliver` is `yieldDeliverForBlend`
-> `yieldDeliverForMix` -> `eventScopeSeriesFor` — the seam's fourth caller and
**not** a seventh engine site. `rebalanceToTarget` is handed the solved blend
exactly as before.

The band readout is the cohort band (clause 9): the blend band's two ends put
through the seam, memoised on the draft — two calls, ~29 ms measured in the 0647
inventory. Blocked above/below names the binding member as today and quotes the
COHORT ceiling: measured on the trimmed fixture the blend wall is 27.51 where
the cohort ceiling is 27.49, which is exactly close enough to look right and not
be. Clause 11's two refusals render as text with their own testids. Apply still
writes the mix only — the target never persists.

### 1.3 The Promotion arm untouched

Asserted mounted, against hand-written literals rather than against the Value
card: the label reads exactly `Target blended ARPU` and the readout still begins
`Reachable: `. Comparing the two cards to each other would pass just as happily
if both had changed. Trap 249 reddens this.

### 1.4 Mounted

New spec `scripts/value-cohort-target-mounted-spec.tsx`, **34/34**, in fill-in
order on the trimmed fixture's Corporate|All with three tiers:

- (a) fitted 13.87 -> delivered 13.87, `+0.00%` — the flat mix, where a correct
  card must say that nothing happens;
- (b) typed to four decimals (fitted + 0.4161): the sliders move, the lead lands
  within the displayed penny, the box still reads what was typed, and the blend
  the solve found is asserted to be a DIFFERENT number;
- (c) the same target with a tier rate overridden x1.35 still lands, by a
  measurably different blend;
- (d) a target above the band is blocked, naming the binding tier, and the
  sentence is pinned to the READOUT's number and against the tier rate;
- (e) every rate overridden to zero -> the keyed no-rates refusal, read from the
  locale file rather than copied;
- (f) Inflow labels "Target Inflow ARPU at Nov 2026", Retention "at Oct 2026";
- (g) the collapsed line exists, is closed, opens, and the lead precedes it in
  document order.

Plus Item 2's four cell assertions and 1.3's two literals.

### 1.5 Re-aims, seen red first

Each was seen RED and quoted before it was touched. The red set below is from
the first post-build suite run, which was **64/72**.

| spec | the red, quoted | the re-aim |
|---|---|---|
| `yield-roundtrip` | `FAIL D5-13: and series is that same run chartData, untouched` (+2) | the seam's return literals now carry `rawArpuByMonth`; a one-pass pin added; the caption pinned INSIDE the collapsed line; the lead pinned before it; the locale key list 6 -> 14 |
| `value-padlock` | `FAIL (f) a reachable target enables Apply [target 23.93 in [5.86, 41.99]]` (+8) | the mount resolves a forecast and carries ARPU; achievement measured on the delivered cohort figure rather than the by-hand blend (6 checks) |
| `events-summary` | `FAIL yield: reports cohort, band count and the blended rate [Inflow ARPU +0.0%]` | the cell states the ratio; a tilted-mix case added so `+0.0%` cannot pass vacuously; the unknown arm keeps its em-dash |
| `compare-events-panel` | `FAIL CELL: the yield event reads as a mix with its blend [Inflow ARPU +6.7%]` | hand-computed: 16.00 / 15.00 = +6.7% |
| `pricing-roundtrip` | `FAIL baseline: EXACTLY THREE callers share it [4 call sites, expected 3]` | raised to FOUR with the new caller named, the engine-count pin unmoved at 6 |
| `mix-refusal-copy`, `i18n-scan` | `FAIL DIAGNOSTIC: src/components/WhatIfTab.tsx reads .detail zero times [1]` | a real breach, not a re-aim: the card no longer reads mixConstraint's diagnostic English |
| `trap-anchors` | `FAIL trap 143 ... anchor 1 still matches WhatIfTab.tsx [ZERO]`, same for 197 | both re-anchored in this commit |

`view-apply-mounted` (:2659-2663) stayed GREEN throughout and was **not**
re-aimed: the promoted pair kept its testids and its text. Traps 192-194 and 198
also still match and were left alone.

### 1.6 Traps 245-251

| id | plants | spec |
|---|---|---|
| 245 | the solve reads the ROUNDED ARPU column | value-cohort-target |
| 246 | the cohort target handed to the mix solver unconverted | value-cohort-target |
| 247 | the band readout reverts to the blend band | value-cohort-target |
| 248 | the no-rates refusal dropped — a target "solves" to no movement | value-cohort-target |
| 249 | the Promotion arm picks up the cohort label | value-cohort-target |
| 250 | the summary cell prints the blend again | events-summary |
| 251 | the adjusts title renders without the opt-in prop | value-cohort-target |

The new spec is registered in `CONTROL_SPEC_MAP` WITH its first trap (245) — the
lesson `D505HELD` was registered late for.

## 3. Item 2 — the summary cell

`yieldEventSummary` returns `{ibro} ARPU {ratio}` from the event alone, through
ONE shared helper `yieldRatioFrom` that both engine ratio sites now call — not a
second copy of the arithmetic at `WhatIfTab:1766-1773`. The key
`whatif_summary_yield` is rewritten in six locales (de and it are not English);
the unknown-blend arm keeps its em-dash.

`EventsSummaryTable` gained an opt-in `adjustsTitle` prop. WhatIfTab passes the
per-month pair for yield rows, read from the `chartData` the tab already holds —
no second engine call, and by construction the same figures the chart draws.
Compare passes nothing and renders no title.

Mounted: the cell reads `Inflow ARPU -15.0%` for the saved fixture row (hand-
computed in the spec from its own mix and rates), and its title reads `13.87 to
11.79 at 2026-11`.

## 4. Gate

| step | result |
|---|---|
| `npm run suite` | **73/73 green** (72 + the new spec) |
| `npm run guard-traps -- --targeted` | PENDING |
| `spec:trap-anchors` | 261 passed, 0 failed (247 traps, 256 anchors) |
| `spec:i18n-parity` | 200 passed, 0 failed — **928 keys per locale**, all six |
| `spec:i18n-scan` | PASS |
| `spec:survival` | 27 passed, 0 failed; **104 first-row dereferences across 26 files** |
| `tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm run build` | built in 9.18s |

### Exact counts the brief named

| pin | required | measured | instrument |
|---|---|---|---|
| `runIngest` sites | 3 | **3** | `spec:ingest`, green |
| apply sites | 12 | **12** | `spec:event-toggle`, green |
| display markers | 6 | **6** | `spec:event-toggle`, green |
| ramp/hold checkboxes | 4 | **4** | `spec:hold-shape` clause-10 pin, green |
| last column Market/Yield/Pricing | 4/2/3 | **4/2/3** | `spec:event-toggle`, green |
| `computeAdjustedForecast` sites | 6 | **6** (1 definition + 5 calls) | `pricing-roundtrip-spec.ts`, green, and a direct count |
| `eventScopeSeriesFor` callers | state it | **4** | see below |
| `handleDeleteCampaign` callers | 3 | **3** | `spec:campaign-delete`, green, and a direct count |

The seam's callers went 3 -> **4**: the Pricing save, the Pricing preview, the
yield preview, and the cohort solve's `yieldDeliverForMix`. The solve goes
THROUGH the seam precisely so the engine count stays at 6 — a solver with its
own `computeAdjustedForecast` call would have been measuring a draft the card
never previewed, which is the failure the count exists to catch. The pin was
raised with the new caller named, and the engine-count pin beneath it did not
move.

## What was shed

**Nothing.** Item 0 was recorded and committed alone; Item 1 is complete
(1.1-1.6); Item 2 is complete. Two pieces of work beyond the brief's list were
needed and are stated above: the `.detail` breach (a project rule, not a
re-aim), and two new locale keys for the cohort blocked sentence, so that the
Promotion arm's own copy could stay byte-identical.

## Limits

- Every mounted figure is this fixture's. The brief's 5.50-27.61 came from the
  0647 inventory harness (24-month horizon, an override applied); the padlock
  mount's own band is 3.83-27.49. The literals in the specs are the mount's,
  hand-checked against the rates the card shows.
- `solveForCohortTarget`'s bisection assumes delivered ARPU rises with the
  blend. That holds for the engine's ratio — blend / equal-weight applied to a
  positive fitted ARPU — and is not asserted for a future non-monotone rule.
- The padlock spec's mount now resolves EVERY key to the seeded baseline. That
  is deliberate (which key the store answers to is `resolveFromStore`'s own
  spec) but it means that spec no longer exercises an unresolvable slice.
- Apply is offered on a BAND read rather than on a solve, so a target inside the
  band that the solver then cannot reach is reported after the press rather than
  before it. That is the measured trade: one band memo, not one solve per
  keystroke.
