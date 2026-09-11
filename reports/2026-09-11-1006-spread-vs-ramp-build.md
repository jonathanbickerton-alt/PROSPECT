# REQ-D6-05 Spread vs Ramp — the build

## FOR ADVISOR

```
Generated: 2026-09-11 12:35 +0100 (UTC 2026-09-11 11:35)
Certifies: 9036d33   (REQ-D6-05 build — Volume, Promotion, churn)
Repo: committed 9036d33, pushed (origin in sync)
BASE 17b52d5; status --short EMPTY; diff shows EXPECTED.md only.
1 CLAUSES 7-14 RECORDED, EXPECTED.md alone (04f2785), before any src.
2 VOLUME: switch retired; Spread|Ramp, duration 1-24, Custom values,
  typed ramp, Hold only in Ramp, % locked to Ramp, Mode column LAST.
3 spreadShape IS A UNION — spread+hold is a type error. Spread is the
  Hold-OFF expression unchanged: six literals pinned, promo 53/53.
4 PROMOTION: same model; the ungated per-cent share-split is retired.
5 CHURN: order rule in churnBlockReason + label; every churn row
  exports Mode Ramp, guaranteed at the WRITER, not only where built.
6 FOUND: promo-hold-mounted SILENTLY SKIPPED cases 2-4 on the new card
  ("3 passed, 1 failed"). Re-ordered to fill-in order: 53/53.
7 FOUND+FIXED: ramp reason fired on a single-ROW edit; Save Campaign
  swallowed a broken ramp. Both cards.
8 TRAPS 225-233 RED by hand; 110/203/222/210/217/219/221 re-aimed RED.
  222 would have CRASHED and 217 stayed green: both got discriminators.
9 DECISION: checkbox pin is FOUR, not three — churn's ramp box stays.
10 DECISION: a % Volume label reads "Change to X", no "reached at n".
SHED: nothing. Items 1, 2 and 3 all built and gated.
RE-AIMED SPECS: 12 entries, one line each in section 6.
guard-traps 229/229 caught; full suite 71/71 green.
```

## 0. Base

BASE is `17b52d5`, the last gated hash. HEAD at session start carried only docs
on top of it: `f664299` (EXPECTED.md), `14d9442` (design note), `86db101`
(inventory report).

```
$ git status --short
(empty)

$ git diff 17b52d5 HEAD --stat -- src scripts test-data
 test-data/EXPECTED.md | 41 +++++++++++++++++++++++++++++++++++++++++
 1 file changed, 41 insertions(+)
```

Exactly as the brief expects: `EXPECTED.md` and nothing else. The skeleton
`ea85668` was the session's **first repo action**, written before this check —
the order the report-writing skill and CLAUDE.md both require, and the order
the previous session slipped on.

## 1. Item 0 — clauses 7–14 recorded

Appended verbatim under "REQ-D6-05 — SPREAD vs RAMP (Jon, 2026-09-11)" in
`test-data/EXPECTED.md`, committed **alone** at `04f2785` (39 insertions, one
file), before any `src/` change.

## 2. Item 1 — the Volume card

### The generator is a union

`spreadShape` takes `SpreadShapeSpread | SpreadShapeRamp`:

- **Spread** `{ mode, months, distKind: 'even' | 'pct' | 'values', dist }` —
  `fraction = dist[i] / total`, the REQ-D6-03 Hold-OFF expression unchanged.
  Custom values uses the same expression: a value over the sum of the values IS
  its share, so `total × v / total` returns `v`.
- **Ramp** `{ mode, months, values, hold, horizonMonths }` — `fraction =
  values[i] / target`, the last ramp month a literal 1, then the held tail.

**"Spread + hold" is a type error**, as brief 1.1 asks: a Spread input has no
`hold` field for tsc to accept. The output `{ offset, fraction, held }` is
unchanged, so every caller's `amount × fraction` arithmetic is untouched.

