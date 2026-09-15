# REQ-D6-06 — campaign-level delete across all cards

## FOR ADVISOR

```
Generated: 2026-09-15 13:35 +0100 (UTC 2026-09-15 12:35)
Certifies: 88e0adb   (REQ-D6-06 campaign-level delete, Items 1 and 2)
Repo: committed 88e0adb, pushed (origin in sync)
BASE 296618c; status --short EMPTY; diff to HEAD EMPTY. Both quoted.
1 DECISIONS 1-5 RECORDED, EXPECTED.md alone (e90ec50), before any src.
2 ONE handleDeleteCampaign: 3 callers (Volume pill, Promotion pill,
  summary panel), pinned exact both ways. It takes the pill group's rows -
  the switch's grouping - so the signature is (name, rows), not (name).
3 ONE DIALOG: EventChangeConfirmModal gains a keyed "campaign" kind; it
  commits the previewed array in one setMarketEvents call. No new dialog.
4 DECISION 3: ramp/held/churn member bins disabled, reason as text; Spread
  members keep theirs. One predicate, extracted from the churn edit bar.
5 MOUNTED 65/65: held 22 deleted, neighbours 3/2 kept; Cancel; promo;
  member bars; Spread row; open editor closed; export clean; summary;
  Compare shows no bin.
6 RED FIRST: survey 70/71 - only trap 107's anchor aged out; re-anchored.
7 TRAPS 237-242 RED by hand; 107 re-anchored, RED. None stayed green.
8 FINDING: the summary panel had no campaign switch to sit beside; the
  bin is on the group's first row beside the row switch.
9 QUESTION: should ramp/held members also be barred from row EDIT? Only
  churn is; delete now bars all three.
10 LIMIT: the Promotion per-row bin still deletes without a confirm.
SHED: nothing. Items 0, 1 and 2 done.
guard-traps 238/238 caught; full suite 72/72 green.
```

## 0. Base

BASE is `296618c`, the 1337 report's `Repo:` and `Certifies:` hash.

```
$ git status --short
(empty)

$ git diff 296618c HEAD --stat -- src scripts test-data
(empty)
```

Both empty, as the brief requires. **One correction to "nothing has run since":**
HEAD carried two docs-only commits after the 1337 report, `bdf2603` ("Agent,
skill and model inventory (read-only, docs-only)") and `78c99d1` (its `Repo:`
line). Neither touches `src`, `scripts` or `test-data`, which is why the diff is
empty. The skeleton `f1b61d7` was this session's **first repo action**, before
the check.

## 1. Item 0 — REQ-D6-06 decisions recorded

A new heading, "REQ-D6-06 — CAMPAIGN-LEVEL DELETE (Alessandro, 2026-09-15;
Jon's decisions 2026-09-15)", with decisions 1–5 verbatim, is in
`test-data/EXPECTED.md`. It was committed **alone** at `e90ec50` (20 insertions,
one file), before any `src` change.

## 2. Item 1 — the one function and the card-table bins

### 1.1 Measure (on `296618c`, before any change)

**Per-row delete handlers on the Market carrier:**

| surface | handler | confirm? |
|---|---|---|
| Volume events table, per row (`WhatIfTab.tsx:8038`) | `setPendingChange({ kind: 'delete', nextEvents: marketEvents.filter(x => x.id !== event.id) })` | yes — `EventChangeConfirmModal` |
| Promotion table, per row (`WhatIfTab.tsx:9975`) | `removeMarketEvent(e.id)` (App `:297`, `setMarketEvents(prev => prev.filter(…))`) | **no** — pre-existing |
| Churn rows | the Volume events table's row, the same handler | yes |

**Where a campaign is identified — one grouping, already shared:**
- `groupByCampaign` (`WhatIfTab.tsx:998`) returns each campaign's `rows`, sorted by
  date, plus `editable` and `reason`.
- `campaignGroups` (`:4806`, non-promotion rows) and `promoCampaignGroups` (`:4813`)
  are built from it. A Volume campaign and a Promotion campaign that share a name
  are **different groups** — the existing rule (`:5665`).
