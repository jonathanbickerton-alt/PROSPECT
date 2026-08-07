# Session G — merged

## FOR ADVISOR

```
Generated: 2026-08-07 17:48
Certifies: 4fb6b15 (merge of session-g-retire-aggregates at f987cbe) — MERGED to main
Finding: both fit-on-aggregate write paths removed; stale stored fits retired at read time
Finding: the blocker was reach, not the rule — session import read the store raw
Finding: seam extracted to pure resolveFromStore; import calls it with the restored store
Finding: passing the store IN also removed a hazard — App's closure holds uncommitted state
Finding: all 11 setBaseForecast sites classified BY SITE, per-function counts pinned
Finding: measured on Jon's real save file — 27 leaves, inflow -2.06%, ARPU +2.20%
Finding: 540 of 541 keys unchanged; enumerated, not sampled
Finding: legacy import deliberately NOT routed — 'All' there means "column absent"
Finding: two spec defects found by trap/gate, both had PASSED; both recorded
Decision taken: import bypass fixed in-branch, not deferred to Session H
Decision taken: one aggregate was generated, not two — expected set was correct
Open (pre-existing): accept-challenger writers store `fitted`, safety rests on a UI gate
State: MERGED. Session H next — generate-the-missing-leaves replaces the Step 1 decline.
```

---

## What merged

Aggregates are derived from leaves, always. The manual Step 1 path declines when
any dimension is "All (Aggregated)"; the bulk `channel='All'` companion fit is
deleted. Stored fitted forecasts under All-bearing keys are ignored at read time
by `isRetiredAggregateFit` — fitted **and** All-bearing, never broader, and not
deleted: the entry stays as a record rather than an authority.

## The thing worth remembering

The rule was correct and specced from the start. What was wrong was its reach.

`resolveForecast` is not the only route from the store to the screen. Session
import took the `Is_Active` row straight to `setBaseForecast`, and on Jon's own
artefact that row **is** the retired key — so opening the file landed Step 1 on
the stale total until a filter change silently replaced it. Worse than showing it
permanently: the number that appears first is the one people write down.

Before this change the bypass was harmless, because the seam returned whatever
was stored and a raw read could not disagree with it. **Making a seam selective
does not make it the only door.** Every raw read that agreed with it by accident
becomes a divergence the moment it starts refusing things.

The fix makes the seam literally one function: a pure
`resolveFromStore(store, leafMap, key)` that `resolveForecast` delegates to and
import calls directly. Passing the store *in* was not stylistic — the import path
**cannot** call `resolveForecast`, because at that moment `setForecastStore` has
not committed and the closure still holds the store being replaced. A fix that
looked right would have resolved against stale state.

## The claim is now verified, not sampled

All 11 `setBaseForecast` call sites are enumerated and classified: 2 inline
seam-routed, 2 seam-routed via destructuring (verified against the function
body), 2 in `generateStandardForecast` behind the aggregate decline, 1 in
`acceptChallengerModel` where provenance is overwritten to `accepted`, 2 in
session import, 2 carried as residual risk. Per-function counts are pinned, so a
new call inside an accounted function fails the spec rather than inheriting a
reason nobody re-checked.

**One site is deliberately not routed**, and it is the interesting one. The
legacy pre-option-C import manufactures its keys by defaulting *absent columns*
to `'All'` and its provenance to `fitted` — so the rule would retire nearly every
legacy forecast, with nothing to derive from, and old files would stop loading.
An `'All'` part means "aggregate over this dimension" only for keys built by the
current enumeration; where a key was built by defaulting a column that did not
exist, the same marker means something else. The rule reads a marker, and a
marker is not always evidence of the thing.

## Measured on the real artefact

Not a stand-in. The file was located by timestamp and identified by content: 541
keys, exactly one both `fitted` and All-bearing, matching the key Jon named.
After the fix it resolves to `derived`, leafCount 27, and is not the stored
object.

| metric | stored fit-on-aggregate | derived from leaves | change |
|---|---|---|---|
| inflow | 375,624.74 | 367,906.31 | **−2.06%** |
| outflow | 325,487.81 | 324,990.60 | −0.15% |
| retention | 254,602.64 | 247,553.43 | −2.77% |
| ARPU (volume-weighted) | 15.9474 | 16.2990 | **+2.20%** |

