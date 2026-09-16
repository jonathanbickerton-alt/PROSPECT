# REQ-D6-07 clause 16 — the Value card's basis resets to Forecast after Add

## FOR ADVISOR

```
Generated: 2026-09-16 15:41 +0100 (UTC 2026-09-16 14:41)
Certifies: ab2c6349c2767d10ad075ba5e17156902839486e
Repo: committed ab2c634, pushed (origin in sync)
After a Value-card Add the next draft opens on Forecast. ONE reset:
resetYieldDraft (WhatIfTab.tsx:3507), the twin of resetPromoDraft.
Cancel (:3514) and BOTH Save dispositions (:3594) call it; the two inline
setYieldArpuMode('forecast') copies it replaces are gone.
Reopen still restores the stored basis (handleEditYieldStart, clause 14).
arpu-basis (f), 5 checks, as a PAIR: Historical chosen, Add, next draft
Forecast AND the added event reopens Historical - so "reset" cannot pass
as "never stored". arpu-basis 23/23.
Trap 260 (Add leaves the basis as chosen) seen RED by hand against
pre-plant md5 ede11d14, restored from the scratchpad backup identical:
FAIL (f) and the NEXT draft opens on Forecast ... [historical]
Trap 142 re-anchored (its read-set line now names resetYieldDraft).
No new i18n keys: 930 per locale, no locale file changed.
Counts: last 5/3/3; engine 6; seam 5; solver defs 1; buildPromoEvents 5.
Nothing was shed. No decision is reserved for Jon.
guard-traps targeted 26/26 CAUGHT (ids 141 142 257 258 259 260), rotation 20 (ids 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20), NOT RUN 229, last FULL run 67346b6 2026-09-16T13:49:48.562Z
full suite:  75/75 green
```

## 0. Base

Quoted before any change:

- `git status --short` — empty.
- `git diff fdc5852 HEAD --stat -- src` — empty.
- `git diff fdc5852 HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 1720 ++++++++-----` (one file, the ledger
  from the 1313 FULL run).

BASE for the STOP diffs: `fdc5852`.

## 1. Item 0

Clause 16 appended verbatim under REQ-D6-07 and committed alone as `23f9b3a`,
before any code.

## 2. Item 1

### The one reset

`resetYieldDraft` (`src/components/WhatIfTab.tsx:3507`) is the Value card's only
draft reset. It clears the draft and returns `yieldArpuMode` to `'forecast'`.

- `handleCancelYieldEdit` calls it (`:3514`), in place of its own inline
  `setNewYieldEvent({})` + `setYieldArpuMode('forecast')`.
- `handleAddYieldEvent` calls it once, after both dispositions (`:3594`). That
  replaces the edit-branch-only `setYieldArpuMode('forecast')` and the trailing
  `setNewYieldEvent({})`. Add and edit-Save now reset identically, and the
  save's read-set lists `resetYieldDraft`.

`setYieldArpuMode('forecast')` now appears once outside the toggle's own
`onClick`, inside `resetYieldDraft`. The 1222 behaviour this retires ("a plain
add does NOT reset it") was my call in that build; clause 16 overrides it.

### Mounted — arpu-basis (f)

`scripts/arpu-basis-mounted-spec.tsx`, **23/23** (18 + 5):

1. The user chooses Historical on a new Value-card draft.
2. Add goes through (one event captured).
3. **The next draft opens on Forecast.**
4. The added event STORED `historical`.
5. **The pair:** that event, mounted and reopened through `yield-edit-*`, shows
   Historical. Without it, check 3 would also pass for a card that never left
   Forecast.

### Trap 260, seen red by hand

- Pre-plant `WhatIfTab.tsx` md5 `ede11d1405e5137f826af8c10ddedc20`, backed up to
  `scratchpad/pre-260/`.
- Plant: the Add disposition returns before the reset
  (`if (!editingYieldId) { setNewYieldEvent({}); return; }` in place of the
  clause-16 comment line). Planted md5 `2c49a720…`.
- `arpu-basis spec: 22/23 passed`, with exactly the check it exists for:
  `FAIL  (f) and the NEXT draft opens on Forecast — the chosen basis did not carry  [historical]`
- Restored from the scratchpad backup: md5 `ede11d1405e5137f826af8c10ddedc20`,
  identical.

It is registered as trap 260 with the same mutation, spec `arpu-basis`.

**Trap 142 re-anchored**: `spec:trap-anchors` reported
`FAIL trap 142 … [ZERO — the anchor has aged out]` because the save's read-set
line now names `resetYieldDraft`. Same plant, new anchor text.

## 3. Gate

| step | result |
|---|---|
| `npm run suite` | **75/75 green** |
| `npm run guard-traps -- --targeted` | **26/26 CAUGHT**, 0 missed / inconclusive / crashed (line below) |
| `spec:trap-anchors` | 270 passed, 0 failed (255 traps, 265 anchors) |
| `spec:i18n-parity` | 200 passed, 0 failed — **930 keys per locale**, all six; **no new keys**, no locale file changed against `fdc5852` |
| `spec:i18n-scan` | PASS |
| `spec:survival` | 27 passed, 0 failed; **104 first-row dereferences across 26 files** |
| `tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm run build` | built in 6.39s |

The certification line, verbatim:

```
guard-traps targeted 26/26 CAUGHT (ids 141 142 257 258 259 260), rotation 20 (ids 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20), NOT RUN 229, last FULL run 67346b6 2026-09-16T13:49:48.562Z
```

Traps 142 and 260 each CAUGHT. **guard-traps left the tree clean**: all 23
harness TARGETS were backed up to the scratchpad and md5'd before the run, and
all 23 are identical after it (`WhatIfTab.tsx` `ede11d14…` both sides).

The ledger (`scripts/guard-traps-ledger.json`) is committed WITH this report.
The build commit `ab2c634` excludes it. "last FULL run 67346b6" is the 1313
release gate's run of `fdc5852`'s source.

| count | measured |
|---|---|
| last columns Market / Yield / Pricing | **5 / 3 / 3** (`spec:event-toggle` 158/158) |
| `computeAdjustedForecast` sites | **6** |
| `eventScopeSeriesFor` callers | **5** |
| `solveForCohortTarget` definitions | **1** |
| `buildPromoEvents` in WhatIfTab | **5** |
| `handleDeleteCampaign` | **3** |
| `resetYieldDraft()` calls | **2** (cancel, save) — one definition |

## What was shed

**Nothing.** Clause 16 is recorded and built: one reset, case (f) as a pair,
trap 260 seen red by hand and registered.
