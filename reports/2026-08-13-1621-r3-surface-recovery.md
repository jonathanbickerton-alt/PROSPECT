# R3 surface — recovery of the session that did not close

## FOR ADVISOR

```
Generated: 2026-08-13 16:21 +0100 (UTC 2026-08-13 15:21)
Verified against: c847f29, branch main, tree now CLEAN.
Repo: reverted clean at c847f29; this report committed ce91be9, pushed
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
BRANCH: work present but UNGATED and HALF-APPLIED → REVERTED CLEAN. No commits,
  no stash, no stranded guard-trap mutations. HEAD never moved past c847f29.
THE INPUT WAS NEVER BUILT. setDraftPromoBandArpu had 3 writers — reset and the
  two edit-restores — and NO input. `bandOverridden` was declared and never used.
LINT WAS CLEAN ON THE HALF-APPLIED TREE — the dead local did not fail the
  build, so "it compiles" would not have caught it. Hence revert, not commit.
FINDING A — the reissued brief's NAMED SOURCE IS WRONG. Per-band baseArpu is
  sum(revenue)÷sum(volume) over the filtered cohort history, NOT a trailing
  3-month average; that is promoCohortAvgArpu, the mix-OFF fallback. R2's
  existing tooltip already names the real basis correctly.
FINDING B — buildPromoEvents hand-rolls its own tierArpu from DERIVED figures,
  so a stated rate would show on the card and not reach the saved event: the
  two-baselines shape trap 65 exists for, on a third surface.
FINDING C, DECISION NEEDED — SCOPE ITEM 4 MAY NOT BE SATISFIABLE AS BRIEFED.
  computeTierData never emits a non-finite rate, so every band WITH a row has
  one; the null blend comes only from a restored mix naming a band that has NO
  row. An input on the band row cannot lift that refusal. See §4.
FINDING D — mix-card-spec.tsx ALREADY mounts the real promo card (42/42). The
  mounted spec is an EXTENSION of it, not the new harness the brief implies.
FINDING E — stale band keys survive an axis switch and would be persisted.
VERDICT: the reissued surface brief starts from THIS commit, not 81ceadb.
```

---

## 1. State established

| Check | Result |
|---|---|
| `git rev-parse --short HEAD` | **`c847f29`** |
| Delta from the carrier close (`81ceadb`) | **one commit**, `c847f29` — report-only |
| Commits from the dead session | **none** |
| `git stash list` | **empty** |
| Dirty files at session start | **one**: `src/components/WhatIfTab.tsx` |
| Untracked | the `1552` skeleton, and this report |
| origin | in sync |

The one commit past `81ceadb` is *"Fill the Certifies and Repo lines on the R3
carrier report"* — the carrier session's own close, not the dead session's work.
**HEAD never moved during the failed session.**

## 2. Classification of the dirty tree

`git diff src/components/WhatIfTab.tsx` — 104 insertions, 21 deletions, in eight
hunks. Every hunk is **authored surface work**: new exported function, new draft
state, three call-site wirings, two restore handlers, one dead local. All carry
written rationale comments.

**No guard-trap mutations.** Two independent reasons, both from the diff rather
than from filenames:

1. Guard-trap mutations are mechanical single-line removals with no comments —
   the shape of trap 66 is *delete the `readStoredRateMap` line*. Nothing in the
   diff has that shape; every deletion is paired with a replacement that reads as
   authored prose.
2. The mutation targets live in `src/utils/forecasting.ts` and `src/App.tsx`,
   and **both files were untouched**.

**The session never reached the gate.** No spec file was modified
(`mix-card-spec.tsx` untouched), `guard-traps.ts` untouched, no test artefacts.
The session died during the build, not during the gate.

### What existed, so the reissue knows the shape

- `promoEffectiveArpuMap(tierData, override)` — exported module-level, the
  override-if-present rule as one definition;
- `buildPromoEvents` rewired to call it, plus a `statedForMembers` filter
  restricting the persisted map to current members;
- `draftPromoBandArpu` state with the no-`seedMixPreserving` rationale;
- `promoTierArpu` memo reading the shared function;
- `bandArpuOverride` passed at **all three** `buildPromoEvents` call sites, with
  the three dependency arrays updated;
- both edit-restore handlers seeding the draft from `promoBandArpuOverride`;
- `resetPromoDraft` clearing it;
- `const bandOverridden = …` — **declared, never used**.

### Why this was not committable

`setDraftPromoBandArpu` had **three writers: the reset and the two
edit-restores. None of them is an input.** The read-only Base ARPU span was
never replaced, so the capability the session existed to add — a user typing a
per-band rate — **did not exist**. What was on disk was the plumbing behind an
absent control.

**And `npm run lint` was clean on that tree.** The unused local did not fail the
build, so a session that had trusted "it compiles" could have committed a
half-applied change certifying nothing. That is precisely the branch-2 case:
not gate-green, therefore not committable, therefore reverted.

