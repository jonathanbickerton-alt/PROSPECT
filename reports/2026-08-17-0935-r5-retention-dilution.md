# R5 — retention dilution on the Pricing card

## FOR ADVISOR

```
Generated: 2026-08-17 09:35 +0100 (UTC 2026-08-17 08:35)
Certifies: b3795f3 (body written PRE-commit; only these 2 lines added after)
Repo: committed 5bc50d0 (docs) + b3795f3 (R5), pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before the base check.
BASE: HEAD d168a06 vs the brief's c841e43 — one commit, REPORT-ONLY (--stat).
HOUSEKEEPING 1 DONE LATE — v3.3.1 was ABSENT at the base check and ARRIVED
  mid-session at Doc/; moved to docs/ and committed FIRST as 5bc50d0. See §1.
HOUSEKEEPING 2 DONE — the stale "INERT AT THIS COMMIT" comment is reworded, and
  now also records that R3's two-field shape is an ANALOGY to R2, not a copy
  (the CONTRADICTED claim from the 2026-08-14 verification, fixed at source).
SHIPPED: a Dilution mode on the Pricing card. Two stated figures, the ratio
  shown LIVE as signed "% retained revenue", saved as an ordinary retention-
  scoped percentage PricingEvent. THE APPLY LOOP IS UNTOUCHED, and the spec
  asserts it has no dilution branch — R5 rides the mechanism.
THE MODE AND BOTH FIGURES PERSIST, restored on reopen — yieldArpuMode's lesson
  applied BEFORE it bites, and trap 70 is the trap that diagnosis never had.
SEAM EXTRACTED: pricingEventExportRow AND pricingEventFromRow — the spec drives
  both. Pricing has exactly ONE import route; the count is PINNED anyway, which
  is the point of pinning it. spec:yield-roundtrip is still a copy (unchanged).
ARITHMETIC PINNED AS LITERALS: 25→20 = +6.6667% (NOT +5, the subtraction error
  this mode exists to remove); 20→25 = −6.25%; identity = 0, a no-op.
DECISIONS 1–3 recorded in EXPECTED.md this session (the doc had not reached it).
pricing-roundtrip 46/46 (new), guard-traps 69/69, mix-card 99/99, event 69/69,
  yield 35/35, lint and build clean, i18n parity verified across six locales.
NEXT: R4's summary table — pricingEventSummary is written as its source.
```

---

## Base check

`git rev-parse --short HEAD` → **`d168a06`**; the brief names `c841e43`. One
commit apart, `--stat` confirms it touches only
`reports/2026-08-14-1234-…` — the predecessor's own Repo-line fill, now the
established pattern. Flagged, proceeded.

## Housekeeping

### 1. v3.3.1 — DONE, but not when the brief expected

**At the base check the file did not exist.** No `docs/` directory, and no
`v3-3-1` match anywhere under the home directory — the same search that found
v3.2 two sessions ago. I flagged it and continued per the brief.

**It arrived mid-session**, timestamped 09:37, in a new untracked `Doc/`
directory that appeared while the R5 build was underway. I noticed it at
staging, because `git status` showed an untracked path that had not been there
at the base check — which is the practical argument for the standing rule about
keeping the tree clean.

**Moved to `docs/` and committed first, as `5bc50d0`.** The path is not my
choice: the brief names `docs/`, and the document's own header says *"From this
version the document is ALSO committed to the repo (`docs/`)"*. Two independent
sources, so `Doc/` was a slip rather than an instruction.

**Scanned for credentials before committing** — this repo has a real key in its
history — and the file is clean. Its headings are the working agreement's own
(§1 What PROSPECT is … §7 Backlog), 146 lines.

**The ordering the brief asked for is preserved:** it is the session's first
commit, even though the file arrived after most of the R5 build was written.
Nothing else was committed before it.

### 2. The stale comment — DONE, and widened slightly

