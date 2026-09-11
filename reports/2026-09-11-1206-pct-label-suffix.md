# REQ-D6-05 decision 2 — percentage labels carry the Ramp suffix

## FOR ADVISOR

```
Generated: 2026-09-11 14:22 +0100 (UTC 2026-09-11 13:22)
Certifies: fb412a0   (REQ-D6-05 clause 15 — % labels carry the Ramp suffix)
Repo: committed fb412a0, pushed (origin in sync)
BASE 9036d33; status --short EMPTY; diff to HEAD EMPTY. Both quoted.
1 CLAUSES 15-16 RECORDED, EXPECTED.md alone (9d4546f), before any code.
2 % LABELS CARRY THE RAMP SUFFIX on Volume and Promotion: "reached at
  month n", ", then held" with Hold on, "— one month" at duration 1.
3 NO SECOND SENTENCE: the suffix sits INSIDE each keyed string, as the
  absolute Ramp label's already did; ", then held" is the shared key.
4 SIX LOCALES, suffix agreeing with each stem (fr/it/pt feminine, es
  masculine); de/it the session's own. 909 keys per locale.
5 (f) ON BOTH CARDS SEEN RED, exactly that assertion, before re-aim to
  literals. New (f2) cases, fill-in order: volume 84/84, promo 64/64.
6 TRAP 234 RED by hand: the % branch forced to the month-less form.
7 CHECKBOX PIN IS FOUR — now Jon's decision (clause 16), not a finding.
8 DECISION: an ABSOLUTE Ramp at duration 1 still reads "reached at
  month 1"; % now reads "one month". Align it too?
9 FIRST GATE WAS 228/230: traps 229/232 CRASHED. My own (f2) Hold click
  threw on null under their mutation. Guarded, re-planted RED, gate re-run.
SHED: nothing. Items 0 and 1 done.
guard-traps 230/230 caught; full suite 71/71 green.
```

## 0. Base

BASE is `9036d33`, the 1006 report's `Repo:` and `Certifies:` hash. HEAD at
session start carried only the filled 1006 report (`951530c`) on top of it.

```
$ git status --short
(empty)

$ git diff 9036d33 HEAD --stat -- src scripts test-data
(empty)
```

Both empty, as the brief requires. The skeleton `d981166` was the session's
**first repo action**, committed before this check was run.

## 1. Item 0 — clauses 15 and 16 recorded

Appended verbatim under "REQ-D6-05 — SPREAD vs RAMP (Jon, 2026-09-11)" in
`test-data/EXPECTED.md`, committed **alone** at `9d4546f` (7 insertions, one
file), before any code.

**Clause 16 settles the pin the 1006 report raised.** That report stated the
ramp/hold checkbox count as four rather than the brief's three and put it to
Jon; clause 16 records four as the decision — three Hold boxes and churn's ramp
checkbox, which stays because churn has no Spread.

## 2. Item 1 — the percentage labels

**Never shed, and built.** A percentage is always a Ramp (clause 9), so its label
now says when the target is reached, exactly as the absolute Ramp label does.

**The suffix lives inside the keyed sentence, not in code.** The absolute Ramp
label was already one keyed string — `"Target volume — reached at month {{p0}}"` —
with `", then held"` appended from one shared key. The two percentage stems now
take the same form, so there is **no second sentence construction**:

| key | en, as shipped |
|---|---|
| `whatif_amount_label_pct` | `Change to {{p0}} — reached at month {{p1}}` |
| `whatif_amount_label_pct_one` (new) | `Change to {{p0}} — one month` |
| `whatif_promo_volume_pct_label` | `Volume change (% of the forecast) — reached at month {{p0}}` |
| `whatif_promo_volume_pct_label_one` (new) | `Volume change (% of the forecast) — one month` |

`, then held` is the existing `whatif_amount_label_then_held`, appended when Hold
is on — the same key the absolute label uses. Each card's `%` branch picks the
`_one` form at duration 1, the month form otherwise.

