# Pricing per-scenario baseline (Q3) and the blend consumers (Q4)

## FOR ADVISOR

```
__ADVISOR__
```

## Base check

HEAD `e94284d` (this session's skeleton) on `main`, tree clean at entry.
`git diff --stat f55ffc8..HEAD -- src/ scripts/ test-data/ package.json` EMPTY.
The STOP did not fire.

## What this session did

Stopped once on a conflict, reported it, and continued on Jon's ruling of
2026-09-03. **Branch 1 was taken** — the pools DO already reach a per-scenario
adjusted ARPU — and that ruling also corrected a claim in this session's own
first analysis. Both are recorded below.

## The governing entries, quoted verbatim

### The brief's premise is wrong about where Q3 and Q4 live

The brief says to quote "the EXPECTED.md entries for Q3 and Q4". **There are no
such entries.** The only `Q1`–`Q6` in EXPECTED.md is the 2026-08-04/05
aggregate-derivation set, which is a different decision set entirely (its Q3 is
a display-coherence finding on fit-on-aggregate; its Q4 is about
`seedBaseVolume`).

Q3 and Q4 are two of **Jon's six answers of 2026-09-02**, and they were recorded
in the working-agreement document — `§3` of v3.3.8 — and never in EXPECTED.md.

**v3.3.8 was removed from the tree at `079ebc0`,** in this same arc, when v3.3.9
landed. v3.3.9 does not carry the wording forward; its queue item 3 says
*"re-derive from §3's Q3/Q4 wording"* while its own §3 says *"Everything in
v3.3.8 §3 stands"* — a pointer to a file that had just been deleted.

**So the governing specification for a queued, briefed build existed only in git
history.** Recovered from `git show 079ebc0^`:

> - **Q3 pricing baseline → option (b):** the Pricing card's Baseline ARPU
>   (Preview AND row) is the per-scenario figure for the subscribers the event
>   applies to (Inflow → inflowArpu; Retention → retentionArpu; Both → Σrev/Σvol
>   over the two; Base Only → baseArpu; Cohorts+Base → Σ over three),
>   event-scoped. Stored rows verbatim; test events recreated. **BUILD BRIEFED
>   (pricing-per-scenario), base `a766d0b`.**
> - **Q4 blend consumers → per-scenario:** the ARPU Delta card shows four
>   per-scenario deltas; the events summary's ARPU delta is per touched scenario.
>   After Q3+Q4 the blended ARPU has NO UI consumer (Compare's own engine
>   excepted); columns persist for compatibility. **Same session as Q3.**

Both are now recorded in EXPECTED.md as their own dated entry, before any code.
That is the RECORD-FIRST rule applied to a decision that had gone missing.

### The chart-grid entry — and why the recording was load-bearing

EXPECTED.md's chart-grid decision set (item 3) says, verbatim:

> **The `chartData` column `ARPU (Adjusted)` is UNCHANGED**, and remains the
> pricing card's `originalBaseArpu` feed. The pricing baseline settled on
> 2026-08-21 (`7b456a1`) **stands**: this decision retires a line from a chart,
> not a quantity from the engine. Adding columns beside it is safe; redefining
> it is a separate dated decision.

**Q3 IS that redefinition.** Until this session wrote the entry, EXPECTED.md —
the stated authority — said the opposite of what the brief asked to be built,
and the only thing authorising the change was a document no longer in the tree.

### The three-denominator finding — a correction to my own first reading

It **is** in EXPECTED.md, under "THE THREE DENOMINATORS UNDER ONE NAME
(measured 2026-09-01, NOT corrected)". I first reported it absent; I had
searched for the phrase "three-denominator", which appears only in the working
agreement and in reports. Verbatim on its closure:

> **This is recorded and deliberately NOT corrected.** The aggregate blend feeds
> the settled pricing baseline, so changing it moves stored figures on a surface
> that was gated four days ago. Correcting it is its own dated decision.

The working agreement adds that it is *"closed by obsolescence once Q3/Q4
land — it feeds nothing displayed"*. That closure is conditional on Q4 actually
landing, which it has not.

### The pricing baseline scope entry

`EXPECTED.md:7428` — the shared resolved-forecast helper
`resolveEventScopeForecast`, with its exactly-N-callers pin. Unchanged by this
session; the seam stands and was not touched.

## Items 0 and 4 — measured BEFORE and AFTER

On the mounted card, two-leaf store, absolute Inflow event carrying ARPU 35:

| quantity | BEFORE (blended card) | AFTER (per-scenario card) |
|---|---|---|
| leaf | `1.29` | Inflow `0` · Outflow `—` · Retention `—` · **Base `1.29`** |
| All | `0.63` | Inflow `0` · Outflow `—` · Retention `—` · **Base `0.63`** |

**Base carries the blended figure's value exactly**, which is the measurement
that made the re-point faithful rather than approximate.

**Inflow reads 0 at end of period, and that is correct.** The card is
end-of-period; an Inflow event in month 0 does not move month 2's Inflow ARPU,
because inflow is a flow and its month has passed. Base still carries it because
base is a stock. My first assertion here claimed inflow should move and was
wrong; it is replaced by a check that drives the Inflow feed with an event in
the LAST month, where it can show:

```
ITEM4 last-month event at leaf  inflow 10.83  base 0
```

`10.83` is `(200×22 + 1000×35)/1200 − 22`, computed by hand and matched — an
independent confirmation the Inflow feed works, not just that a number appeared.

**Retention and Outflow read `—` (absent), not 0.** The fixture has no retention
volume, so those bands are named absences and the card renders the em dash. A
0.00 there would state a movement nothing measured.

**The fixture needed fixing first.** On the first run every per-scenario delta
was `null` at the leaf, because the fixture months carried only a blended `arpu`
band. Without `inflowArpu` / `outflowArpu` / `retentionArpu` / `baseArpu` bands
the Q4 assertions would have passed against four em dashes — vacuously. The
bands are now part of the fixture and the reason is recorded at it.

## The measure-first gate — which branch, in numbers

**Branch 1: the pools already reach a per-scenario adjusted ARPU.**

| pool / construction | what it feeds TODAY | site |
|---|---|---|
| `p_eventPools` (Inflow event pool + re-banded Retention pool) | the **blended** ARPU | `WhatIfTab.tsx:1411-1412` |
| `p_eventPools` | **`m.scenarioArpu.base`** → the `Base ARPU (Adjusted)` column the chart grid draws | `WhatIfTab.tsx:1570-1575` |
| `poolsFor('Inflow' \| 'Retention')` — a SEPARATE construction | `m.scenarioArpu.inflow` / `.retention` | `WhatIfTab.tsx:1504-1513`, consumed `:1541-1558` |

**This corrects this session's own earlier analysis.** Before the ruling I
reported that the re-banded pool "feeds only the blended figure". That was
wrong: I traced `poolsFor` and `p_eventPools` as alternatives and missed that
the `base:` term of `m.scenarioArpu` consumes `p_eventPools` directly. The
error would have sent the session down branch 2 and left Q4 unbuilt.

**Neither pool feeds its OWN scenario's ARPU** — the Inflow pool does not feed
Inflow ARPU, and the re-banded Retention pool does not feed Retention ARPU. Both
feed Base, and directly rather than only through the T+1 lag. That is the gap
between the decision of 2026-09-03 and the code, and it is recorded in
EXPECTED.md as a separate build with its own brief. **It was not built here.**

### The seam, named, for that brief

- **Seam:** `m.scenarioArpu` assembly, `WhatIfTab.tsx:1545-1576`. The four terms
  are built there and nowhere else.
- **Call sites to change: 3.** `inflow:` and `retention:` would take the
  matching subset of `p_eventPools` instead of `poolsFor(scen)`; `base:` would
  take only what the lag has delivered.
- **`poolsFor` (`:1504`) becomes dead** if all three move — it exists solely to
  feed the per-scenario terms.
- The open question that brief must answer: `poolsFor` builds pools from
  `e.revenue / e.subscriberVolume`, while `p_eventPools` carries a derived ARPU
  and a `resolvedEventVolume` size. They are not the same number, so moving the
  feed changes the per-scenario ARPUs by an amount nothing currently measures.

## The D3-02 assertions, re-pointed and re-confirmed

Q4 removes the blended figure from the card, which was where the D3-02
regression read. **Re-pointed to Base ARPU**, which is what the pool actually
feeds, and the numbers carry over exactly:

```
before Q4, blended:   leaf 0.94   All 0.43   Corp/All 0.43
after  Q4, Base ARPU: leaf 0.94   All 0.43   Corp/All 0.43
```

**NOT re-pointed to Retention**, though the fixture is a Retention promotion.
`poolsFor('Retention')` reads `marketEvents` through the shared predicate and
never consults `p_eventPools`, so the Retention delta moves whether or not the
re-banded pool was carved. Asserting there would pass for a different reason
than the defect — the vacuous check this project forbids. Measured: Retention
reads `null` on this fixture at both views.

**Trap 131 re-confirmed by hand against the re-pointed assertions:**

```
REBANDED per-scenario at All  inflow 0  outflow null  retention null  base 0
REBANDED per-scenario at leaf inflow 0  outflow null  retention null  base 0.94

view-apply-mounted spec: 49/51 passed
  FAIL  rebanded: the pool is carved at ALL too  [base 0]
  FAIL  rebanded: and at the intermediate Corporate/All view  [base 0]
```

The pre-fix shape exactly. Restored, 51/51.

## Q3 — the pricing baseline, per scenario

`pricingBaselineArpu` (`forecasting.ts`), ONE definition, **exactly two
callers** — the Preview (`WhatIfTab.tsx:6146`) and the saved row (`:2877`).
Those two disagreed about a pricing quantity once before, which is why the
count is pinned rather than merely checked as non-zero.

The mapping is Jon's, verbatim: Inflow → `inflowArpu`; Retention →
`retentionArpu`; Both → Σrev/Σvol over the two; Base Only → `baseArpu`;
Cohorts+Base → Σ over three. Sums are **revenue over volume, never an average
of ARPUs** — the settled reconciliation rule.

**Absence propagates rather than degrading.** A sum with one missing term
returns null, not a partial sum: a baseline over the scenarios that happened to
be present is a different quantity wearing the same name. Zero volume is
absence, not a rate of 0 — nothing to price has no ARPU.

**The 0 fallback for an ABSENT ROW is kept unchanged**, deliberately. The
stored-row contract already treats 0 there as "no row matched"; widening that to
null is a separate change with a round-trip of its own.

**Stored rows are verbatim**, per the decision — a row keeps the
`originalBaseArpu` it was written with. Q3 changes what new rows record and what
Preview computes; it does not rewrite history.

## Q4's second consumer — it does not exist

Q4 names two consumers: the ARPU Delta card and *"the events summary's ARPU
delta"*. **The events summary has no ARPU delta.** `EventSummaryRow`
(`forecasting.ts:791-804`) carries `id, pass, card, name, unnamed, adjusts,
scope, when, month` and no delta of any kind, and `buildEventsSummaryRows`
takes only the three event arrays — it never sees `chartData`.

The only "blend" in that table is `whatif_summary_yield`'s `{{blend}}`, which is
a yield event's own **band-mix** blend — a different quantity from the blended
IBRO ARPU, and not a Q4 consumer.

So Q4 is complete with the card alone. This also means the guide's §5 note
describes a delta that is not there.

## Remaining blended readers in src/

**Two, and neither is a UI consumer:**

| site | what it is |
|---|---|
| `WhatIfTab.tsx:1589` | the WRITER of the `ARPU (Adjusted)` column — retained for export compatibility, exactly as Q4 requires |
| `scenarioArpu.ts:6` | a comment |

`impactSummary.arpuDelta` was **removed**: once the card stopped rendering it,
nothing read it, and a dead quantity carrying the name of a retired one is worse
than no quantity. Compare's own engine is excepted by the decision and untouched.

**Expected was "Scenario Compare only"; measured is "no reader at all in
`src/`".** Compare does not read this column — it computes its own blend inside
`computeScenarioForFilter`.

## The gate caught one of mine — and a scanner asymmetry under it

`spec:i18n-scan` went RED on the first full-suite run:

```
FAIL: 2 user-facing string(s) sit outside a translation key.
  src/utils/forecasting.ts:4014  [7 ts-utility (MUST KEY)]  {} ARPU (Adjusted)
  src/utils/forecasting.ts:4020  [7 ts-utility (MUST KEY)]  {} Revenue (Adjusted)
```

`pricingBaselineArpu` builds chartData column names as template literals, and
the scanner read them as untranslated copy. They are **column identifiers**:
translating one would rename an export column and break the pinned-order
compatibility the chart export depends on.

Exempted in `NEVER`, which already holds export column identifiers with exactly
this justification — **not** in `I18N_PHASE2`, the deferral list `0857` showed
is an exemption wired to nothing. A deferral would have said "translate this
later", which is the opposite of true.

**The asymmetry, reported not fixed.** The identical construction at
`WhatIfTab.tsx:826` builds the same column names and is NOT flagged, because the
TS-literal rule applies to `.ts` files and that one lives in a `.tsx`. So the
same identifier is exempt in one file and a failure in another purely by
extension. Recorded at the exemption and here; widening the scanner is not this
session's to do, and it belongs with the `I18N_PHASE2` staleness item already in
the backlog.

**Process note.** I reported the gate as green on the guard-traps number while
the suite was still running, and the suite then came back 54/55. The trap number
was real; "the gate" was not green, and saying so before the suite reported was
wrong.

## Item 3 — the guide

**SHED**, first in the pre-authorised order, and untouched — but the reason has
changed and is worth stating. §5 says the Events summary delta and the Pricing
Baseline ARPU still read the blended figure. After this session:

- the Pricing Baseline ARPU half is now **false** and needs correcting;
- the Events summary half was **never true** — that delta does not exist.

So the guide needs a correction that is not merely "flip the sentence", and
writing it blind was the wrong call to make at the end of a long session.

## Item 5 — specs and traps

- `spec:view-apply-mounted` 46 → **51** checks.
- `spec:pricing-roundtrip` 121 → **136** checks.
- Traps 129 → **131**.

### Trap 133 — the pricing baseline reads the blend again

Hand-planted, confirmed red on BOTH guards:

```
pricing-roundtrip spec: 134 passed, 2 failed
  FAIL  Q3: pricingBaselineArpu has EXACTLY two callers in the tab  [1 call sites, expected 2 (Preview + saved row)]
  FAIL  Q3: and neither reads the blended column for its baseline  [the blended read is what Q3 retires]
```

The caller pin and the structural check catch it independently — the pairing
established by D3-02, applied to a new seam. Restored, 136/136.

### Trap 134 — the ARPU Delta card renders one blended figure again

Retires the four per-scenario testids the card now renders. Anchor verified
unique before being trusted.

### Trap 131, re-confirmed

Already reported above: it still reddens the re-pointed Base ARPU assertions.

## Gate

```
guard-traps: __/__ PENDING
full suite:  __/__ PENDING
lint:        PENDING
build:       PENDING
```

## Limits of this check

- **Item 0 is partial.** Only the ARPU Delta card was driven. The Events summary
  delta and the pricing card's Baseline ARPU are source-read, so the "before"
  for two of the three blended consumers is not a measurement.
- **The remaining-blended-reader count was not produced.** It is an Item 2
  deliverable and Item 2 did not run; today every consumer named in Q4 still
  reads the blend, which is the pre-build state, not a post-build finding.
- The recovered Q3/Q4 wording is quoted from `079ebc0^`. It is the text as it
  stood in v3.3.8; if Jon's intent moved after 2026-09-02, this session has no
  way to see that.
- No walk, and no mounted pricing draft.