**`cumulativeShares` is the bridge** for the one caller still stating a ramp as
shares — the Promotion card, until Item 2. Its last cumulative sum is computed by
the same additions in the same order as `total` was, so `values[i] /
values[last]` equals the old `cum / total` **bit for bit**. `spec:promo-hold-
mounted` stayed 52/52 through the change, and `spec:hold-shape` §2 now pins the
bridge with its original literals.

### The card

One `volumeShapeInput` → `volumeShape` memo now feeds Add, the campaign save,
the preview and the button's count — **four inline derivations became one**.
`volumeMode` is Ramp for any `%` draft (clause 9, derived, so no path can leave a
percentage in Spread); `volumeHold` is false outside Ramp (clause 2);
`volumeIsSingle` is duration 1 and not held (clause 10).

- `volume-spread-toggle` **retired**; the panel is always open.
- `volume-mode-spread` / `volume-mode-ramp`; Spread is `disabled` **and**
  `aria-disabled` for a `%` draft, and its click is refused as well.
- `volume-duration`, min 1, max 24; duration 1 is the single-event route.
- Spread distributions: Even / Custom % / **Custom values** (`volume-dist-values`),
  with `volume-spread-value-{i}`; the total box (`volume-amount`) is read-only and
  shows the sum while Custom values is on.
- Ramp: typed `volume-ramp-value-{i}`, Even prefill (`evenRampValues`, last month
  exactly the target), re-prefilled on target or duration change.
- Hold rendered **only in Ramp**; switching to Spread clears it.
- Rows always render **by month index**, not from the shape — an all-zero Custom
  values draft has an empty shape and must still be typeable.
- Clause 11's block: `rampBlockReason`, rendered as text
  (`volume-ramp-block-reason`), read by the button and both handlers' guards.
- Clause 12's labels keyed in six locales (14 new keys); the `%` label
  `Change to {scenario}` keyed, and its i18n-scan allowlist entry **retired**.

### Persistence

`Mode` appended **last** on Market_Events, after `Hold`, always written. **One
reader, `modeFromRow`**, holds the only statement of the absent rule (absent →
Ramp if Hold is Yes, else Spread). The writer's `eventMode` hands the event to
`modeFromRow` in the row's own vocabulary rather than restating the rule, so
there is no second copy to drift.

### Restore (brief 1.4) — the rule implemented

**Mode comes from the column**, via `eventMode(first)`. **Ramp** reopens with the
target = the last ramp month and the typed values = the rows up to the plateau
(held) or all rows (unheld). **Spread** reopens with the SUM, and the
distribution is the first that **re-spreads to exactly the stored rows**: Even,
else Custom % (integer shares), else Custom values with the rows as the values.
The test is reproduction, not resemblance — the old "within 1 of the mean" test
called 1,001 / 1,000 / 1,000 Even, and a re-save rewrote it as 1,000 × 3.

### Seen RED before each re-aim

```
spec:event-toggle — the Market last-column pin, after the writer gained Mode:
  FAIL  export: Enabled is third-from-last on Market_Events (REQ-D6-03)  [Tariff_Scope]
  FAIL  export: Tariff_Scope is second-to-last on Market_Events (REQ-D6-03)  [Hold]
  FAIL  export: Hold is LAST on Market_Events (REQ-D6-03)  [Mode]

spec:hold-shape — after the Volume switch was retired:
  FAIL  COLUMN: Hold is the LAST column  [Mode]
  FAIL  CLAUSE 10: EXACTLY six RampHoldCheckbox uses in WhatIfTab  [5]
  FAIL  CLAUSE 10: testid volume-spread-toggle appears exactly once in WhatIfTab  [0]
```

### `spec:spread-ramp-volume` — new

