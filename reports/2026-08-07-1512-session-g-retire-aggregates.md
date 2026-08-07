# Session G — retire fit-on-aggregate

## FOR ADVISOR

```
Generated: 2026-08-07 15:12
Certifies: none — HELD, one decision required
Finding: both fit-on-aggregate write paths removed; read-time retirement rule in at the seam
Finding: Jon's artefact was LOCATED and used — stage 2 ran on the real file, not a substitute
Finding: artefact holds 541 keys, exactly ONE fitted All-bearing — the named key, and only it
Finding: that key moves; inflow -2.06%, outflow -0.15%, retention -2.77%, ARPU +2.20%
Finding: 540 of 541 keys unchanged — "no further" verified by enumeration, not assertion
Finding: derivation SUCCEEDS after reload (27 leaves present) — no number becomes null
Finding: BLOCKER — session import bypasses the seam; Jon's file lands Step 1 on the stale total
Finding: the bypass is introduced-in-effect — this change is what made the two paths disagree
Finding: no figure from any earlier walk moves; spec:derive and spec:leafgrain re-run identical
Finding: trap 13 MISSED first run — spec transcribed the seam; fixed with a structural guard
Finding: "two depths" was stated, the artefact contains one — second depth absent, not verified
Decision (Jon): fix the import bypass in this branch, or merge and carry it to Session H?
Decision (Jon): the unnamed second depth — was it saved, or never created?
State: HOLD. Pre-authorisation was for a clean run; this run is not clean.
```

---

## What changed

Aggregates are derived from leaves. Two paths could still fit a model directly
to one, and both are gone.

**Path A, the manual Step 1 route.** `generateStandardForecast` now declines when
any dimension is "All (Aggregated)", with a message, rather than silently doing
nothing. Declining explicitly is deliberate: a silent no-op would read as a bug.
Session H replaces the decline with generating the missing leaves.

**Path B, the bulk companion fit.** Bulk generation wrote a second, channel=`All`
fit beside each leaf. Its stated justification — so `dims.product=true` rows find
an exact-match key — is answered by derivation now, and the comment left in its
place records that.

**The rule, `isRetiredAggregateFit`.** That fixes what gets written and nothing
about what is already written. Every session saved before today carries fitted
forecasts under All-bearing keys, and the seam is store-first, so those stale
fits would win over derivation permanently. A stored forecast is now ignored when
its provenance is `fitted` **and** its key contains `All`. It is read-time, not a
migration — no import path can bypass the seam, which turned out to be the one
claim in this session that was wrong, see below. It does not delete: the entry
stays as a record rather than an authority.

Both halves of the condition are load-bearing, which is why the spec has two
cases. Drop the `fitted` test and it retires every derived aggregate — that is
every answer the seam produces. Drop the All-bearing test and it retires every
leaf fit. Traps 13 and 14 are those two widenings, one per direction.

## The artefact

Jon's confirmation named the file as a literal placeholder, so it was not
supplied. Rather than fall back to a constructed equivalent, the real file was
located by timestamp and **identified by content**: exported 07 Aug 10:26, before
any Session G change; `Baseline_Forecasts` holds 541 distinct keys × 24 months;
exactly one key is both `fitted` and All-bearing, and it is
`Corporate|Fixed Connectivity|All|All|All|All|All` — the key Jon named.

That matters more than convenience. The whole reason this session was held before
it began is that an artefact built against a partly-changed build is a weaker
witness than one built against the build it represents, and carries no record of
which it was. Grading the branch on a constructed stand-in would have reproduced
that defect in a different place.

**The confound, resolved before anything was graded.** The file holds 541 keys
while metadata claims 32,395 cohorts, which would mean the leaf set was truncated
and the whole comparison contaminated. It is not truncation: the export writes
`forecastStore` only, while the metadata figure adds `forecastStore.size` to the
separate legacy `savedForecasts` count — two populations reported as one. Counting
distinct 7-dimension combinations in the `Actuals` sheet independently gives 540
leaves, 27 of them under `Corporate|Fixed Connectivity` — matching the file
exactly. The leaf set is complete.

## What moves

The named key, and nothing else. Measured by driving the real imported
`isRetiredAggregateFit` and `deriveAggregate`, not a transcription:

| metric | stored (fit-on-aggregate) | derived (sum of 27 leaves) | change |
|---|---|---|---|
| inflow | 375,624.74 | 367,906.31 | −2.06% |
| outflow | 325,487.81 | 324,990.60 | −0.15% |
| retention | 254,602.64 | 247,553.43 | −2.77% |
| ARPU (vol-weighted) | 15.9485 | 16.2993 | +2.20% |

The direction is the expected one: fitting a curve to summed history overstates
against summing individually-fitted leaves.

