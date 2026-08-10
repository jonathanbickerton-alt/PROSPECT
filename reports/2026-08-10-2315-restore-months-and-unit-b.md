# The restore threw its months away — over-decline diagnosed, and Unit B closed

## FOR ADVISOR

```
Generated: 2026-08-10 23:15 +0100 (UTC 2026-08-10 22:15)
Certifies: 0d4c40c, branch main, tree CLEAN.
Repo: committed 0d4c40c, pushed (origin in sync)
OVER-DECLINE CONFIRMED, and it is the ORIGINAL ARTEFACT'S CAUSE. All three
  import sites set historicalMonths: [], discarding the save's Historical_Months
  column. deriveAggregate takes asOf from the union of its leaves' months, so
  empty arrays make asOf NULL and NO leaf passes the as-of gate — suspect (b),
  sharper than expected: at runtime there is no as-of month at all.
BEFORE seed-or-decline that summed the seed to 0 while flows accumulated — the
  seedless 40K climb, on a save whose leaves all carry real seeds. AFTER it the
  same condition surfaced as an honest decline. Right behaviour, wrong input.
WHY THREE SESSIONS MISSED IT: every probe built its store by FITTING, which
  populates historicalMonths as a side effect. Restore reads a file instead.
FIXED: parseStoredMonths(), one shared reader, all three sites. On the REAL save
  Corporate|Fixed Connectivity resolves seedBaseKnown=true with a 123,699-scale
  opening stock — continuous, not origin-start.
FIRST BEHAVIOURAL COVER HERE: spec:restore-base drives Jon's actual file and
  REPRODUCES the artefact — same store, months discarded, seed collapses to 0,
  with a contrast check proving months alone are the difference. Trap 51 replants
  the discard; the spec SKIPS loudly if the save is absent.
UNIT B CLOSED: Step 1's notice reads canShowBaseForecast. Can-show says the PANEL
  has no band (true, about the panel); declined gives the opening-stock reason.
  Both directions asserted. K SUPERSEDED. Two specs pinned the old flat notice,
  went red at the change, and were re-pinned — the pins working.
RE-MEASURED: 74/72/2; MAPEs 13.8845/13.4315/14.3888/13.0192. Unmoved. GATE: 30
  specs, guard-traps 49/49, traps 3/3, lint and build clean, parity 0.
QUEUED FOR JON, not pre-empted: if genuine unknown-seed cases appear in real data,
  the choice between honest absence, a labelled "cumulative net adds" series, and
  alternative seeding is yours.
State: both parts complete, pushed. Verification recipe below.
```

---

## Part 1 — the over-decline, diagnosed and fixed

### What the decline was reacting to

`deriveAggregate` computes its as-of month from the union of its leaves'
historical months:

```ts
for (const lf of leaves) for (const m of lf.historicalMonths) monthUnion.add(m);
const asOf = historicalMonths.length ? historicalMonths[historicalMonths.length - 1] : null;
const present = asOf !== null && lf.historicalMonths.includes(asOf);
```

and all three import sites did this:

```ts
historicalMonths:      [],          // App.tsx:815, 920, 1123
```

The save **has** the data — `Historical_Months` is a comma-separated list,
`"2023-01, 2023-02, …"` — and the import threw it away. Empty arrays on every
leaf make `asOf` null, so `present` is false for every leaf, so **no leaf
contributes to the seed**.

That is suspect **(b)** from the brief — the runtime as-of disagreeing with the
file's apparent 2025-12 — though the disagreement is sharper than expected: at
runtime there is no as-of month *at all*.

### It explains both symptoms, which is what makes it the answer

| | condition | result |
|---|---|---|
| before seed-or-decline | no leaf passes the gate | seed sums to **0**, flows accumulate → the seedless 40K climb |
| after seed-or-decline | no leaf passes the gate | seed is **absent** → honest decline |

Same cause, two symptoms, and the second is the first made visible. **The
decline was correct behaviour on wrong input** — an over-decline, exactly as the
brief's prima facie reading had it.

### Why three sessions could not reproduce it

Every probe built its store by **fitting**, and `calculateBaseForecast` populates
`historicalMonths` as a side effect. The restore path does not fit — it reads a
file. A probe that *models* restore rather than *driving* it cannot see the
difference, which is the lesson this codebase has already recorded twice about
specs that model what they check.

The measurements in `2026-08-10-0940` were all correct and none of them was
looking at the restored objects.