Behaviour was probably *unchanged* rather than broken — `draftPromoBandArpu`
could only be non-empty after restoring an event carrying a map, and no event
can carry one yet — but that equivalence is accidental and was never measured,
which is the same thing as unknown.

## 3. Remediation

`git restore src/components/WhatIfTab.tsx`. Tree clean at `c847f29`.

Re-measured **after** the revert, to prove the restore returned a green tree and
not merely a compiling one:

```
lint (tsc --noEmit):  clean
event-roundtrip spec: 69 passed, 0 failed   (matches the carrier close exactly)
mix-card spec:        42/42 passed
guard-traps:          64/64 caught          (no mutation stranded anywhere)
```

The `1552` skeleton is **kept and committed** with this report. It is the
diagnostic: it records that a session started, wrote its skeleton first as the
rule requires, and died before filling it. An empty `reports/` would have
carried none of that.

## 4. Findings the reissue must consume

### A. The brief's named default source is wrong

R3 decision 1 asks the input to name its default as a *trailing 3-month
average*. **The per-band figure is not that.** `computeTierData` groups the
filtered rows and derives `historicalArpu = sum(revenue) ÷ sum(volume)` over the
**whole filtered cohort history**, then in forecast mode scales it to the month.
There is no 3-month window on this path at all.

The trailing-3-month figure is `promoCohortAvgArpu`, which is the fallback used
when the mix arm is **off**. Naming it on the per-band input would be a false
label in user-visible copy. R2's existing key —
`whatif_tier_arpu_default_from`, *"Derived from this tier's revenue ÷ volume in
the event's cohort"* — already names the real basis, in all six locales, and is
reusable verbatim.

### B. The write path is a second baseline

`buildPromoEvents` builds its own `tierArpu` from `t.baseArpu` alone. Left
as-is, the card would blend from stated rates while the saved event blended from
derived ones — the two-baselines defect trap 65 exists for, on a third surface.
The fix is one shared function called by both, which is what the reverted work
did; it is recorded here because the finding, not the code, is the expensive part.

### C. DECISION NEEDED — the refusal-lift may be unreachable as briefed

Scope item 4 assumed an ARPU-less band with share can be fixed by typing a rate
into its row. **Established by reading, and it does not hold:**

- `computeTierData` returns `vol > 0 ? rev / vol : 0` — always finite. Every band
  that gets a rendered row therefore **already has a rate** and can never be the
  cause of a null blend.
- `blendedArpu` iterates `Object.keys(shares)`, not the member list. The null
  arises when `promoDraftMix` carries share for a key **absent from
  `promoTierData`**.
- `seedMixPreserving` builds its result from the current tiers, so it drops
  foreign keys — but `handleEditPromoStart` assigns `event.promoMix` wholesale,
  and the reseed effect is keyed on the tier-list string, which does not change
  on an edit-restore. So foreign keys survive **there**, which is exactly the
  case `mix-card-spec` already exercises.

**A band with no rendered row has no input to type into.** So the sharpest gap in
the true-state report is not closed by a per-band input alone. Options, for Jon:

1. render a row for share-carrying bands that are **not** in the current tier
   list, marked as orphaned, with the input available — closes the refusal;
2. offer an explicit "drop orphaned bands" action — lifts the refusal without
   inventing a rate;
3. accept that the refusal stands for orphaned bands and narrow decision 3 to
   say so.

**Not chosen here.** This session establishes and reports; the true-state report
declared this the sharpest gap, and narrowing it is Jon's call.

### D. The mounted harness already exists

`scripts/mix-card-spec.tsx` (451 lines) mounts the real `WhatIfTab`, opens the
Promotion card, enables the mix arm, drives padlocks and targets through real
events, and already exercises **edit-restore of a saved promotion** including an
anti-vacuity control. It runs 42/42.

The brief's *"this surface has NEVER had a mounted spec"* is true of the **ARPU
override specifically**, not of the card. The R3 mounted coverage is an
extension of this file — which is cheaper than the brief assumes and, more
importantly, keeps one harness rather than two that can drift.

### E. Stale band keys would be persisted

The draft override map is keyed by band name and outlives a value↔tariff axis
switch, so a rate typed before the switch would be written into a saved event
naming a band that event has no share in. The write must filter to the current
members. Recorded so the reissue does not rediscover it as a defect.

## 5. Verdict

**The reissued surface brief starts from `c847f29`, not `81ceadb`.**

`c847f29` is one report-only commit ahead, contains the whole carrier, and is
the commit this session verified clean and green. Nothing from the failed
session survives in the tree, so there is no partial state for a reissue to
reconcile against — only the findings above, which are why this report exists.

## Limits of this check

The gate run here is a **re-measurement of the reverted tree**, not a
certification of new work — there is no new work. `event-roundtrip` reproducing
69/69 corroborates the carrier report's figure at the same commit. Nothing was
mounted beyond `mix-card-spec`, and Finding C is established by source reading
plus that spec's existing restore case, not by a mounted reproduction of an
orphaned band.