- The pills read those groups, as do the campaign switch (`isCampaignLead =
  group.rows[0]?.id === row.id`) and `handleSetCampaignEnabled(group.rows, next)`
  (`:3130`), which writes each row through `handleSetEventEnabled` (`:3099`).
- **So the one function takes the pill group's rows**, as the switch's handler
  does, rather than filtering `marketEvents` by name again. That keeps a same-named
  campaign on the other card safe, and it is the reuse the brief asks for. The
  signature is therefore `handleDeleteCampaign(campaignName, rows)`, not
  `(campaignName)`; this is said here rather than hidden.

**The dialog.** `EventChangeConfirmModal` exists, and its invariant fits
decision 2 exactly: the caller stages `nextEvents`, the modal previews exactly
that array, and confirming commits it in **one** `setMarketEvents` call
(`confirmPendingChange`, `:5308`). Its three titles are hard-coded English (kept,
and exempt in `scan-i18n.ts:455–466`). **Decision: no second dialog.** It gains a
`campaign` kind whose wording the caller keys, plus testids on the title, Confirm
and Cancel.

**The per-row edit bar's member predicate.** There is exactly one, inline in
`handleEditStart` (`:4685–4692`, trap 107). It covers **churn** rows only: churn
siblings sharing a campaign name, more than one → "This month is one step of a churn
ramp…". Decision 3 bars ramp and held members as well, so the one predicate has to be
**extracted and widened**. The widening uses the writer's own Mode rule
(`marketEventExportRow`, `forecasting.ts:469`: churn, or `eventMode` ramp) rather
than a new definition.

**Declaration order, measured because it shaped the code.** `campaignGroups` is
declared after `handleSetEventEnabled`, and `handleCancelEdit` /
`handleCancelPromoEdit` after `confirmPendingChange`. A callback cannot list a later
`const` in its deps without a temporal-dead-zone error. So the one function takes
the rows from its caller, and `confirmPendingChange` **moves** below both cancel
handlers, so that it can call them.

### 1.2–1.4 Build