### The fix, and what it measures on the real save

`parseStoredMonths()` — one shared reader for all three sites, parsing the
export's own `join(', ')` format. Driven against Jon's 07 Aug file:

```
restored months per fit          : populated, real yyyy-MM
Corporate|Fixed Connectivity     : seedBaseKnown = true
  opening stock                  : 123,699-scale   (was: absent, and before that 0)
  first forecast base            : continues the stock, not an origin start
```

### The behavioural trap the constructed ones could not be

`spec:restore-base` is the first spec in this family driven by real saved data.
Beyond asserting the fix, it **reproduces the artefact causally**: it rebuilds
the same store with `historicalMonths: []` and shows the seed collapse to `0`,
with a contrast check proving the months alone are the difference.

Guard-trap 51 replants the discard in `App.tsx`. The spec **skips loudly** when
the save is not on the machine — a spec that silently passes without its subject
is worse than one that is not there.

### Recorded, not pre-empted

If genuine unknown-seed cases do appear in real data, the choice between honest
absence, a truthfully-labelled "cumulative net adds" series, and alternative
seeding is **Jon's**. Nothing in this session's code pre-empts it: the decline
stays as built, and this fix only stops the app from throwing away information
it already had.

## Part 2 — Unit B, closed

Step 1's Base notice now reads `canShowBaseForecast`, the same predicate Step 3
uses, and branches:

- **Can show** — the panel says it has no band to render, which is true and is
  about the panel. It no longer asserts that a summed aggregate *has no Base
  series*, because that stopped being true when the seed became explicit.
- **Declined** — the opening-stock reason, the same fact Step 3 declines on.

Both directions are asserted, and a check pins that the two messages actually
differ, so the predicate cannot be wired in while changing nothing on screen.

**K's Base-on-aggregate limitation is superseded.** A summed aggregate with
all-present-seeded leaves does have a Base series; it is reconstructed at read
time rather than fitted.

Rendering the reconstructed series *inside* Step 1's panel remains out of scope —
the panel is band-driven and a stored fit carries no Base band, which is what the
can-show message now says accurately. That is a panel-architecture question, not
a wiring one, and it is not held silently: it is what the message states.

## Two specs went red, and that is the pins working

`walk-fixes` and `step1-panel` both pinned the old flat notice string. The Unit B
change replaced it, and both went red rather than passing over the change. Each
was re-pinned to the two branches — and `step1-panel` gained a check that the old
impossibility claim is no longer rendered at all.

## Gate

30 specs green; **guard-traps 49/49** including behavioural trap 51; `traps` 3/3;
lint and build clean; i18n parity 0 missing. §33 with scope named: **main's
working tree and build output are AI-free**; history and remote branches out of
scope, the preserved `ai-capability` branch expected.

```
PINNED ARPU MAPEs: 13.8845 / 13.4315 / 14.3888 / 13.0192   spread 1.3696pp
edge fixture: 74 leaves, 72 fit, 2 unfittable
restore-base 15/15   base-seed 31/31   step1-panel 54/54   walk-fixes 82/82
```

## Verification recipe for Jon

On the restored 07 Aug 10:26 save:

1. **Step 3 → Base view → Corporate | Fixed Connectivity.** Expect the Base line
   **PRESENT and continuous**, opening around **124K**. Not absent, and not an
   origin-start ramp. Both previous states are now failures.
2. **Check the Base score column** for that cohort — populated, for the same
   reason the line is.
3. **Step 1 → same aggregate selection → Base scenario.** Expect a notice saying
   the *panel* has no band and pointing at the Actuals Review chart — **not** the
   old claim that a summed aggregate has no Base series. Step 1 and Step 3 now
   answer the same question the same way.
4. **Save and reload once**, then repeat 1–3. The months and the known-ness both
   survive the round trip now; if anything changes across the reload, that is a
   finding.
5. **If you ever do see the decline fire** — Base absent with the reason about
   opening stock — capture the selection. That would be the first genuine
   unknown-seed case in real data, and it is the trigger for the queued decision.

## Where the walk stands

B-11 unaffected; the finish instructions in
`reports/2026-08-09-2113-step2-unlock.md` stand, including the Step 2 round trip
Jon still owes. The ragged-history fixture variant remains on the backlog — less
urgent now that trap 51 gives the family a behavioural target, but still the
thing that would make traps 48–50 behavioural too.