`forecasting.ts` no longer claims `promoBandArpuOverride` is inert. It now
records what the field actually does, **and** carries the correction the
2026-08-14 verification produced: R3's two-field shape is an **analogy** to R2,
not a copy of it — R2's override sits beside a per-tier *effective map*, R3's
sits beside a *scalar* blend. The reason for two fields transfers; the
description of what they sit beside does not.

That second half is one sentence beyond the brief's "reword to describe the
shipped capability". It is included because the comment is exactly where the
next reader would form the wrong belief, and the verification report that found
it is not something they will have open.

## What shipped

### 1. The mode

A **Direct / Dilution** selector above the amount row. Direct is everything the
card did before, untouched. Dilution replaces the single amount input with
**two stated figures** — current and target dilution — and the live translation
beneath them.

Choosing Dilution also sets `inputMode: 'percentage'` and
`cohortScope: 'retention'` **on the visible form**, not silently at save, so the
form never shows one thing and writes another.

**Both figures are user-stated, with no prefill.** Not a simplification: the
2026-08-14 true-state established there is nothing to derive them from —
`Avg_Unit_Price_GBP` exists in four of seven fixtures and is read by *nothing*.
A prefill would have to invent a basis.

**Validity is one rule in one place.** `dilutionAmountPct` returns `null` for
anything outside `[0, 100)` on either figure, and the card's save guard is
exactly "is it null". 100 is excluded from *both* rather than only the
denominator, so there is a single rule to state rather than two.

### 2. The translation, live and visible

```
ratio = (1 − target/100) / (1 − current/100)
```

rendered as a signed **"+X.XX% retained revenue"**, green above zero and rose
below, updating as either figure is typed.

**This is the whole capability.** Moving dilution 25% → 20% is **not** +5%
revenue; it is 0.80/0.75 = **+6.6667%**. The subtraction error is the reason the
mode exists, so the spec pins that number as a hand-written literal *and*
asserts the answer is not 5.

A target **above** current is a legitimate worsening scenario and renders as a
reduction. No clamp, no `abs` — the rate-sign rule.

### 3. The event — riding the mechanism, not extending it

A dilution event is an ordinary **percentage `PricingEvent`** with
`cohortScope: 'retention'` and `amount = (ratio − 1) × 100`.

**`applyDelta` and the pricing pass are untouched.** The spec asserts the apply
loop contains no `pe.pricingMode` branch at all — so the check fails if a future
change starts teaching the engine about this mode, which is the brief's *"if you
are editing the apply loop, the wiring is wrong"* turned into something that
runs.

### 4. Persistence, and the lesson it is borrowed from

`pricingMode`, `dilutionCurrentPct` and `dilutionTargetPct` are stored, exported
as `Pricing_Mode` / `Dilution_Current_Pct` / `Dilution_Target_Pct` with the `''`
absence carrier, and restored on reopen.

**Storing the mode is the `yieldArpuMode` lesson applied before it bites.** That
field is not stored and not restored, so a Value-card event made in Forecast
mode reopens showing different derived figures — Finding 1 of the 2026-08-13
diagnosis, still open. Here the same omission would be worse: a dilution event
reopened without its mode is a plain percentage event displaying **+6.67%, a
number the user never typed**, while the 25 and 20 they *did* type sit on the
event unshown.

**A plain event carries none of the three.** Every pre-R5 pricing event reads
back with the mode absent and needs no migration — asserted, not assumed. A
**stated zero** round-trips as `0` and not as absence.

### 5. The seams — both extracted

The Pricing_Events row shape was inline in `App.tsx`, the same position
`marketEventExportRow` was in before R3. Both directions are now extracted:

- `pricingEventExportRow` — App does `.map(pricingEventExportRow)`;
- `pricingEventFromRow` — App does `.map(pricingEventFromRow)`.

The spec drives **both**, so it fails when the real export or the real import is
wrong rather than certifying a copy. `spec:yield-roundtrip` is untouched and its
`toRow` is still a copy — that finding stands, deliberately not fixed in a
session that would not re-gate it.