**1.2 — ONE `handleDeleteCampaign(campaignName, rows)`**, directly after
`handleSetCampaignEnabled`, beside `handleSetEventEnabled`. It takes the campaign's
rows from the caller's pill group, and stages `{ kind: 'campaign', nextEvents,
campaign: { name, n, isPromotion } }` on the existing `pendingChange`. It commits
nothing itself. `confirmPendingChange` removes every row in **one**
`setMarketEvents(pendingChange.nextEvents)` call. It now sits below both cancel
handlers and closes the editor of the deleted campaign on its own card
(`handleCancelEdit` / `handleCancelPromoEdit`); case (f) asserts this. No
campaign editor and no D5-05 bar is consulted (decision 4).

**The caller pin** (in the new spec): `handleDeleteCampaign(` occurs **exactly 3**
times — the Volume pill bin, the Promotion pill bin and the summary panel's
handler. `kind: 'campaign'` occurs exactly **once**, so a caller that builds its
own campaign change beside the function is red too (trap 239). Each bin's
`onClick` is checked to carry the call with the pill group's rows. **N = 3.**

**1.3 — the bins and the dialog.** `volume-campaign-delete` and
`promo-campaign-delete` sit on each group's first row (`isCampaignLead`), beside
the campaign switch and pill, with `data-campaign` naming the campaign.
`EventChangeConfirmModal` gains a `campaign` kind. Its title, blurb, Confirm and
Cancel are keyed by the caller: `whatif_delete_campaign_title` "Delete
'{{name}}' — all {{n}} events?", plus `_blurb`, `_confirm` and `_cancel`. Title,
Confirm and Cancel carry `event-change-title` / `-confirm` / `-cancel`. The three
older kinds keep their existing strings untouched.

**1.4 — decision 3.** `isCampaignStepMember(event, all)` is exported beside
`groupByCampaign`. A row is a member when it is step-shaped (churn, or `eventMode`
ramp, which covers held) and has more than one step-shaped sibling on its carrier
under the same name. The churn edit bar now calls it inside its unchanged `if
(event.churnMode === 'churn')`. The Volume and Promotion per-row bins call it too:
a member's bin is `disabled` with `aria-disabled`, and `whatif_row_delete_barred`
"Delete the whole campaign with its bin" is rendered as text. **Spread members keep
their bin.** The pin counts **4** occurrences: the definition, the edit bar and the
two row bins.

**Keys:** six in six locales (910 → **916**); de and it are this session's own
wording, and none equals English.

### 1.5 Mounted — `scripts/campaign-delete-mounted-spec.tsx`

The two-leaf harness is copied from `spread-ramp-volume`, with a draft read-back
added. Every campaign is built in fill-in order (mode → amount → duration → values
→ Hold LAST → Add). Every click and type is guarded, so a red reports instead of
crashing, and the spec ends with an explicit exit.

```
campaign-delete spec: 65 passed, 0 failed
mix-card spec: 237/237 passed
trap-anchors spec: 252 passed, 0 failed  (238 traps, 247 anchors)
```

- **(a)** "B2 test", a held ramp from month 3, is 22 rows. Its Volume pill bin opens
  "Delete 'B2 test' — all 22 events?". Confirm leaves **0** rows; neighbours Spread
  **3** and Ramp **2** are asserted before and after (27 → 5).
- **(b)** Cancel: the dialog closes and the counts stay 22 / 3 / 2.
- **(c)** A promotion campaign is deleted from the Promotion pill, 3 → 0, and the
  other promotion keeps 2. Its ramp member's per-row bin is disabled with the reason.
- **(d)** A held member and a ramp member each have a disabled per-row bin, with
  `aria-disabled="true"`, the reason in the DOM, and a click that does nothing.
- **(e)** A Spread member's bin is enabled. It opens the single-event dialog and
  removes that one row (3 → 2).
- **(f)** With the campaign's editor open ("Save campaign", duration 3, the draft
  naming it), deleting closes the editor, clears the draft and returns duration to 1.
- **(g)** After (a), the export has no `Campaign_Name` "B2 test", and the read-back
  is the neighbours' 5.

### 1.6 Traps — each planted by hand, restored from a scratchpad backup, md5 verified

**Red first.** The suite survey on the changed `src`, before any spec was touched:

```
full suite on the changed src, specs untouched: 70/71 green
[FAILED ] spec:trap-anchors
70/71 green
── trap-anchors
trap-anchors spec: 245 passed, 1 failed  (232 traps, 241 anchors)
  FAIL  trap 107 a churn ramp member can be row-edited: anchor 1 still matches WhatIfTab.tsx  [ZERO — the anchor has aged out; the trap plants nothing]
```

Only one red, the predicted one. Trap 107's anchor, `if (siblings.length > 1)`,
aged out when its sibling rule became the one predicate. It was re-anchored to
`if (isCampaignStepMember(event, marketEvents))`, with the same plant, and then
planted red.

```
trap 237   campaign-delete spec: 57 passed, 8 failed
  FAIL  (a) ZERO rows of the campaign remain  [21]
  FAIL  (a) 27 rows became 5  [27 → 26]
  FAIL  (a) its bin is gone
  FAIL  (g) the export has NO rows of the deleted campaign  [21]
  FAIL  (g) and reads back as the neighbours alone — 3 + 2 = 5  [26]
  FAIL  (f) the campaign is gone, the other kept  [2 / 3]
  pre-plant md5 0f73f8e0a2c8575c03bc8b49eb5ccaf8, restored 0f73f8e0a2c8575c03bc8b49eb5ccaf8

trap 238   campaign-delete spec: 53 passed, 12 failed
  FAIL  (b) DECISION 2: the dialog names the campaign and its 22  [no dialog]
  FAIL  (b) nothing is deleted while the dialog is open  [0]
  FAIL  (b) the Cancel is keyed: "Cancel"
  FAIL  (b) Cancel changes nothing — 22 / 3 / 2  [0 / 3 / 2]
  FAIL  (a) the dialog names it  [no dialog]
  FAIL  (a) the confirm is keyed: "Delete campaign"
  pre-plant md5 0f73f8e0a2c8575c03bc8b49eb5ccaf8, restored 0f73f8e0a2c8575c03bc8b49eb5ccaf8

trap 239   campaign-delete spec: 62 passed, 3 failed
  FAIL  PIN: handleDeleteCampaign has EXACTLY 3 callers — Volume pill, Promotion pill, summary panel  [2]
  FAIL  PIN: a campaign change is staged in ONE place — `kind: 'campaign'` occurs once  [2]
  FAIL  PIN: the Promotion bin calls it with the pill group's rows
  pre-plant md5 0f73f8e0a2c8575c03bc8b49eb5ccaf8, restored 0f73f8e0a2c8575c03bc8b49eb5ccaf8

trap 240   campaign-delete spec: 56 passed, 9 failed
  FAIL  1.4 PIN: ONE member predicate — defined once, read by the edit bar and both row bins (4 occurrences)  [3]
  FAIL  (d) DECISION 3: the held member's per-row bin is disabled  [false]
  FAIL  (d) and aria-disabled  [false]
  FAIL  (d) the held member's reason is TEXT in the DOM: "Delete the whole campaign with its bin"  [absent]
  FAIL  (d) a click on the held member's bin opens no dialog and removes nothing  [27]
  FAIL  (d) DECISION 3: the ramp member's per-row bin is disabled  [false]
  pre-plant md5 0f73f8e0a2c8575c03bc8b49eb5ccaf8, restored 0f73f8e0a2c8575c03bc8b49eb5ccaf8

trap 241   campaign-delete spec: 63 passed, 2 failed
  FAIL  (f) 1.2: the editor is CLOSED — no "Save campaign" left pointing at nothing
  FAIL  (f) 1.2: the form is a fresh one again — duration 1  [3]
  pre-plant md5 0f73f8e0a2c8575c03bc8b49eb5ccaf8, restored 0f73f8e0a2c8575c03bc8b49eb5ccaf8

trap 242   campaign-delete spec: 64 passed, 1 failed
  FAIL  (i) DECISION 5: with no handler — Compare's case — the panel renders NO bin  [2]
  pre-plant md5 3e5eab38a199225ce0573a7c057cc230, restored 3e5eab38a199225ce0573a7c057cc230

trap 107   mix-card spec: 230/237 passed
  FAIL  R7 edit (c): a ramp MEMBER declines row-edit  [a cumulative target edited alone desyncs the member from its siblings]
  FAIL  R7 edit (c): and the panel does NOT open for it
  FAIL  R7 edit (c): the refusal is a stated REASON, not a dead click
  FAIL  R7 group (g): a ramp MEMBER still declines row-edit
  FAIL  R7 group (g): and the panel does NOT open for it
  FAIL  R7 group (g): the decline is the shared sentence, verbatim  ["undefined"]
  pre-plant md5 0f73f8e0a2c8575c03bc8b49eb5ccaf8, restored 0f73f8e0a2c8575c03bc8b49eb5ccaf8
```

**Every trap went red on the first plant; none needed a discriminator, and none was removed.**

## 3. Item 2 — the Events summary panel

**Not shed.** `EventsSummaryTable` takes an **opt-in** `onDeleteCampaign`. It asks
per row and gets back `{ name, n, run }` for a campaign's first row, or null, so
the shared table never works out a campaign itself and never deletes. `WhatIfTab`
answers from `campaignGroups` / `promoCampaignGroups` (the pill's lead) and runs the
one function. Compare passes nothing, so it shows nothing. The pin's N is **3**,
which is its final value.

- **(h)** The summary shows one bin per campaign, on the campaign's first row.
  Deleting from it uses the same dialog; the campaign goes to 0 and the neighbour
  keeps 2.
- **(i)** `EventsSummaryTable` is mounted exactly as Compare mounts it, with no
  handler: its rows render and **no bin** does. Compare's source passes no
  `onDeleteCampaign`.
- **Trap 242** makes the bin render without the opt-in, and (i) goes red.

**A premise to correct:** the brief places the bin "beside the campaign switch" on
the summary panel, but that panel has **no** campaign switch. REQ-D6-01 put
campaign switches on the two card tables only, and the summary has a per-row switch.
The bin sits on the campaign's first row beside that row switch, and the group's
first row is the same lead the tables use.

## Gate

Run **serially** as one chain writing to files; captures in the scratchpad:
`gate-cd.out`, the suite in `gate-cd-suite.out`, guard-traps in `gate-cd-gt.out`.

| check | figure |
|---|---|
| `npm run suite` | **72/72 green** — 72 specs: the survey's 71 plus the new `campaign-delete` |
| guard-traps (to a file, per-trap lines) | **238/238 caught**, 0 missed / inconclusive / crashed; unfiltered, no FATAL; 107 and 237–242 each CAUGHT |
| `spec:trap-anchors` | **252/252** — 238 traps, 247 anchors; next free id 243 |
| `spec:i18n-parity` | **200/200** |
| keys per locale | **916** in each of de / en / es / fr / it / pt |
| `spec:i18n-scan` | **PASS** |
| `spec:survival` | **27/27** — 104 first-row dereferences across 26 files |
| `tsc --noEmit` | **clean**, exit 0, 0 errors |
| `npm run lint` | **clean**, exit 0 |
| `npm run build` | **built in 10.25s**; the >2000 kB chunk notice is pre-existing |

**guard-traps left the tree clean:** `WhatIfTab.tsx` md5 `0f73f8e0…` and `EventsSummaryTable.tsx` md5 `3e5eab38…` identical before and after the run.

### Exact counts the brief named

| pin | required | measured | instrument |
|---|---|---|---|
| `runIngest` sites | 3 | **3** (ingest 53/53) | `ingest-spec.tsx:254`, green |
| apply sites | 12 | **12** (event-toggle 156/156) | `event-toggle-spec.tsx:110`, green |
| display markers | 6 | **6** | `event-toggle-spec.tsx:399`, same file |
| ramp/hold checkboxes | 4 | **4** (hold-shape 61/61; direct count 4) | `hold-shape` clause-10 pin, green |
| last-column, Market / Yield / Pricing | 4 / 2 / 3 trailing | **4 / 2 / 3** | `event-toggle-spec.tsx` block from `:502`, green |
| `computeAdjustedForecast` sites | 6 | **6** (pricing-roundtrip 150/150; direct count 6) | `pricing-roundtrip-spec.ts:457`, green |
| `handleSetEventEnabled` invocations | 5 | **5** | direct count in `WhatIfTab.tsx` (a campaign's rows, three card switches, the yield switch) |
| `handleDeleteCampaign` callers | N, stated | **N = 3** (campaign-delete 65/65; 3 in all of `src`) | the `campaign-delete` pin, green, and a direct count |

## What was shed

**Nothing.** Item 0 was recorded and committed alone. Item 1 (never shed) is done:
the function, the bins, the dialog, the member bar, cases (a)–(g) and traps 237–241.
Item 2 is done as well: the opt-in summary bin, cases (h)–(i) and trap 242.

## Limits

- **The Promotion table's per-row bin still deletes without a confirmation.** It
  calls `removeMarketEvent` directly, as it did before this session. Only its
  member bar is new. Bringing it under the dialog is a separate decision.
- **Row EDIT of a ramp or held member is still allowed.** The edit bar has only ever
  covered churn, and decision 4 keeps editing out of this. So a Volume ramp member
  can now be edited alone but not deleted alone. Should the edit bar widen too?
  That is a question for Jon.
- **The one function's signature is `(campaignName, rows)`, not `(campaignName)`.**
  Name alone would merge a Volume campaign and a Promotion campaign that share a
  name, which the grouping keeps apart.
- **The step rule exists twice.** `marketEventExportRow`'s `Mode` line
  (`forecasting.ts:469`) spells out "churn, or `eventMode` ramp" inline, as it did
  before; the predicate states the same rule. It was not touched, because it sits on
  a pinned writer line.
- **Mounted coverage is the harness's.** `removeMarketEvent` is a no-op there, so
  the Promotion per-row bin's own delete is not driven. The dialog's Now/After
  figures were not asserted for a campaign delete.
- **Nothing was opened in a browser.** Everything is asserted in JSDOM, in English.
