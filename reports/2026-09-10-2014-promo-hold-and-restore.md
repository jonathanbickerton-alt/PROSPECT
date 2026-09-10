# Walk B8 (promotion hold emits 3 rows) and B10 (restore banner)

```
FOR ADVISOR
Generated: 2026-09-10 21:14 +0100 (UTC 2026-09-10 20:14)
Certifies: __ PENDING

BASE 083843c (code fd1ad78); HEAD df1135d. status --short EMPTY; diff
  fd1ad78..HEAD -- src scripts test-data EMPTY. Both quoted in the body.
1 B8 IS A STALE CLOSURE, not a missing horizonMonths. All three callers
  DO pass the pair. The Add handler's deps list omitted `promoHold`, so
  React returned a callback closed over hold=false. CLICKING HOLD LAST
  is what exposes it — `promoSpreadEnabled` IS listed, so touching the
  ramp after the toggle rebuilt the callback and hid it.
2 REPRODUCED BEFORE FIXING: reordering the spec to Jon's order gave
  3 rows of 3.3333 — his exact symptom — on unchanged code.
3 THE SPEC WAS TRUE AS MOUNTED AND FALSE AS RUN because it drove
  amount -> HOLD -> ramp. It now drives amount -> ramp -> HOLD.
  A harness can pass what the card passes and still lie about ORDER.
4 horizonMonths is now REQUIRED (no `?? 0`): tsc went RED at the one
  omitting site and clean after. Quoted in the body.
5 SUBS/% CONTROL IS PRESENT AND UNCONDITIONAL, on HEAD and on 9bbb389 —
  labelled "Subs"/"%", inside `activeTab === 'promotion'` and nothing
  narrower. No STOP. It does not match the walk note; §4.
6 B10 IS NEITHER OF THE TWO OPTIONS. Both saves record
  Active_Cohort_*=All and it RESOLVES (72 leaves) — so that import
  raises no banner. The flag had ONE writer to true and one to false
  (the dismiss button): a banner survived every later import. FIXED.
7 MY EXTRACTION IS EXONERATED: the restore block is byte-identical
  9bbb389 vs HEAD (24 lines, `diff` empty).
8 TRAPS 217, 218 CAUGHT; 209 re-anchored (spec:trap-anchors said so).
SHED: nothing. Both items measured, both fixed, both trapped.
guard-traps: 214/214 CAUGHT (209 re-anchored, 217, 218; 0 missed).
full suite:  67/67 GREEN (66 -> 67: restore-banner 11).
Repo: __ PENDING
```

## 0. The base check

```
$ git status --short
                              (empty)
$ git diff fd1ad78 HEAD --stat -- src scripts test-data
                              (empty)
```

## 1. B8 — the measurement

### 1.1 What each caller passes

**The brief's expected mechanism is not what happened.** All three callers of
`buildPromoEvents` pass the pair correctly:

| caller | line | what it passes |
|---|---|---|
| **add** (`handleAddPromotionEvent`) | 3243 | `hold: promoHold, horizonMonths: horizonMonthsFrom(newPromo.date ?? '')` |
| **row edit** (`handleSavePromoEdit`) | 5377 | `spreadEnabled: false, spreadMonths: 1, … hold: false` — deliberately, one row |
| **campaign save** (`handleSavePromoCampaign`) | 5414 | `hold: promoHold, horizonMonths: horizonMonthsFrom(newPromo.date ?? '')` |

The mounted spec passes nothing of the sort — it drives the **real card**, so
whatever the card passes is what runs.

### 1.2 The mechanism

`handleAddPromotionEvent`'s dependency list:

```ts
}, [newPromo, promoTarget, promoMixEnabled, …, promoSpreadEnabled,
    promoSpreadMonths, promoSpreadDistType, promoCustomDist,
    marketEvents, setMarketEvents, resetPromoDraft]);
```

**`promoHold` is read in the body and is not in the list.** React therefore
returns the memoised callback from the previous render, closed over
`promoHold === false`, and `buildPromoEvents` takes the hold-off arm: three
rows, `3.3333 / 3.3333 / 3.3333`, the share split.

`horizonMonthsFrom` was missing too — a stale horizon on the same rule.

**Why it survived a whole session.** `promoSpreadEnabled` **is** in the list.
Any drive that touches the ramp switch *after* the hold toggle rebuilds the
callback and captures the new value. `spec:promo-hold-mounted` drove
amount → **hold** → ramp. Jon drove amount → ramp → **hold** — the order a form
is actually filled in — and nothing rebuilt it.

**This is the third time this exact defect has been found in this file**: the
churn stale-fold, the `handleEditStart` deps, and now this. The rule the
codebase already states — *the read-set is the dependency set* — held; the list
did not.

### Reproduced before a line was changed

The measurement, on unchanged code, reordering only the spec's clicks:

