# The negative ARPU override — the sign is the user's, not the app's

## FOR ADVISOR

```
Generated: 2026-08-12 11:43 +0100 (UTC 2026-08-12 10:43)
Certifies: 03a08fe, branch main, tree CLEAN.
Repo: committed 03a08fe, pushed (origin in sync) — this report is LATE, written
  after that commit; nothing was re-run to produce it.
THE REPORT WAS MISSED, and that is the first finding. 03a08fe changed seven
  files, fixed two defects, re-aimed two traps and passed a full gate with no
  report — and the NEXT commit amended the report-trigger rule to be stricter.
  The rule did not fail; I did. The trigger needing work is the MOMENT, which is
  the commit, not the end of the session.
DECISION (Jon): a negative ARPU override is a deliberate affordance — an
  acquisition credit. ABSOLUTE semantics: a minus means below zero, NOT a
  reduction from the default. Nothing on the path may clamp or re-sign it.
DEFECT 1: the per-view derivation read Math.abs(e.arpuOverride), so a stated
  -4.25 became +4.25 in the FORECAST while eventArpuDelta showed -4.25 in the
  TABLE — two surfaces disagreeing about one number. I wrote that clamp.
DEFECT 2: the Outflow neg()/abs() convention was applied at SEVEN sites. A typed
  -5 reopened as +5. Inflow and Retention were unaffected because neg/abs are
  the identity there — exactly why it would never have been noticed in use.
THE RULE THAT GENERALISES: the sign convention belongs to QUANTITIES. Any rate
  this app stores is written and read verbatim.
TRAPS 60 AND 61 WENT INCONCLUSIVE — this fix rewrote the lines they pinned, so
  both planted nothing. Only the harness distinguishing INCONCLUSIVE from CAUGHT
  surfaced it. A change rewriting a line under a trap re-aims it in that commit.
MEASURED before the commit, quoted not re-run: 59/59 roundtrip, 37/37 override,
  35/35 suite, guard-traps 60/60, lint+build clean, 74/72/2 and MAPEs unmoved.
```

---

## 0. Why this report is late

**It should have been written when `03a08fe` was committed, and was not.** The
rider changed seven files, fixed two defects, re-aimed two guard-traps and
passed a full gate — and produced no report. Then the very next commit,
`11b2006`, *amended the report-trigger rule to be stricter*.

The rule did not fail. I did, and the miss has the same shape as the merge that
prompted the original rule: the task read as a small rider rather than as
something report-shaped. Recorded because a rule breached in the same session it
was strengthened is worth more as evidence than as embarrassment — the trigger
that needs work is not the wording but the moment, and the moment is **the
commit**, not the end of the session.

Written after the fact. The measurements below were taken **before** `03a08fe`
was committed and are quoted from that run; nothing was re-run to produce this
file.

## 1. The decision

**Jon, 2026-08-12.** A negative ARPU override is a **deliberate affordance** —
an acquisition credit is the worked example. The value is **absolute**: a minus
means ARPU below zero, **not** a reduction from the default. Nothing on the path
may clamp, reject or re-sign it.

## 2. Two defects against that label

**Both are classified INTRODUCED BY `6667464`** — the request-1 build of the
previous day, which made the ARPU editable and, in doing so, wrote both the
`Math.abs` and the seven sign transforms. Neither is pre-existing: before
`6667464` there was no `arpuOverride` for a sign convention to be wrong about.

Both were invisible until the sign was asked about, and would have stayed so:
each is a no-op on the paths anyone exercises by default.

### `Math.abs(e.arpuOverride)` in the per-view derivation

A stated −4.25 became **+4.25 in the forecast**, while `eventArpuDelta` showed
−4.25 in the events table, because that function never had the clamp. **The
table and the engine disagreed about one number.**

`Math.abs` there reads as defensive tidying and is a lie about what the user
said. I wrote it.

### The Outflow sign convention, applied at seven sites

`neg()`/`abs()` were applied to the override at five writers and two
edit-restores. That pair exists for **quantities** — volume and revenue are
stored negative and displayed positive. A rate stated absolutely is not a
quantity.

On an Outflow event a typed **−5 stored as −5 and reopened as +5**. Inflow and
Retention were unaffected, because `neg` and `abs` are the identity there —
which is precisely why it would not have been noticed in ordinary use.

### The rule that generalises

**The sign convention belongs to quantities.** Any rate this app stores is
written and read verbatim. The settled rates rule already said a rate is not a
quantity and does not pro-rate across cohorts; it does not take a quantity's
sign either.

## 3. What was verified, not assumed

- **No `Math.max` clamp on the ARPU path.** The only one guards pool *volume*.
- **No `min` attribute on the input**, so the browser does not reject a minus.
  Asserted in the spec rather than eyeballed.
- **Zero sign transforms remain**: `grep` for `neg(`/`abs(`/`Math.abs(` against
  `arpuOverride` returns **0** across `src/`.

## 4. The traps this broke, and the lesson

**Guard-traps 60 and 61 both went INCONCLUSIVE** — *"anchor did not match,
nothing was planted"*. The cause was this very fix: it rewrote the exact lines
they pinned, removing a `Math.abs` and a `neg()` wrapper. Both traps planted
nothing and tested nothing.

**The harness reporting INCONCLUSIVE rather than CAUGHT is the only reason it
surfaced.** A laxer harness would have counted two silent passes, and my
previous message's claim that the sign fix was fully covered would have stood
unchallenged — trap 62 bit, while two neighbours had gone inert in the same edit.

**The lesson is not "write looser anchors".** A loose anchor plants a mutation
somewhere other than intended and reports a catch it did not earn. It is: **a
change that rewrites a line under a trap must re-aim that trap in the same
commit**, and INCONCLUSIVE is the signal that it did not. Recorded at the top of
the trap table in `scripts/guard-traps.ts`.

## 5. Coverage added

- `spec:event-roundtrip` — a negative through a real xlsx round trip, asserted
  distinct from unset **and** from a stated zero. Four separable states now:
  three values and a sign. **59/59** (was 55).
- The fixture builder gained a negative row (`promo-mix-6`, −4.25).
- `spec:override-arpu` — the input accepts a minus and carries no `min`; a
  negative changes the forecast; and it is **not the same forecast as its
  positive twin**, which is the check `Math.abs` would fail. Plus a source guard
  that no sign convention is applied to the field anywhere. **37/37** (was 30).
- **Guard-trap 62** restores the `Math.abs`.

## 6. Measurements

Taken before `03a08fe` was committed; quoted here, not re-run.

```
spec:event-roundtrip       59/59
spec:override-arpu         37/37
full suite                 35/35 npm scripts green
guard-traps                60/60 caught (after 60 and 61 were re-aimed)
lint (tsc --noEmit)        exit 0
build (vite)               succeeded
edge fixture               74 leaves, 72 fit, 2 skipped
PINNED ARPU MAPEs          13.8845 / 13.4315 / 14.3888 / 13.0192
```

§33 with the scope named: **main's working tree and build output are AI-free**.
History and remote branches are out of scope; the preserved `ai-capability`
branch is expected.

## Where things stand

The negative semantic is recorded in EXPECTED.md as a property of ARPU override
fields **generally**, so the Value-card and promotion-card overrides inherit it
rather than each re-deciding. Request 2 is not built; Request 3 is not started.