**Six locales; each suffix agrees with its own stem.** The French, Italian and
Portuguese stems are feminine — "Variation … atteinte", "Variazione … raggiunta",
"Alteração / Variação … atingida" — and Spanish masculine, "Cambio … alcanzado";
German "Änderung … erreicht" does not inflect. de and it are the session's own
wording. No value equals English, so i18n-parity's exact-count allowlist is
untouched. 907 → **909** keys per locale.

### Seen RED before each re-aim

Each card's existing `(f)` assertion compared the rendered label with the bare
`%` key. Run against the new labels, before either spec was touched:

```
spread-ramp-volume spec: 78 passed, 1 failed
  FAIL  (f) CLAUSE 12: the percentage label is the KEYED "Change to" string  [Change to Inflow — one month]
spread-ramp-promo spec: 57 passed, 1 failed
  FAIL  (f) the percentage keeps this card's own per-cent label  [Volume change (% of the forecast) — one month]
```

Both reds were **exactly** that one assertion — the chain was guarded to stop if
anything else had gone red. Re-aimed to HAND-WRITTEN literals ("… — one month",
since `(f)` never types a duration), not the key read back, so a wrong key fails.

### Mounted — fill-in order, literals

New `(f2)` cases on each card: the `%` unit, then 10 → duration 3 → the label;
Hold LAST → the label again; a fresh draft at duration 1 → the label.

| card | duration 3 | Hold on | duration 1 |
|---|---|---|---|
| Volume | `Change to Inflow — reached at month 3` | `…, then held` | `Change to Inflow — one month` |
| Promotion | `Volume change (% of the forecast) — reached at month 3` | `…, then held` | `Volume change (% of the forecast) — one month` |

After the re-aim and the new cases: `spread-ramp-volume` **84/84** (79 → 84), `spread-ramp-promo` **64/64** (58 → 64).

## 3. Trap 234

```
234  the Volume % label falls back to the month-less form
spread-ramp-volume spec: 81 passed, 2 failed
  FAIL  (f2) CLAUSE 15: % 10 over 3 reads "Change to Inflow — reached at month 3"  [Change to Inflow — one month]
  FAIL  (f2) CLAUSE 15: Hold on adds ", then held"  [Change to Inflow — one month, then held]

pre-plant md5 4010937e7c466b655b4938b5b9a271b7, restored 4010937e7c466b655b4938b5b9a271b7
```

**The mutation is one line**: the Volume `%` branch's `? (spreadMonths <= 1`
becomes `? (true`, so a three-month ramp is labelled with the month-less form.
Planted by hand, restored from the scratchpad backup, md5 verified. It targets
`spread-ramp-volume`, already in the guard-traps CONTROL list.

## 3a. The first gate: traps 229 and 232 CRASHED — found by this session, fixed

**The first full gate was not green.** Everything else passed, suite 71/71
included, but guard-traps read **228/230**: two pre-existing traps, caught at
229/229 in the 1006 gate, came back CRASHED — not MISSED.

**Cause — this session's own `(f2)` cases.** Traps 229 and 232 let a `%` draft
into Spread mode. In Spread the Hold box is not rendered, so the new line
`await click(byTestId('…-hold-toggle'))` threw on `null`. The spec's `check`
only collects failures and prints them at the end, so the throw killed it
**before** the `(f) CLAUSE 9: Ramp is the mode` FAIL it had already recorded
could print. The mutation was still asserted; the report line was lost.

**The fix is in the specs, not the traps.** Each Hold click is now guarded: a
`check` that the Hold box is on the `%` draft, then the click only if it is.
The red was seen first — both traps planted by hand, each spec crashed, restored
from the scratchpad backup with md5 matching — and again after the guard:

```
first gate — guard-traps 228/230 caught
  [CRASHED     ] 229 a percentage draft is allowed into Spread mode
  [CRASHED     ] 232 a Promotion percentage draft is allowed into Spread mode

trap 229 planted, BEFORE the guard:
  spread-ramp-volume spec: CRASHED — TypeError: Cannot read properties of null (reading 'click')   (pre-fix line 534, the Hold click)
trap 229 planted, AFTER the guard:
  spread-ramp-volume spec: 80 passed, 4 failed
    FAIL  (f) CLAUSE 9: Ramp is the mode
    FAIL  (f) a click on Spread changes nothing — still Ramp
    FAIL  (f2) the Hold box is on the % draft (it is always a Ramp)
    FAIL  (f2) CLAUSE 15: Hold on adds ", then held"  [Change to Inflow — reached at month 3]

trap 232 planted, BEFORE the guard:
  spread-ramp-promo spec: CRASHED — TypeError: Cannot read properties of null (reading 'click')   (pre-fix line 435, the Hold click)
trap 232 planted, AFTER the guard:
  spread-ramp-promo spec: 60 passed, 4 failed
    FAIL  (f) CLAUSE 9: Ramp is the mode
    FAIL  (f) a click on Spread changes nothing
    FAIL  (f2) the Hold box is on the % draft (it is always a Ramp)
    FAIL  (f2) CLAUSE 15: Hold on adds ", then held"  [Volume change (% of the forecast) — reached at month 3]

pre-plant md5 4010937e7c466b655b4938b5b9a271b7, restored 4010937e7c466b655b4938b5b9a271b7 after each plant
```

The whole gate was then **re-run from the top** on the fixed tree; the figures
below are that second run.

## Gate

Run **serially** as one chain writing to files, **twice** — see §3a. Figures are
the second run; captures in the scratchpad: `gate-pct2.out`, the suite in
`gate-pct2-suite.out`, guard-traps in `gate-pct2-gt.out` (the first run is kept
as `gate-pct*.out`).

| check | figure |
|---|---|
| `npm run suite` | **71/71 green** |
| guard-traps (to a file, per-trap lines) | **230/230 caught**, 0 missed / inconclusive / crashed; unfiltered, no FATAL |
| `spec:trap-anchors` | **244/244** — 230 traps, 239 anchors; next free id 235 |
| `spec:i18n-parity` | **200/200** |
| keys per locale | **909** in each of de / en / es / fr / it / pt |
| `spec:i18n-scan` | **PASS** |
| `spec:survival` | **27/27** — 104 first-row dereferences across 26 files |
| `tsc --noEmit` | **clean**, exit 0, 0 errors |
| `npm run lint` | **clean**, exit 0 |
| `npm run build` | **built in 5.18s**; the >2000 kB chunk notice is pre-existing |

**guard-traps left the tree clean:** `WhatIfTab.tsx` md5 `4010937e…` before and after the run.

### Exact counts the brief named

| pin | required | measured | instrument |
|---|---|---|---|
| `runIngest` sites | 3 | **3** (ingest 53/53) | `ingest-spec.tsx:254`, green |
| apply sites | 12 | **12** (event-toggle 156/156) | `event-toggle-spec.tsx:110`, green |
| display markers | 6 | **6** | `event-toggle-spec.tsx:399`, same file |
| ramp/hold checkboxes | 4 | **4** (hold-shape 61/61; direct count 4) | `hold-shape` clause-10 pin, green; clause 16 |
| last-column, Market / Yield / Pricing | 4 / 2 / 3 trailing | **4 / 2 / 3** | `event-toggle-spec.tsx` block from `:502`, green |
| `computeAdjustedForecast` sites | 6 | **6** (pricing-roundtrip 150/150; direct count 6) | `pricing-roundtrip-spec.ts:457`, green |

## What was shed

**Nothing.** Item 0 (recorded, committed alone) and Item 1 (never shed — both
cards' percentage labels, six locales, mounted cases, trap 234) are done.

## Limits

- **An absolute Ramp at duration 1 still reads "Target volume — reached at month
  1"**, not "— one month". Clause 15 speaks to *percentage* drafts only, so the
  absolute label was not changed; the two now differ at duration 1. A question
  for Jon, not a defect.
- **Hold on at duration 1** reads "… — one month, then held" on both cards: the
  `_one` form with the shared suffix. Clause 15 names the duration-1 wording
  without Hold, and the mounted duration-1 case asserts it without Hold.
- **Nothing was run in a browser.** Every label is asserted in JSDOM, in English;
  the five other locales are checked by i18n-parity for presence and parity, not
  rendered.