**The "no further" half was verified by enumeration.** All 541 keys were resolved
and compared on all four metrics; exactly one changed. That is the more important
half — a rule that corrects the right number while quietly moving others would
look identical in a single-key check.

**Derivation succeeds.** All 27 leaves are present after reload, so the seam
returns a derived aggregate rather than null. A rule that turned a wrong number
into *no* number would be a different outcome and its own decision; that is not
what happens.

## The blocker

**Session import does not go through the seam.** `src/App.tsx:868` takes the
`Is_Active` row directly into `setBaseForecast`. On Jon's artefact, `Is_Active`
is set on the retired key itself — so opening that file lands Step 1 on the stale
fitted total, and holds it until a filter change or tab switch routes through
`resolveForecast` and silently replaces it.

This is the branch's to own, though the import lines are textually unchanged.
Before this change the bypass was harmless: the seam returned whatever was
stored, so a raw read and a resolved read could not disagree. This change is the
first thing to make them disagree, and it disagrees exactly for the keys an
imported old session is carrying. That is the mirror of the shrinking-blast-radius
rule — a diff that makes a previously-consistent pair of paths inconsistent owns
the inconsistency.

The general shape is recorded in EXPECTED.md, because it will recur: **making a
seam selective does not make it the only door.** Every raw store read that agreed
with the seam by accident becomes a divergence the moment the seam starts
refusing things. One other candidate was checked and cleared —
`acceptChallengerModel` reaches the store only behind a `derivedMix` computed from
`resolveForecast`, so it inherits the rule.

The fix is small and obvious, which is exactly why it is being reported rather
than applied: pre-authorisation was for a clean run.

## The trap that missed

Trap 13 (restore store-first in `App.tsx`) reported MISSED on its first run and
the miss was the spec's fault, not the trap's. `resolveForecast` is a closure
inside `App` and cannot be driven headlessly, so the spec's `resolve()` is a
transcription of the seam — mutating `App.tsx` could not turn it red. A correct
rule that nothing calls.

The wiring now has a structural source guard: no store-hit return in either
closure may be ungated, with comments stripped first so the docstring beside the
call cannot satisfy it, and an anti-vacuity control asserting there is a return
to guard at all. Structural rather than a pinned sentence because traps 2–4
already taught that lesson — three respellings of one defect walked past a guard
that matched trap 1's exact text.

Worth noting against the blocker above: this is the *second* time in one session
that the same class of gap appeared — a rule verified in isolation while the path
that actually reaches it went unchecked. The trap caught the first. The gate
caught the second.

## Gate

- **Stage 1, ui-consistency** — lint and build clean. Three findings, none
  actionable: the new modal row uses `items-start` where sibling *status* rows
  use `items-center`, which is correct for a wrapping multi-line informational
  row and matches the existing scale-warning pattern; the new `setError` is the
  only one in that function wrapped in `t()`, which makes it the conforming one
  rather than the outlier; and both new keys carry English text in all six
  locales — verified as a pre-existing codebase-wide condition, 220 of 681 keys
  (32.3%) are identically English across every non-EN locale, so these two join a
  backlog rather than creating one.
- **Stage 2, qa-tester** — as above. Confound resolved, direction and no-further
  measured on the real artefact, blocker found.
- **Stage 3, regression-guard** — 22 items assessed, 0 N/A. One FAIL, the same
  blocker, independently located and classified as introduced-by-branch. No
  figure from any earlier walk moves: the rule only alters keys that are both
  `fitted` and All-bearing, and no recorded figure depends on one —
  `spec:derive`'s pinned ARPU MAPEs and `spec:leafgrain`'s 72-of-72 were re-run
  and came back identical, and the pro-rata figures come from a path with zero
  diff.
- `spec:retire` 22/22, `guard-traps` 14/14, `traps` 3/3, all sixteen other
  `spec:*` green at established counts, typecheck 0, build clean.
- Scoped no-AI: clean on the diff; no API key in the diff; `.env` untracked.

## Decisions

1. **The import bypass** — fix in this branch (route the restored active forecast
   through `resolveForecast`), or merge as-is and carry it into Session H, which
   is already touching this area? The recommendation is to fix it here: Jon's walk
   opens with loading a session, so leaving it means the walk's first screen shows
   a number this session exists to remove.
2. **The unnamed second depth** — the confirmation says "two depths"; the artefact
   contains one. Was the second saved, or never created? If it exists in another
   file, it should be graded before merge; if it was never created, the record
   should say so rather than leaving a claim nobody checked.

## State

**HOLD.** Branch `session-g-retire-aggregates` at `7578038` plus one follow-up
commit recording the divergence in EXPECTED.md. Not merged. Pre-authorisation was
explicitly for a clean run, and a stage-3 FAIL is not one.
