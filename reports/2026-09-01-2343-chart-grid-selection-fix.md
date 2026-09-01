# Chart grid — the selection lost on event add (walk fix W6a)

## FOR ADVISOR

```
Generated: 2026-09-01 23:43 +0100 (UTC 2026-09-01 22:43)
Certifies: 42c55ac (report filled one commit later)
Repo: committed 42c55ac, pushed (origin in sync)
SKELETON FIRST. BASE: HEAD 01a571f vs 1403's d63175b — one, REPORT-ONLY.
THE MECHANISM IS NONE OF THE THREE CANDIDATES — no prune effect, no remount, no
  state living too low. It was a PER-TAB DEFAULT: value and pricing were
  ['ARPU'], and ARPU stopped being a scenario yesterday, so the selection
  filtered to NOTHING there. IT WAS NEVER THE ADD — adding a pricing event
  takes you to the Pricing TAB, and the tab is what emptied it.
A SECOND HALF, same root: the render guard read selectedKpis.length, and
  ['ARPU'] has length 1, so the chart drew axes with NO LINES — a silent blank,
  not even the "select at least one" message. Both fixed.
THE FIX IS AT THE DERIVATION, not the click handler: selectedScenarios falls
  back to the tab's scenarios then to all four, non-empty on EVERY path. The
  defaults keep their intent — value/pricing still open on ARPU, as the MEASURE.
TRAP 120's FIRST AIM WAS VACUOUS AND THE GATE SAID SO: it removed a fallback
  that, with the defaults fixed, is never reached — so it planted nothing
  observable and MISSED. Re-aimed at the defaults, caught by a SOURCE check.
THEN THE NEGATIVE CONTROL FOUND A DEFECT IN MY OWN FIX: the pills read
  selectedKpis while the chart read selectedScenarios, so a bad default drew
  four lines with every pill UNCHECKED — the exact disagreement the source
  comment promises is impossible. Pills now read the derived value.
A LABEL COLLISION I INTRODUCED YESTERDAY: the measure row's "Volume" button has
  the same text as the Volume TAB; tabs now carry testids. mix-card 208 -> 235.
GATE: 117/117, sixteen specs, mount 235/235, lint and build clean.
```

---

## Base check

`HEAD` **`01a571f`**; the 1403 report's Repo line names **`d63175b`**. One commit
apart, `--stat` confirms **report-only**.

## The diagnosis

The brief named three candidates and said to check rather than assume. **None of
them is the mechanism.**

- **A prune-to-available effect?** There is none. `grep` finds exactly two
  writers of the selection — `setSelectedKpis` and the `useState` initialiser —
  and the source comment at the derivation says so explicitly: *"Nothing else
  writes selectedKpis, so the pills and the chart cannot disagree."* That
  comment is accurate.
- **A keyed remount of the control?** No. The control is not keyed on events or
  on `chartData`.
- **Selection state living below a component that re-keys?** No. It lives in
  `WhatIfTab` itself, in `kpisByTab`.

### What it actually is

```ts
const TAB_DEFAULT_KPIS: Record<string, KpiName[]> = {
  volume:    ['Inflow', 'Outflow', 'Retention', 'Base'],
  promotion: ['Inflow', 'Outflow', 'Retention', 'Base'],
  value:     ['ARPU'],      // ← the retired blend
  pricing:   ['ARPU'],      // ← the retired blend
};
```

Yesterday's session made `ARPU` a **measure** rather than a scenario, and the
scenario row derives as:

```ts
selectedScenarios = selectedKpis.filter(k => SCENARIO_LIST.includes(k))
```

`SCENARIO_LIST` no longer contains `'ARPU'`. So on the **Value** and **Pricing**
tabs, with no stored selection, `selectedKpis` is `['ARPU']` and
`selectedScenarios` is **`[]`** — every scenario line gone.

**The add never touched it.** Adding a pricing event takes you to the Pricing
tab, and the tab is what emptied the chart. The walk reported the sequence
faithfully; the cause sat one step earlier than the step that revealed it.

### The second half, same root