**Pricing has exactly ONE import route.** The count is pinned anyway. One route
is not a reason to skip the pin — it is the reason to place it, so a second
route arriving later has to come through this check first, which is precisely
what the market-event routes nearly failed to do.

### 6. The row summary

`pricingEventSummary` — a small exported function, not inline JSX. A dilution
row reads **"25% → 20% dilution"**, not "+6.7%".

Written as an export because **R4's summary table needs this exact string for
this kind**. A summariser living inside one card's markup is one the summary
table cannot reach, and two descriptions of one event are how they start
disagreeing. It falls back to the plain rendering if a figure is missing rather
than printing a half-formed claim.

### 7. Honest copy, six locales

Eight new keys. Two carry the honesty requirements:

- **volume**: *"Retention volume is assumed unchanged — this moves retained
  revenue only."*
- **compounding**: *"Combines multiplicatively with any other pricing event in
  scope."*

**A parity note, since it looks like a defect and is not.** The French
`Direct` and `Dilution` are byte-identical to English. They are true cognates —
those are the French words — so they are left as they are. Flagged because an
automated "untranslated string" sweep will keep reporting them, and the next
person to see it should not "fix" them into something wrong.

**The adjacent-copy check the brief asked for:** the Volume card's flat-doctrine
tooltip (*"Percentage events never compound with each other"*) is accurate for
market events and is **not** edited. The pricing note is scoped to *pricing
events in scope*, so the two statements do not contradict — but a user
generalising the Volume card's wording across the tab would previously have been
wrong with nothing to correct them. The pricing card now states its own rule.

### 8. Guard-traps 70 and 71

- **70** drops the mode restore on reopen — the yieldArpuMode shape, trapped
  this time rather than diagnosed afterwards.
- **71** drops one `(1 − …)` term from the ratio. The mode still exists, still
  round-trips, still renders; only the number is wrong. Catchable **only**
  because the spec pins the expected values as literals instead of recomputing
  them with the function under test.

Both anchors verified unique before planting, per session 1's ambiguous-anchor
lesson.

## Gate

```
pricing-roundtrip spec:  46 passed, 0 failed   (new)
mix-card spec (mounted): 99/99 passed          (untouched — no regression)
event-roundtrip spec:    69 passed, 0 failed
yield-roundtrip spec:    35 passed, 0 failed
guard-traps:             69/69 caught          (70 and 71 caught first run)
lint (tsc --noEmit):     clean
build:                   clean, 10.69s
i18n:                    8 keys x 6 locales, all present, non-empty,
                         {{value}} interpolation intact in all six
```

## Where things stand

**R5 is complete as scoped.** The mode exists, translates visibly, persists with
both stated figures, restores on reopen, describes itself honestly in the list,
and rides the existing apply path without the engine learning it exists.

**Nothing was shed.** The pre-authorised intermediate stability point (items 1–3
before reopen wiring) was not needed.

**What is mounted vs source-read:** the round-trip, the arithmetic, the seams
and the wiring are **machine-checked** by `spec:pricing-roundtrip`. The **card's
rendering is not mounted** — the pricing card has no mounted harness, and
joining it to `mix-card-spec` was not cheap (that harness opens the Promotion
card and drives the mix arm; the pricing form is a different region with its own
month/volume prerequisites). So the mode selector rendering, the live effect
line and the row summary in situ are **source-read plus function-level**, and
the wiring checks pin that the card calls the shared functions rather than
reimplementing them. Stated rather than implied, per the standing rule.

**Still open, unchanged by this session:** `spec:yield-roundtrip`'s `toRow` is
still a copy, and `yieldArpuMode` is still not restored on reopen — the trap
planted here (70) is that defect's shape caught on a different card, which makes
the yield one more conspicuous rather than less.

## Limits of this check

No mounted coverage of the pricing card (above). The compounding behaviour is
**documented and asserted in copy**, not exercised by a numeric multi-event
test — two dilution events in one month compounding to the product rather than
the sum is the decided behaviour and is not separately measured here. The
`originalBaseArpu` snapshot is unchanged and still recomputes on edit.
