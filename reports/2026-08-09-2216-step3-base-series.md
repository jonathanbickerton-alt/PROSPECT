# Step 3's Base series — mechanism found, fabrication does not reproduce at HEAD

## FOR ADVISOR

```
Generated: 2026-08-09 22:16 +0100 (UTC 2026-08-09 21:16)
Verified against: HEAD 01cfa18, branch main, tree CLEAN. NO CODE CHANGED.
DOES NOT REPRODUCE AT HEAD. Both classes on ONE store, Corporate|Fixed
  Connectivity: last ACTUAL aggregate Base 2026-06 = 3984, first FORECAST
  2026-07 = 4009 — 0.6%, continuous, climbing 515 over 24 months. Jon saw a
  near-zero intercept, ~1.8K/month, ~40K. Not this store.
MECHANISM IDENTIFIED ANYWAY. FvA multiChartData:2172 rolls a stock per leaf —
  b = seedBaseVolume || 0, then b = max(0, b + prevIn - prevOut) — and SUMS leaf
  seeds (:2260); :2316 is the same recursion for a leaf. Seeded right it is
  continuous; seeded 0 it is the reported shape: slope = in - out, intercept 0.
THE SWITCH IS DATA, PER LEAF: worker.ts:514 seeds from that leaf's last
  Base-METRIC reading, or 0 if it has none. A subset of unseeded leaves
  under-seeds the aggregate sum. ALL SIX SHIPPED FIXTURES CARRY Base rows, so
  the shape cannot come from shipped data at HEAD — Jon's screens came from
  another fixture, an older HEAD, or leaves missing Base rows inside a file.
TWO PREMISE CORRECTIONS, measured. (1) OPTION (b) AS WRITTEN IS NOT AVAILABLE:
  leaf fits carry NO Base mean series — month.base is null on leaves and on
  deriveAggregate — nothing to sum. (2) The aggregate path is not unseeded by
  design; it already sums leaf seeds.
GIT: the recursion predates the dead-chartData deletion (present at 432837d) and
  survived in multiChartData, the LIVE memo. Not introduced since.
K's LIMITATION STANDS: Step 1 shows an empty panel for Base-on-aggregate while
  Step 3 draws a line — the surfaces disagree even when that line is right.
NO FIX, NO SPEC, NO TRAP: a spec would assert a shape I cannot produce and a
  trap would replant a defect the data cannot express.
Decisions needed: (a) honest absence vs (b-corrected) seed-or-decline, set out
  below; and does Jon still have the fixture those screens came from?
State: HOLD. Nothing merged, nothing moved. B-11 unaffected.
```

---

## Provenance and method

HEAD `01cfa18`, tree clean. **No product code, spec, fixture or EXPECTED.md
entry was changed.** Everything below is measurement.

The brief required both behaviours on ONE store before diagnosing, because the
two screenshots showed different horizons. Done: a single store built on the
edge fixture, `Corporate|Fixed Connectivity|All|All|All|All|All`, 3 leaves, all
fitted, with the worker's own seed rule reproduced.

## The finding does not reproduce at HEAD

```
last ACTUAL aggregate Base  2026-06 = 3984
first FORECAST base         2026-07 = 4009
DISCONTINUITY                       =   25   (0.6%)
climb over 24 months                =  515   (~21/month)
```

Jon's screens show a near-zero intercept climbing ~1.8K/month to ~40K over 24
months. **This store produces a continuous line.** The per-leaf seeds are real
and non-zero — 1140, 1944, 900 — and they sum to 3984, the aggregate's own last
actual Base.

**A first pass measured a seed of exactly 1000 on every leaf and I nearly
reported it.** That was my harness: `seedBaseVolume` is the third *argument* to
`calculateBaseForecast`, and my probe was passing 1000. Corrected by
reproducing the worker's rule instead of inventing one.

## The mechanism, which is real regardless

`ForecastVsActualsTab.tsx:2172`, inside the **live** `multiChartData` memo:

```ts
let b = bf.seedBaseVolume || 0, pIn = bf.lastHistoricalInflow || 0, pOut = bf.lastHistoricalOutflow || 0;
for (const m of sortedM) {
  b = Math.max(0, b + pIn - pOut);
  bmap.set(m.month, b);
  pIn = m.inflow.mean; pOut = m.outflow.mean;
}
```

built per leaf and summed across leaves; `fcSeedBase` at `:2260` is
`matchFcs.reduce((s, bf) => s + (bf.seedBaseVolume || 0), 0)`. The leaf path at
`:2316` is the identical recursion with a single seed.

**Seeded correctly this is right** — a stock rolled forward by net flows.
**Seeded zero it is precisely the reported artefact**: intercept 0, slope
`inflow − outflow`, i.e. a cumulative net-adds integral with no opening base.

### The switch is in the data, per leaf

`src/workers/forecasting.worker.ts:514`:

```ts
const seedBase = baseReadings.size > 0
  ? (baseReadings.get(Math.max(...baseReadings.keys())) ?? 0)
  : 0;
```

`baseReadings` collects rows whose metric equals the mapped **Base** value, for
that leaf. **A leaf with no Base rows seeds at 0 and contributes 0 to the
aggregate sum.** So the artefact does not need a fixture with no Base column at
all — a *subset* of leaves lacking Base rows under-seeds the aggregate, and a
scope whose leaves all lack them produces the pure seedless integral.

All six shipped fixtures carry Base rows, which is why nothing here reproduces
it.

## Git classification

`git log -S "Build running base per bf"` returns `432837d` — the recursion is
long-standing. **It predates the deletion of the dead `chartData` memo and
survived in `multiChartData`, the live one.** It is therefore not one of the
deleted chart-side fabrications and was not introduced since; it is an older
path that has always depended on the seed being present.

## Two corrections to the brief's premise

**1. Option (b) as written is not available.** Leaf fits carry no Base mean
series. Measured month-0 keys on a real fit:

```
month, inflow, outflow, retention, arpu, inflowArpu, outflowArpu, retentionArpu, baseArpu
month.base  ->  null      (on a leaf fit AND on deriveAggregate's output)
```

There is no leaf `base.mean` to sum, so "extend `deriveAggregate` to SUM leaf
Base means" has nothing to operate on. Base is not a fitted series anywhere — it
is *reconstructed* by the recursion above, from a seed plus flows.

**2. The aggregate path is not unseeded by design.** It already sums leaf seeds.
The defect shape arises from a leaf contributing zero to that sum, not from the
aggregation ignoring seeds.

**K's limitation still stands, and the surfaces still disagree in principle.**
Step 1 renders an honest grey notice and an empty panel for Base-on-aggregate;
Step 3 draws a Base line for the same class. Even when that line is *correct*,
the two surfaces answer "can this selection show Base" differently — which is
the consistency requirement in the brief, and it is unmet at HEAD independent of
the fabrication.

## The decision — presented, not taken

**(a) Honest absence.** Step 3's Base view on a derived aggregate states the
reason from the shared enum and draws no series, matching Step 1's notice.
*Cost:* removes a line that is currently correct whenever every leaf has a Base
reading — on all six shipped fixtures, that is always. It would make both
surfaces agree by removing the more informative one.

**(b) as written — not available.** No leaf Base mean exists to sum.

**(b-corrected) Seed-or-decline.** Keep the recursion, and make the seed's
absence propagate instead of defaulting to zero: if any leaf in scope has no
Base reading, the aggregate Base series is *absent* rather than under-seeded —
mean absent, bands absent, exports empty, scorer skips. Exactly the ARPU-interval
precedent. Both surfaces then answer the same question with the same rule:
Base is available when it can be reconstructed from a real opening stock, and
not otherwise. *Cost:* `seedBaseVolume: number` cannot express absence, so it
needs a nullable companion or a flag; the `|| 0` at three sites becomes a
propagating null; and every consumer of the running base needs the absent case.

**My reading, offered as input and not as a choice:** (b-corrected) matches the
codebase's settled absence-propagation rule and keeps a correct line where the
data supports one, but it is the larger change and it touches a type that three
call sites read. (a) is small, immediately consistent with Step 1, and throws
away working output. This is the reserved kind of decision, so nothing was done.

**Under either option the seedless line goes**, as the brief requires — (a) by
drawing nothing, (b-corrected) by refusing to draw an under-seeded one.

## What I would need to close it

1. **The fixture or saved session behind those screens.** Jon's numbers —
   ~1.8K/month, ~40K over 24 months — are an order of magnitude above the edge
   fixture's scope. Its leaves would tell us immediately whether Base rows are
   absent for some of them.
2. Failing that, **which HEAD the screens were taken at**, since the store
   landscape has moved twice this week.

## Why no fix, no spec, no guard-trap

The brief asked for mounted specs and a guard-trap replanting the seedless line.
Both presuppose the line. **It does not reproduce at HEAD on any shipped
fixture**, so a spec would assert against a shape I cannot produce, and a trap
would replant a defect the current data cannot express — it would pass for the
wrong reason and read as coverage. This repo fixes where mechanisms are
demonstrated; the mechanism is demonstrated *in the code* and the *behaviour* is
not, and those are different things.

The consistency gap between Step 1 and Step 3 **is** demonstrated and is not
data-dependent — but closing it is precisely the decision above.

## Where things stand

**HOLD.** Nothing merged, nothing moved, no figures touched — this session
measured and did not change, so 74/72/2 and the pinned MAPEs are untouched by
construction rather than re-measured, and I say so rather than quoting them as
though re-run.

**B-11 is unaffected.** The walk-finish instructions in
`reports/2026-08-09-2113-step2-unlock.md` stand, including the Step 2 round trip
Jon still owes. This finding does not block them.