540 of 541 keys unchanged — enumerated, not asserted. In EXPECTED.md as UAT
context: fitting one curve to summed history overstates volume because a single
smooth fit cannot reproduce 27 leaves' individual turning points; ARPU moves the
other way because it is a ratio. Nothing was re-forecast — the leaves are the
same leaves the old session held. Only the arithmetic joining them changed.

## Two specs that passed and should not have

Both were found by the harness rather than by reading, which is the argument for
the harness.

**Trap 13 MISSED.** The retire spec transcribed the seam instead of driving it,
so mutating `App.tsx` could not turn it red — a correct rule that nothing called.
Fixed with a structural source guard, comments stripped so a docstring cannot
satisfy it, plus an anti-vacuity control.

**The call-site table cleared two sites with a false reason.** It accounted for
`acceptPreviewForecast` and `acceptAllChallengerModels` under "provenance is
`accepted`, which the rule never retires". `kind: 'accepted'` is set in exactly
two places in App.tsx and neither is theirs. It passed because it matched sites
by *argument spelling* and accepted a site if any row's pattern fit — so a row
written for one function silently absorbed sites in others. A reason not bound to
a specific site is not a reason; it is a shape that happens to fit.

Also worth recording: when the seam moved out of App, `spec:retire`'s **anchor**
check went red — "the seam was renamed or restructured, this guard is now blind"
— rather than passing over a window that no longer existed. That is the whole
reason the anchor is a separate check from the rule it protects.

## Open, pre-existing

`acceptPreviewForecast` and `acceptAllChallengerModels` store raw
`calculateBaseForecast` output, whose provenance stays `fitted`, and nothing at
either site prevents an All-bearing key. Their safety rests on the `derivedMix`
UI gate in `ForecastVsActualsTab` — untouched by this branch — which falls back
to `baseForecast.provenance` when the seam returns null, as a legacy
single-forecast import produces. Traced, not reproduced live. Recorded OPEN; the
fix belongs to the accept path, not the retirement rule.

## Gate

- **ui-consistency** — lint and build clean. Three findings, none actionable: the
  new modal row's `items-start` is correct for a wrapping informational row; the
  new `setError` is the only translated one in that function, making it the
  conforming site rather than the outlier; both new keys are English in all six
  locales, which is a pre-existing codebase-wide condition (220 of 681 keys,
  32.3%, identical across every non-EN locale).
- **qa-tester** — confound resolved (the 541-vs-32,395 gap is two populations
  summed in metadata, not truncation); direction and no-further measured on the
  real artefact; the import bypass found, then on re-run the false table entry
  found. Also proved the All-exclusion in `buildRestoredLeafIndex` is
  load-bearing: enrolling the retired fit as its own leaf doubles the derived
  inflow to 743,531.05.
- **regression-guard** — 16 items assessed, 1 N/A (zero-diff scope, stated as
  such). **SAFE FOR USER TESTING.** No figure from any earlier walk moves;
  `spec:derive` and `spec:leafgrain` re-run and matched their recorded pins.
- `spec:retire` 25/25, `spec:import-seam` 28/28, `guard-traps` 15/15 (13, 14, 15
  all caught), `traps` 3/3, all 16 other specs green, typecheck 0, build clean,
  i18n clean, scoped no-AI confirmed, `.env` untracked.

Two notes on the gate itself. Stage 3 disclosed that it had mutated the working
tree mid-run (a worktree experiment that removed `node_modules/.bin`, and an
interrupted trap cycle that left a file mutated) and restored both; the tree was
independently verified identical to `f987cbe` before the merge, and every spec
re-run on it. Stage 3 also declined to re-derive the UAT percentages
independently, citing reconstruction cost — those figures were measured directly
against the real artefact using the production functions before the gate ran, so
they are not resting on the spec's own pass.

## State

**MERGED** as `4fb6b15`. Branch `session-g-retire-aggregates` at `f987cbe`.

Session H next, per the approved design: generate-the-missing-leaves replaces the
Step 1 decline, plus button states and the 0-All-bearing-writes mirror control.