Built on `churn-hold-mounted`'s **two-leaf store** harness, copied rather than
re-invented, because `hold-mounted`'s host has a no-op `addMarketEvent` — clause
10's "duration 1 is today's single event" could not be asserted there at all.
Cases (a)–(h) in fill-in order with every expected row a hand-written literal,
plus discriminator sub-cases (a0) single event, (a2) Hold not surviving into
Spread, (e-order) / (e-last) / (e-ok), and typing into the derived total in (b).
**79 passed, 0 failed.**

### Three places the brief and the recorded decisions pull apart — resolved and stated

1. **The checkbox pin: 6 → 3 in the brief, 5 as built.** Clause 10 retires the
   on-off switch on Volume and Promotion only; nothing retires churn's ramp
   checkbox. The pin states what is built and is re-aimed when the Promotion
   switch goes — `four after Item 2 retired the Promotion switch`.
2. **The `%` label.** Clause 12 keys `Change to {scenario}` and gives mode-
   following wording only for *volume*. A `%` draft therefore reads "Change to
   Inflow" with no ", reached at month n" suffix. A question for the walk.
3. **"Each month at or below the next" for a negative target.** A −10% ramp runs
   −3.33 / −6.67 / −10 — falling numerically, rising in magnitude. Read literally
   it would be blocked, so the order is read **in the target's direction**; stated
   at `rampOrderViolation` as the reading taken, not as the clause.

## 3. Item 2 — the Promotion card

**Not shed.** Item 1 did not spend the budget.

The Volume card's model on the third carrier, with `promo-` testids: a derived
`promoMode` (Ramp for any percentage — clause 9), `promoHoldOn` (false outside
Ramp), `promoShape` built from the mode, and `promoRampBlockReason` from the same
`rampOrderViolation`. `buildPromoEvents` still takes a `shape`, and gains an
optional `mode` it writes on each row — **omitted for a row edit**, whose patch
must leave the stored mode alone. `promo-spread-toggle` and its "Ramp volume over
multiple months" label are **retired**; the ungated per-cent share-split is gone
with them. The restore is the Volume card's rule. The grid keeps its emerald `+n`
form because `promo-hold-mounted` (C) reads the preview by that class.

**The percentage label is this card's own.** A Promotion percentage keeps
`whatif_promo_volume_pct_label` ("Volume change (% of the forecast)"), because it
names the forecast the share is of; absolute amounts take clause 12's Spread and
Ramp labels, replacing Acquisition / Retained Volume. No spec pinned those keys.

### Found while building it

1. **A silent skip, not a failure.** `promo-hold-mounted` case 1 looked the Hold
   box up on a fresh Subs draft before choosing `%`. Hold now renders only in
   Ramp, so the case hit `report(); return;` and **cases 2–4 never ran** — the
   red-first run read "3 passed, 1 failed", which looks like a small regression
   and was the whole file not executing. Re-ordered to fill-in order; 53/53.
2. **The ramp reason fired on a row edit.** A single-row edit sets the duration
   to 1 and leaves the typed ramp values stale, so a `%` row opened for editing
   would have shown "each month must be at or below the next" and disabled Save
   Changes. Both cards' reason memos now return null while a ROW edit is open.
3. **Save Campaign silently refused a broken ramp.** The handler guarded, the
   button did not — the class trap 110 names. Both cards' Save buttons now read
   the reason during a CAMPAIGN edit only; a row save is one month.
4. **The script refused twice, correctly.** Once on a five-line anchor built
   from a comment-filtered read (a comment sits inside `resetPromoDraft`), once on
   a `disabled` expression that appears on both Add and Save — where the 24-space
   Save line contains the 22-space Add line as a substring. Each wrote nothing;
   re-anchored on single lines and on the line above each button.

### Seen RED before each re-aim

```
spec:hold-shape            FAIL  CLAUSE 10: EXACTLY five RampHoldCheckbox uses in WhatIfTab  [4]
                           FAIL  CLAUSE 10: testid promo-spread-toggle appears exactly once in WhatIfTab  [0]
spec:promo-hold-mounted    3 passed, 1 failed — FAIL (1) the hold toggle is on the Promotion card
spec:d5-05-held            CRASHED — TypeError: Cannot read properties of null (reading 'click')
```