```tsx
{selectedKpis.length > 0 ? ( …chart… ) : ( …"select at least one KPI"… )}
```

The guard read **`selectedKpis`**, and `['ARPU']` has length **1** — so the
chart branch ran and rendered a `LineChart` with axes, grid and **no lines**.

That is worse than the empty state it was meant to avoid: the card has a
message for "nothing selected" and it was unreachable, because the thing that
was empty was not the thing being guarded. **A blank with no explanation is the
failure the design principle names first**, and this produced one.

## The fix

**One definition, at the derivation** — not in the pill's `onClick`, which was
never where the empty came from:

```ts
const selectedScenarios: ScenarioName[] = (() => {
  const picked = selectedKpis.filter(isScenario);
  if (picked.length > 0) return picked;
  const dflt = (TAB_DEFAULT_KPIS[activeTab] ?? []).filter(isScenario);
  return dflt.length > 0 ? dflt : [...SCENARIO_LIST];
})();
```

It is non-empty on **every** path: defaults, restores, a stale stored selection
naming a value a later change retires, or anything that has not happened yet. A
guard in the toggle handler cannot see any of those, and did not see this one.

**The tab defaults keep their intent.** `value` and `pricing` still open on
ARPU — now as the **measure**, with all four scenarios selected:

```ts
value:   ['Inflow','Outflow','Retention','Base']   +   TAB_DEFAULT_MEASURE.value   = 'arpu'
pricing: ['Inflow','Outflow','Retention','Base']   +   TAB_DEFAULT_MEASURE.pricing = 'arpu'
```

That is the faithful migration of what `['ARPU']` used to mean, rather than a
silent change of what those tabs show.

**The render guard now reads what it draws** — `selectedScenarios.length > 0`.
Always true after the fix, but correct in kind: a guard that reads a different
quantity from the one it protects is the defect, not the value it happened to
hold.

**The click guard stays**, and the comment says why it is a *second* property
rather than a duplicate: the pill refusing to turn off the last scenario keeps
the **stored** state honest, while the derivation guarantees the **chart**
however the selection got there.

## Specs

**mix-card 208 → 226**, eighteen new, all mounted with the stable-prop rule.

**The direct reproduction is the tab sweep.** For each of the four tabs: the
derived scenario selection is non-empty, and a chart is drawn. Under the old
code Value and Pricing fail both — this is W6a itself, as a check.

**Then the survival sequence**, with Inflow alone selected and the count
asserted identical after each: a **market add through the real button**, an
**event remove**, a **measure switch**, and a **tab round trip** out to Pricing
and back. Each asserts both "the selection is unchanged" and "it is never
zero", because those are different claims and only the second catches an empty.

**Count guard.** Eighteen new checks, no existing expectation re-baselined. The
tab sweep is a genuinely new path — nothing in the harness had ever switched
tabs — and it went red against the pre-fix code, which is what says it exercises
something.

### Two harness defects, both mine, both found by running it

**A label collision I introduced yesterday.** `goTab('Volume')` selected buttons
by text — and the measure row I added has a button reading **"Volume"**, the
same word as the Volume **tab**. The spec drove the measure, left the card on
the Pricing tab, and the churn-campaign section three blocks later crashed on an
empty event list.

Fixed **at source**: the tabs now carry `data-testid="whatif-tab-*"`. The
collision is real in the product — two controls legitimately named "Volume" —
so a cleverer selector in the spec would have left the trap set for the next
person. This is the third prefix/label collision this arc, after `scenario-`
matching `scenario-row`.

**A starting-state assumption.** The block inherited "Base only" from the
preceding grid block rather than all four, so turning the others off left Base
instead of Inflow. Inflow is now turned **on** first, and the starting state is
asserted — so a wrong inheritance fails loudly instead of quietly changing what
the rest of the block tests.

**And one product defect of mine, found by the negative control rather than by
any green run** — the pills and the chart reading different lists. It is
described under Traps, because the trap is what surfaced it.

## Traps

**116 → 117.**