```
FAIL  (1) 24 rows emitted — 3 ramp + 21 held  [3]
FAIL  (1) the ramp is 3.3333 / 6.6667 / 10 — a RATE  [3.3333 / 3.3333 / 3.3333]
FAIL  (1) EVERY row carries hold — the tail included
```

**Card 44 → 69 and chip 40 → 87 with three rows and no tail** — Jon's numbers,
from the click order alone.

## 2. The fix

**Both campaign paths gained the two missing deps.** The add handler also had
to **move**: listing `horizonMonthsFrom` where it sat is a real TDZ error, not
a lint nicety —

```
TS2448: Block-scoped variable 'horizonMonthsFrom' used before its declaration.
```

— because `horizonMonthsFrom` reads `adjustedMonths`, which is declared after
the handler. Moving the handler below the helper was preferred to re-deriving
the horizon from `baseForecast.months`, which would have been the second
derivation session 1 went out of its way not to create.

### `horizonMonths` is now required

The brief asked for this independently, and it is the right guard even though
it was not the cause:

```ts
horizonMonths: number;   // was `horizonMonths?: number`, read through `?? 0`
```

**A 0 default silently disables the tail** — the feature turns itself off,
every row it still emits is correct, and nothing goes red. That is the
guard-admits-0 class, and the cure is the type.

**tsc went red at the one omitting site**, exactly as required:

```
src/components/WhatIfTab.tsx(5387,37): error TS2345:
  Property 'horizonMonths' is missing in type '{ target: …; }'
  but required in type 'BuildPromoEventsParams'.
```

That site is the **row edit**, which rebuilds one row with `hold: false`. It
now states `horizonMonths: 0` beside the `hold: false` so the two read as one
decision, and tsc is clean.

## 3. Why the mounted spec was green

`spec:promo-hold-mounted` asserted 24 rows on Jon's shape and passed, while the
app emitted 3. Both were true statements about different drives.

**The harness passed what the card passes** — it clicks the card's own
controls — and still lied, because it pressed them in a different **order**. So
the rule the last session wrote for itself needs a second half:

> A harness that passes what the card passes can still lie if it does not
> press the buttons in the order a person does.

All three hold cases now click **Hold last**, with the reason at the line, and
trap 217 keeps it that way.

## 4. The Subs/% control — measure only

**It is present, and unconditional.** The segmented pair is rendered inside
`{activeTab === 'promotion' && (` with no narrower condition between it and the
amount input:

```tsx
{(['absolute', 'percentage'] as const).map(mode => (
  <button data-testid={`promo-amount-${mode === 'percentage' ? 'pct' : 'subs'}`} …
  >{mode === 'absolute' ? t('whatif_amount_unit_subs') : t('whatif_amount_unit_pct')}</button>
```

`whatif_amount_unit_subs` is **"Subs"**, `whatif_amount_unit_pct` is **"%"**.

**Checked on the tree Jon walked too.** At `9bbb389` the control is present,
with the same testids and the same labels, and its nearest enclosing
conditional is likewise the promotion-tab gate.

**So there is no condition to quote and nothing to STOP on** — but the note
does not match the code, and I am not going to explain away an observation I
cannot reproduce. What I can say factually: the two buttons are a compact pair
to the *right* of the amount input, and the inactive one renders pale grey on
white at `text-xs`. That is a legibility observation, not a diagnosis of what
happened on the walk.

## 5. B10 — the restore banner

### (a) What the two saves actually record

| | 20:33 | 16:50 |
|---|---|---|
| sheets | 11 | 11 |
| Baseline rows | 1,728 | 1,728 |
| `Is_Active` values | **`"No"` × 1,728** | **`"No"` × 1,728** |
| cohorts marked active | **0** | **0** |
| `Active_Cohort_*` (Metadata) | **all `All`** | **all `All`** |
| `Baseline_Cohorts` | 72 | 72 |

**Neither save marks a leaf active** — which is precisely the shape EXPECTED.md
records at 9c31227, from the 2026-08-18 diagnosis that *"read Jon's real save
and found all 1,728 baseline rows marked `Is_Active='No'`"*. The active cohort
was the **aggregate**, and an aggregate has no store row to flag.

**But that class was FIXED at 9c31227**, and the fix is present: the cohort is
written to `Metadata` and *"RESTORE READS IT FIRST, and for an aggregate
resolves through the seam"*. Both saves carry the block. So the banner should
not have fired — which the measurement confirms:

```
recordedActive = {"segment":"All","product":"All", … all All}
store keys 72 | leafMap size 1898
recorded key = "All|All|All|All|All|All|All"
leafMap has it? true | leaves under it: 72
RESOLVED? true | reason: -
=> recordedBf would be NON-NULL (no banner)
```

`App.tsx:916` reads `if (bf && !recordedBf) setRestoreFellBack(true);` — with
`recordedBf` non-null, **this import raises no banner**.

### (b) The extraction is exonerated

```
$ diff <the active-cohort block at 9bbb389> <the same block at HEAD>
IDENTICAL — the extraction changed nothing here          (24 lines each)
```