### `spec:spread-ramp-promo` — new, 58/58

Cases (a)–(h) on the two-leaf harness in fill-in order, hand-written literals.
Its percentage case asserts the card's own per-cent label is kept.

### Traps

```
231  the Promotion card builds a Spread as a ramp   spread-ramp-promo 50/5
     FAIL  (a) 1,000 / 1,000 / 1,000 — literal  [1000,2000,3000]
232  a Promotion percentage allowed into Spread     spread-ramp-promo 56/2
     FAIL  (f) CLAUSE 9: Ramp is the mode
```

Both planted by hand against `c20fa55a…`, restored from the scratchpad backup,
md5 verified.

## 4. Item 3 — churn

**Not shed.** Churn is already the Ramp model — typed cumulative points, Even
prefill — so Item 3 added only three things.

1. **Clause 11, in `churnBlockReason`.** When ramping, `rampOrderViolation` over
   the stated points against the target. It sits in the ONE reason the button,
   the rendered `churn-add-block-reason` line and the handler guard already read,
   so a broken ramp is refused — and says so — at all three from one line. A
   single-month statement has no order to break and is not checked.
2. **Clause 12's label** on the target: "Target reduction — reached at month n",
   with ", then held" when Hold is on (`churn-amount-label`; one new key, six
   locales, 907 keys each).
3. **`Mode` written as `Ramp` on every churn row** — in memory at all three churn
   row writers (Add, campaign save, and a single-spaced row-edit writer found
   only by grepping the backup), **and guaranteed at the writer**: a churn row
   always exports `Ramp`.

### Why the writer guarantee, and not just the three writers

An **unheld churn campaign loaded from a save written before the Mode column
existed** has no Mode cell, so the one reader resolves it to **Spread** by the
absent rule — correctly, because Hold alone cannot say it was churn. Stamping
`mode: 'ramp'` where churn rows are *built* would never reach that row, and it
would re-export as Spread: the one thing a churn statement never is. The reader
stays the single statement of the absent rule; the writer states the churn fact.

### Specs

`churn-hold-mounted` gained four cases: **(i3-block)** 0.5 / 2 / 1 refused with
the reason as text and a click emitting nothing; **(i3-ok)** 0.5 / 1 / 2 adding
three rows, each `mode: 'ramp'` and exporting `Mode: Ramp` with `Hold: No`;
**(i3-writer)** a churn row carrying `mode: 'spread'` still exporting `Ramp`;
**(i3-label)** / **(i3-label-held)** the label with and without ", then held".
The file went **42 → 58, all green** with the new cases, tsc 0.