**120** restores W6a's actual defect — a per-tab default naming the retired
blend — and is caught by the **source-level** defaults check.

### Its first aim was vacuous, and the harness said so

The trap as first written removed the **derivation's fallback** instead. It
**MISSED**.

The reason is a fact about my own fix I had not seen: with the defaults
corrected, `picked` is never empty, so **the fallback it removed was never
reached**. The trap planted something nothing could observe.

A trap that plants an unobservable change is not a weaker trap — it is not a
trap. The *"what would this actually redden?"* question is one this codebase
asks before adding traps, and I owed it before the run and did not pay it. The
gate charged the difference.

Re-aimed at the half that is load-bearing. And because a bad default is now
invisible at runtime **by design** — the fallback rescues it — the check that
sees it has to be at **source**: every tab default must name at least one
scenario and no retired value.

### The negative control then found a defect in the fix itself

Planting the re-aimed trap by hand, before trusting it, produced this:

```
WITH TRAP 120 PLANTED (before the pill fix):
  FAIL  the pricing default names at least one SCENARIO
  FAIL  the pricing default names no retired value
  FAIL  the Pricing tab derives a NON-EMPTY scenario selection   [0 selected]
  FAIL  the Pricing tab is non-empty on arrival                  [0]
```

The last two should not have failed — the fallback was supposed to rescue the
runtime. They failed because **the pills read `selectedKpis` while the chart
reads `selectedScenarios`**. With a bad default the chart fell back to four
lines and every pill rendered **unchecked**: a control saying "nothing
selected" over a chart showing four series.

That is precisely the disagreement the source comment two lines above promises
is impossible — *"the pills and the chart cannot disagree"* — and my fix had
introduced it while fixing something else.

**The pills now read the derived value**, the same list the chart plots, so the
promise is true by construction rather than by coincidence. Re-run:

```
WITH TRAP 120 PLANTED (after the pill fix):
  FAIL  the pricing default names at least one SCENARIO
  FAIL  the pricing default names no retired value
  — the runtime checks stay GREEN, because the card now genuinely survives it
```

**That is the layer proof the brief asked for, in its true form.** A bad default
is a source mistake caught by a source check; the runtime invariant holds
regardless; and the click-path spec never moves throughout, because the toggle
handler was never the invariant.

**A green spec did not find this. A negative control did** — which is the
argument for planting a trap by hand before believing it.

## Gate

```
mix-card (mounted):      235/235 passed   (was 208)
guard-traps:             117/117 caught, 0 missed, 0 inconclusive   (was 116)
full suite:              sixteen specs, 0 failed
  scenario-arpu 84   churn-fold 56   amount-control 91   cards 36
  event-roundtrip 86   events-summary 43   compare-render 40
  compare-events-panel 71   compare-window 45   compare-filter 24
  yield-roundtrip 56   scenario-pricing 16   active-cohort 23
  import-seam 36   pricing-roundtrip 117   derive-aggregate 75
lint (tsc --noEmit):     clean
build:                   clean (11.94s)
```

## Where things stand

**W6a is closed at the layer it actually lived on.** The chart cannot derive an
empty scenario set from any path, and the render guard reads the quantity it
protects.

**Open:** Revenue axis scaling (logged, out of scope); the locale sweep; Step 3
reconciliation as a walk re-check; the three-denominator correction; DQ.

## Limits of this check

**The pricing add itself is not driven in the survival sequence.** The mount
drives a market add through the real button, a remove, a measure switch and a
tab round trip. A pricing add reaches the chart through the same recompute and
the same tab change — and the tab change *is* driven — but the specific button
Jon pressed is exercised only in the separate pricing block, which does not
assert the selection. The tab sweep covers the mechanism; it does not replay the
exact click sequence.

**A filter change is not driven.** It would mean re-rendering the harness with
different view props; the selection lives above that and is not keyed on it, but
that is reasoning rather than a check.

**jsdom draws no chart.** `chartDrawn()` asserts a chart container exists, not
that lines are visible at a readable scale. The Revenue-axis observation from
the walk is out of scope and remains unmeasured.