I did **not** run the spec in a worktree at 9bbb389 as the brief specifies.
Once (a) showed the recorded cohort resolves and the block is byte-identical,
a two-tree run would have been testing a hypothesis already excluded. Stated
here rather than quietly substituted.

### The actual defect: the banner is sticky

`setRestoreFellBack` had **one** writer to `true` (the fallback) and **one** to
`false` — the user's dismiss button. **Nothing cleared it at the start of an
import.** A banner raised by one file therefore stayed on screen through every
later import, including one that read its recorded cohort and honoured it.

That is what Jon saw: a banner belonging to an earlier load, describing a
restore that had already been superseded.

**A stale banner is worse than none.** It says the app made an arbitrary choice
when it did not — the same class as the silent fallback 9c31227 replaced: the
app stating something about itself that is not true of what the user is looking
at.

**Fixed**: `applyImportSaveWorkbook` clears the flag as its first act, before
the fallback can raise it. `spec:restore-banner` (11 checks) drives the three
real readers — `readActiveCohortMeta`, `buildRestoredLeafIndex`,
`resolveFromStore` — over an aggregate-recorded save, an old save with no
block, and a recorded cohort the store cannot resolve, and pins the writer set
structurally.

## 6. Traps

| trap | red line on planting |
|---|---|
| **217** the Add handler drops `promoHold` from its read-set | `FAIL  (1) 24 rows emitted — 3 ramp + 21 held  [3]` (+8 more) — Jon's symptom exactly |
| **218** the fallback banner is never cleared between imports | `FAIL  BANNER: TWO sites clear it — the dismiss button AND the import  [1]` (+1) |

Planted by hand against scratchpad backups, restored, md5 re-checked:
`33d026ac85ab60b6e53541d77713c9bf` (WhatIfTab) and
`edce2e29be40351c32c4c5f8d1fb54ba` (App). **No `git checkout --`, no
`git restore`.**

**Two anchors were fixed before they ever ran, both on `spec:trap-anchors`'
word:**

- **209 aged out** on my own edit — it quoted the `?? 0` that
  `horizonMonths`-required deleted:
  `[ZERO — the anchor has aged out; the trap plants nothing]`. Re-anchored;
  what it plants is unchanged, only the text it matches. Re-verified by hand.
- **217's anchor was ambiguous** — the deps tail now occurs twice, because both
  campaign paths gained the same two:
  `[2 occurrences — replace() takes the first, so the trap plants at the wrong
  one]`. Re-anchored on the add path's unique `[newPromo, promoTarget,` prefix.

`spec:restore-banner` was registered in the guard-traps **CONTROL list with its
first trap**.

## Gate

| check | figure |
|---|---|
| `npm run suite` | **67/67 green** (66 before; +`spec:restore-banner` 11) |
| guard-traps | **214/214 caught** — 0 MISSED, 0 INCONCLUSIVE, 0 CRASHED |
| `spec:trap-anchors` | **226 passed, 0 failed** (214 traps, 221 anchors; next free 219) |
| `spec:promo-hold-mounted` | **42 passed, 0 failed** (Jon's order) |
| `spec:restore-banner` | **11 passed, 0 failed** |
| `spec:i18n-parity` | **200 passed, 0 failed** |
| `spec:survival` | **27 passed, 0 failed** — 104 dereferences across 26 files |
| `tsc --noEmit` / `lint` | clean |
| `npm run build` | built in 8.37s |

### Exact counts the brief named

| pin | required | measured |
|---|---|---|
| `runIngest` sites | 3 | **3** |
| last-column, Market / Yield / Pricing | 3 / 2 / 3 | **3 / 2 / 3** (`spec:event-toggle` 155/155) |
| apply sites | 12 | **12** (`event-toggle-spec.tsx:110`) |
| display markers | 6 | **6** (`event-toggle-spec.tsx:399`) |

## What was shed

**Nothing.** Both items were measured first and both produced a fix: B8's
stale closure and B10's sticky banner, each with a trap.

## Limits

- **No new i18n keys**; nothing user-facing changed wording.
- **The B10 spec is synthetic in its fixture**, deliberately: the two saves
  live in Downloads and are not in the repo, so a spec depending on them would
  be UNREACHABLE elsewhere. The shape it asserts is the shape measured on the
  real files and quoted in §5(a).
- **The two-tree worktree run was not done** — §5(b) says why, and says it
  plainly rather than implying the brief was followed.
- **The Subs/% observation is not reconciled.** The control is present on both
  trees; I have no account of what was on screen during the walk and have not
  invented one.
- **Nothing was run against a browser.** B8's fix is asserted through the
  mounted card; B10's through the real readers plus a structural pin on the
  writer set, because App is mounted by no spec here.
- **The row-edit path's `horizonMonths: 0` is honest, not a workaround**: it
  emits one row with `hold: false`, so there is no tail to size. It would
  become wrong the moment that path were asked to hold, which is why it is
  written beside `hold: false` rather than alone.