Nothing else went red: `mix-card` 237/237, `amount-control` 91/91, `churn-fold`
56/56 on the churn build — no existing churn drive types a ramp that breaks the
new rule (`mix-card`'s 6.67 / 13.33 / 20 ends on its target of 20).

### Trap 233

```
233  the churn ramp non-decreasing block is removed   churn-hold-mounted 55/3
  FAIL  (i3-block) CLAUSE 11: the reason is rendered as TEXT  [no reason rendered]
  FAIL  (i3-block) and Add is disabled
  FAIL  (i3-block) and a click emits nothing  [3]

Planted by hand against a73133fb7687bbace4613c224ee0a752, restored from the
scratchpad backup, md5 verified. All three halves fire from one line, because
the rule lives in the one reason the button, the text and the guard all read.
```

## 5. Traps

Every trap below was **planted by hand** against a pre-plant md5, run against
its spec, **restored from a scratchpad backup**, and the md5 verified equal —
never `git checkout`. Two needed a discriminator before they could count; both
are said so here.

### New — 225 to 233

| trap | claim | spec | red |
|---|---|---|---|
| **225** | the reader treats an absent Mode as Ramp regardless of Hold | spread-ramp-volume | 76/3 — `(h) THE ONE READER: {} → spread` |
| **226** | Spread mode emits the ramp shape | spread-ramp-volume | 75/4 — `(a) … literal [1000,2000,3000]`; hold-shape 54/7 |
| **227** | Hold is honoured in Spread mode (two sites) | spread-ramp-volume | 78/1 — `(a2) and none of them carries Hold [3 held]` |
| **228** | the non-decreasing block is removed | spread-ramp-volume | 78/1 — `(e-order) … blocked on ORDER alone` |
| **229** | a percentage draft is allowed into Spread | spread-ramp-volume | 77/2 — `(f) CLAUSE 9: Ramp is the mode` |
| **230** | the Custom values total is editable / not the sum | spread-ramp-volume | 75/4 — `(b) typing 9,999 … [9999]` |
| **231** | the Promotion card builds a Spread as a ramp | spread-ramp-promo | 50/5 — `(a) … literal [1000,2000,3000]` |
| **232** | a Promotion percentage is allowed into Spread | spread-ramp-promo | 56/2 — `(f) CLAUSE 9: Ramp is the mode` |
| **233** | the churn ramp non-decreasing block is removed | churn-hold-mounted | 55/3 — `(i3-block) … reason … [no reason rendered]` |

**227 and 228 each rest on a sub-case built for them.** 227's defect needs two
sites — the derivation that confines Hold to Ramp and the Spread click that
clears it — so it plants both, and only `(a2)` (Hold set in Ramp, then Spread
chosen) can see it. 228 is caught only by `(e-order)`: the brief's own
1,000 / 3,000 / 2,000 is still refused by the last-month half of the rule.

### Re-aimed — anchors aged out, same claims

| trap | why the anchor aged | red |
|---|---|---|
| **110** | the Add button's `disabled` gained a second line | mix-card 236/237 — `the Add button EXISTS and is DISABLED [disabled=false]` |
| **203** | the Hold-ON arm became the Ramp arm | hold-shape 52/9 |
| **222** | the Volume Hold box moved into the always-open panel | hold-shape 59/2 — `five [4]`, `volume-hold-toggle … exactly once [2]` |
| **210** | `buildPromoEvents` writes the mode between Hold and Amount_Type | promo-hold-mounted 49/4 |
| **217** | the Add read-set now names the derived values | promo-hold-mounted **42/11** — `24 rows emitted [1]` |
| **219** | the grid reads `promoShape[i]` directly | promo-hold-mounted 52/1 — `PREVIEW GRID … [+1,000 +1,000 +1,000]` |
| **221** | the tail line sits four spaces shallower | promo-hold-mounted 51/2 |

**222 earned a discriminator.** Its first re-aim planted the inline copy beside
the Hold box, which was valid when the box had siblings. At its new site the box
is the *sole* child of `{volumeMode === 'ramp' && ( … )}`, so two adjacent
elements were a **syntax error**: hold-shape died at import with no report line,
which guard-traps scores CRASHED, never CAUGHT. The plant now wraps both in a
fragment — valid JSX, named only by the two pins.

**217 earned one before it ran.** The obvious re-aim — drop `promoHoldOn` from
the read-set — would have **planted green**: `promoShape` is still listed and
recomputes on every Hold click, so the callback is rebuilt and the closure is
fresh. The stale closure the trap names needs both entries gone, and 42/11 shows
it is live.

`spec:trap-anchors`: **243/243**, 229 traps, 238 anchors, next free id 234.

## 6. Specs re-aimed — one line each

Every re-aim below was **seen RED on the build before its edit**, and the red
line is quoted at the check in the spec file itself.

- **`event-toggle`** — Market_Events last-column pin 3 → **4** trailing positions (Enabled / Tariff_Scope / Hold / Mode).
- **`hold-shape` column pin** — "Hold is last" → Hold second-to-last, **Mode last**.
- **`hold-shape` §1** — the six Hold-OFF literals are now the **Spread-mode** pin (call shape only; every literal unchanged).
- **`hold-shape` §2** — Hold-ON calls re-stated as Ramp through `cumulativeShares`; the literals now also pin the bridge bit-for-bit.
- **`hold-shape` clause-10 count** — six → five (Volume switch) → **four** (Promotion switch); both retired testids pinned at **zero**.
- **`view-apply-mounted`** — nine `spreadShape` calls re-stated as `mode: 'spread'` (signature only; rows unchanged).
- **`hold-mounted`** — cases (a)–(d) re-driven in fill-in order; the retired switch replaced by the mode control; a `type` helper added (the harness had none).
- **`d5-05-held` case (1)** — the Volume held +10% campaign re-driven in fill-in order; the duration lookup moved off `min '2'`.
- **`d5-05-held` case (2)** — its unheld +10% campaign was built through the ungated share-split clause 9 retires; now an unheld percentage **Ramp**, still declined.
- **`d5-05-held` cases (3)–(4)** — the retired Promotion switch dropped from both drives.
- **`promo-hold-mounted`** — case 1 re-ordered (it **silently skipped** cases 2–4 on the new card); the radio-group block re-aimed to "the always-open panel survives Hold"; case 2 → Spread; case 3 gains a Mode round-trip check; case 4 in fill-in order.
- **`churn-hold-mounted`** — not re-aimed; **extended** with the Item 3 cases (42 → 58).

**Traps re-aimed** (anchors aged out, same claims): **110**, **203**, **222**
(Volume), **210**, **217**, **219**, **221** (Promotion). **222** and **217** each
needed a discriminator, not just a new anchor: 222's first re-aim was a syntax
error at the new site (would score CRASHED), and 217's obvious re-aim — drop one
read-set entry — would have planted green because `promoShape` is still listed
and rebuilds the callback on every Hold click.

## Gate

Run **serially**, as one chain writing to files, so nothing read a source file
while guard-traps was mutating it. Captures: `scratchpad/gate-d605.out`, with
the suite in `gate-suite.out` and guard-traps in `gate-guardtraps.out`.

| check | figure |
|---|---|
| `npm run suite` | **71/71 green** |
| guard-traps (to a file, per-trap lines) | **229/229 caught**, 0 missed / inconclusive / crashed; unfiltered, no FATAL |
| `spec:trap-anchors` | **243/243** — 229 traps, 238 anchors; next free id 234 |
| `spec:i18n-parity` | **200/200** |
| keys per locale | **907** in each of de / en / es / fr / it / pt |
| `spec:i18n-scan` | **PASS** — the `Change to {}` allowlist entry **retired**, not kept |
| `spec:survival` | **27/27** — 104 first-row dereferences across 26 files |
| `tsc --noEmit` | **clean**, exit 0, 0 errors |
| `npm run lint` | **clean**, exit 0 |
| `npm run build` | **built in 5.85s**; the >2000 kB chunk notice is pre-existing |

**guard-traps left the tree clean:** `WhatIfTab.tsx` md5 `a73133fb…` before and after the run.

### Exact counts the brief named

| pin | required | measured | instrument |
|---|---|---|---|
| `runIngest` sites | 3 | **3** (ingest 53/53) | `ingest-spec.tsx:254`, green |
| apply sites | 12 | **12** (event-toggle 156/156) | `event-toggle-spec.tsx:110`, green |
| display markers | 6 | **6** (same file) | `event-toggle-spec.tsx:399`, green |
| `type="checkbox"` ramp/hold controls | 6 → 3 | **4** — see below | `hold-shape` clause-10 pin, green; direct: 4 uses — "churn-ramp-toggle", "churn-hold-toggle", "volume-hold-toggle", "promo-hold-toggle" |
| last-column pins, Market / Yield / Pricing | 4 / 2 / 3 trailing | **4 / 2 / 3** | `event-toggle-spec.tsx` block from `:502`, green |
| `computeAdjustedForecast` sites | 6 | **6** (pricing-roundtrip 150/150) | `pricing-roundtrip-spec.ts:457` and `yield-roundtrip-spec.ts:365`, green; direct: 6 occurrences of `computeAdjustedForecast(` in WhatIfTab |

**The checkbox pin is 4, not the brief's 3, and that is stated rather than
matched.** Clause 10 retires the on-off switch on the Volume and Promotion cards
— both done — and nothing in clauses 7–14 or Item 3 retires churn's *ramp*
checkbox. What remains: the three Hold boxes (`volume-hold-toggle`,
`promo-hold-toggle`, `churn-hold-toggle`) and `churn-ramp-toggle`. Reaching 3
would mean retiring churn's ramp checkbox in favour of a mode control on that
card too — a decision, not a count, so it is in the advisor block.

**Market is 4 trailing positions now** (Enabled / Tariff_Scope / Hold / Mode),
Yield still 2 (Enabled / Tariff_Scope — Mode is Market_Events alone), Pricing
still 3 (Enabled / Tariff_Scope / Contract_Length_Months).

## What was shed

**Nothing.** Items 1 (Volume — never shed), 2 (Promotion) and 3 (churn) were all
built, proved by hand-planted traps, and gated together. The brief allowed Items
2 and 3 to be shed if Item 1 spent the budget; it did not, so neither was
deferred, and nothing is half-applied.

**Added beyond the brief's letter, each forced rather than chosen:**

- **The row-edit gate** on both cards' ramp reason — without it a single-row edit
  of a `%` row would have shown the ordering reason and disabled Save Changes.
- **Save Campaign reads the ramp reason** on both cards — the handler already
  refused a broken ramp, and a live button that swallows a click is the class
  trap 110 exists for.
- **The churn writer guarantee** — an unheld churn row from an old save would
  otherwise have re-exported as Spread.
- **`cumulativeShares`** — the bridge that kept the Promotion card byte-identical
  while the Volume card changed the generator underneath it.
- **Discriminators for traps 222 and 217**, and a typing helper added to
  `hold-mounted`'s harness, which had none.

**Not done, and named:** no browser walk — clause 14 hands that to Jon before
Alessandro sees it; and the two decisions in the advisor block are open.

## Limits

- **The checkbox pin reads four, not the brief's three.** Clause 10 retires the
  on-off switch on Volume and Promotion; nothing retires churn's ramp checkbox.
  The pin states what is built. A question for Jon, not a defect.
- **A `%` Volume draft's label has no "reached at month n".** Clause 12 keys
  `Change to {scenario}` and gives mode wording for *volume* only; read literally.
  The Promotion card keeps its own per-cent label for the same reason.
- **"At or below the next" is read in the target's direction** so a −10% ramp is
  not blocked. Stated at `rampOrderViolation`; the clause does not speak to sign.
- **An unheld ramp from before the Mode column cannot exist, so it cannot be
  restored as one.** The absent rule reads every unheld old row as Spread. That is
  right for every save that can exist, and `spread-ramp-volume` (h) pins it.
- **A one-month Ramp without Hold persists as Spread.** It takes the single-event
  route, which writes no mode, and one row cannot say which it was. It reopens
  through single-row edit either way.
- **Negative percentage campaigns reopen as positive.** Both restores take
  `Math.abs` of the rows — pre-existing (the REQ-D6-03 held restore did the same),
  not introduced here, and not fixed here.
- **Nothing was driven in a browser.** Every drive is JSDOM; Jon's walk is the
  check this build is built for (clause 14).
- **Two stale historical comments** still name `spreadEnabled` /
  `promoSpreadEnabled` in past-tense explanations (`WhatIfTab` add handler and a
  Promotion note). Left, because they document why the code is as it is.
