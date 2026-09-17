# REQ-D6-08 clause 17 — initiative names match case-insensitively; the existing casing wins

## FOR ADVISOR

```
Generated: 2026-09-17 10:09 +0100 (UTC 2026-09-17 09:09)
Certifies: 8422374a4ac60bff135df05664eea9bcb41507af
Repo: committed 8422374, pushed (origin in sync)
Clause 17 recorded alone: e6683d4. Skeleton: 5d490c0.
ONE comparison helper: initiativeKey(name) = trim + toLowerCase, defined
once in src/utils/forecasting.ts. Read by initiativeGroups' grouping key
and by the table's one resolver, existingInitiative, which Group as and
Rename both call. No exact name comparison is left in the table.
Group as 'launch test' -> writes 'Launch test' (existing casing), no prompt.
Rename onto 'launch TEST' -> "Merge into 'Launch test'?", merges into it.
A save holding both casings renders ONE header, first-seen casing; its
switch moves every row of both. Setter unchanged: defs 1, writes 3.
Choice made: retyping an initiative's own name in another casing is a
no-op (the existing casing wins), not a merge into itself.
spec:initiatives 111 -> 130: (p)(q)(r) + 5 structure pins.
Traps 272-274 seen RED by hand, restored identical.
Re-aim seen red: trap-anchors, trap 269's anchor aged out (the includes()
line is gone); re-aimed to the new merge line, planted red by hand.
No new i18n keys: 947 per locale, unchanged. Nothing was shed.
guard-traps targeted 97/97 CAUGHT, rotation 20, NOT RUN 172 (line
verbatim in section 5), last FULL run 6693bd6 2026-09-16T15:35Z
full suite:  76/76 green
```

## 0. Base

Quoted before any change:

- `git status --short` — empty.
- `git diff c9ff73b HEAD --stat -- src` — empty.
- `git diff c9ff73b HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 594 ++++++++++++++++++++++------------------`
  (the ledger only, committed with the 0647 report in a0658cd).

HEAD and origin/main were both `a0658cd`. Skeleton `5d490c0` was the first repo
action.

## 1. Item 0 — record

Clause 17 appended under REQ-D6-08 in `test-data/EXPECTED.md`, verbatim, and
committed alone as `e6683d4`, pushed before any code.

## 2. Item 1 — one comparison helper

**`initiativeKey(name: string): string` — `src/utils/forecasting.ts`**, directly
above `initiativeGroups`: `name.trim().toLowerCase()`. Definitions: 1.

Its readers:

1. **The layout.** `initiativeGroups` keys its member map and its placed-set on
   `initiativeKey(r.initiative)` (2 sites). The header's `name` stays the FIRST
   member's raw name, so a save holding 'Launch test' and 'launch test' renders
   one header under the casing seen first in today's order.
2. **The table's resolver.** `existingInitiative(typed)` in
   `EventsSummaryTable.tsx` finds the header name whose key equals the typed
   name's key (the only 2 `initiativeKey(` calls in the table). It is called by:
   - **Group as:** `onSetInitiative(pickedRows, existingInitiative(name) ?? name)`
     — a match writes the EXISTING casing, with no prompt; no match writes the
     trimmed typed name.
   - **Rename:** `const into = existingInitiative(to);` — a match opens the merge
     prompt naming `into` (the existing casing) and the merge writes `into`; no
     match renames with no prompt.

The setter is unchanged: `handleSetInitiative` definitions 1, `{ initiative }`
writes 3. The caller resolves the canonical casing before calling it. The
pick-list is unchanged (it lists header names).

**A choice this clause did not state, made and flagged.** Renaming 'Launch
test' to 'LAUNCH TEST' resolves to the initiative being renamed. The code treats
that as a no-op (the existing casing wins, as clause 17 says for every other
match) rather than prompting "Merge into 'Launch test'?" onto itself. So a
casing-only rename cannot change an initiative's casing; Dissolve then Group as
can. The old exact `to === renaming.from` check is subsumed by this.

## 3. Mounted — `scripts/initiatives-mounted-spec.tsx`, 111 → 130

Fill-in order; the expected names are hand-written literals.

- **(p)** Fixture: 'Launch test' (a Volume row), 'Q4 test' (a Value and a
  Pricing row), a loose row. Two headers. Rename Q4 test → `  launch TEST ` →
  the prompt reads exactly `Merge into 'Launch test'? 2 events will join it`;
  nothing written while it asks; Cancel → both names, both headers. Rename again,
  Merge → every member reads `Launch test` exactly; one header, 3 events.
- **(q)** Select, tick the loose row, Group as `launch test` → no prompt; the row
  reads `Launch test`; one header, 4 events.
- **(r)** Fixture: a Volume row 'Launch test', a Volume row 'launch test', a Value
  row 'launch test', a free row → ONE header `Launch test` with 3 events; the
  switch reads all on; clicking it turns all three rows off, across carriers;
  the free row is untouched.
- **Structure (X), 5 new pins:** initiativeKey defined once in forecasting.ts and
  nowhere else; the layout reads it twice; the table calls it twice inside one
  resolver, defined once and called by Group as and Rename (2 calls); no
  `initiativeNames.includes(` survives.

One pin I wrote counted `existingInitiative(` as 3 (definition + 2 calls); the
definition is `const existingInitiative = (`, so the count is 2. Seen red on the
first run (`[2 / 2]`), corrected to "definition 1, calls 2". It was a new pin,
not a re-aim of an existing one.

## 4. Re-aims and traps

### trap-anchors — trap 269 aged out

Seen red after the build:

    trap-anchors spec: 286 passed, 1 failed  (269 traps, 282 anchors)
      FAIL  trap 269 Rename onto an existing name merges without the dialog: anchor 1 still matches EventsSummaryTable.tsx  [ZERO — the anchor has aged out; the trap plants nothing]

Its anchor, `if (initiativeNames.includes(to)) { setMerge(...) }`, is the exact
comparison clause 17 retires. Re-aimed to the new line,
`if (into) { setMerge({ into, members }); return; }`, and planted by hand:
EventsSummaryTable md5 `dffd5cc10cc06573853d3e4a6d5c7bf5` → planted
`c853a7317c73b3f6cfdee772f17d8a2f` → restored `dffd5cc10cc06573853d3e4a6d5c7bf5`
(identical): `initiatives spec: 123 passed, 7 failed`, first line
`FAIL  (n) renaming onto a USED name asks first`, and (p) red too. trap-anchors
then 287 passed, 0 failed (269 traps, 282 anchors).

### Traps 272–274, seen red by hand

Each: md5 before, backup, plant, `spec:initiatives`, restore FROM THE BACKUP,
md5 after. All restored identical.

| trap | file | before | planted | after | tally |
|---|---|---|---|---|---|
| 272 | forecasting.ts | 66a76dfcf4bcb4de399f351b773df5d4 | 7edafcb2d51a0a57f278d64d1d91227f | 66a76dfcf4bcb4de399f351b773df5d4 | 120 passed, 10 failed |
| 273 | EventsSummaryTable.tsx | dffd5cc10cc06573853d3e4a6d5c7bf5 | 8e8c8f1af5296e01e26c8fa56bd0a1a0 | dffd5cc10cc06573853d3e4a6d5c7bf5 | 128 passed, 2 failed |
| 274 | forecasting.ts | 66a76dfcf4bcb4de399f351b773df5d4 | e5b6691a2b668c515cc9aa67b9777b46 | 66a76dfcf4bcb4de399f351b773df5d4 | 126 passed, 4 failed |

- **272** the comparison is exact (`name.trim()`):
  `FAIL  (p) it PROMPTS, naming the EXISTING casing: Merge into 'Launch test'? 2 events will join it  [(no prompt)]`
- **273** Group as writes the typed casing:
  `FAIL  (q) the row reads 'Launch test' — the existing casing, not the typed one  [launch test]`
  (the header count stays green under this plant, because the layout still
  groups case-insensitively — the row's stored casing is what goes red.)
- **274** the layout keys on the raw name:
  `FAIL  (r) ONE header, under the first-seen casing 'Launch test'  [Launch test,launch test]`

No green plant. All three registered in `scripts/guard-traps.ts` under
`INITIATIVES`.

## 5. Gate

Run serially on the tree committed as `8422374`.

| check | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (exit 0) |
| `npm run build` | built |
| `spec:initiatives` | 130 passed, 0 failed |
| `spec:trap-anchors` | 287 passed, 0 failed (269 traps, 282 anchors) |
| `spec:i18n-parity` | 203 passed, 0 failed; **no new keys, as expected** — 947 in each of en de es fr it pt, locale files untouched |
| `spec:i18n-scan` | PASS |
| `spec:survival` | 27 passed, 0 failed; FIRST-ROW DEREFERENCES 104 across 26 files |
| `npm run suite` | **76/76 green** |
| `npm run guard-traps -- --targeted` | **97/97 CAUGHT**, to a file |

The certification line, verbatim:

```
guard-traps targeted 97/97 CAUGHT (ids 70 71 74 75 76 77 78 79 80 81 121 122 132 133 166 167 168 169 170 171 174 175 176 177 178 179 180 181 182 183 184 185 186 187 190 191 202 203 204 205 222 225 226 227 228 229 230 231 232 234 235 236 237 238 239 240 241 242 243 244 257 258 260 261 262 263 264 265 266 267 268 269 270 271 272 273 274), rotation 20 (ids 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 59 60 61 62), NOT RUN 172, last FULL run 6693bd6 2026-09-16T15:35:08.324Z
```

Traps 272–274 and the re-aimed 269 each CAUGHT. All 23 harness TARGETS were
backed up to `scratchpad/pre-gt53/` and md5'd before the run and are identical
after it. The ledger is committed WITH this report; the build commit excludes it.

| count | measured |
|---|---|
| last columns Market / Yield / Pricing | 6 / 4 / 4 (the 3 writers untouched; column pins green in the suite) |
| computeAdjustedForecast | 6 |
| eventScopeSeriesFor callers | 5 |
| solveForCohortTarget definitions | 1 |
| buildPromoEvents | 5 |
| resetYieldDraft() calls | 2 |
| handleDeleteCampaign callers | 3 |
| setPendingChange staging sites | 7 |
| campaignToggleState definitions | 1 |
| handleSetEventEnabled definitions | 1 |
| initiativeGroups definitions | 1 |
| handleSetInitiative definitions | 1 |
| carryInitiative sites | 3 |
| writes of `{ initiative }` | 3 |
| handleDeleteInitiative definitions | 1 |
| initiativeKey definitions / layout reads / table reads | 1 / 2 / 2 |

## What was shed

Nothing.

## Limits

- A casing-only rename of an initiative is a no-op (section 2). Not decided by
  the clause; flagged for Jon rather than resolved silently.
- Lower-casing is `toLowerCase()`, not locale-aware (e.g. Turkish dotted I).
- The Compare column shows each row's stored casing; clause 15 gives Compare no
  grouping, so a save holding both casings shows both there.
- Carry (`carryInitiative`) copies the first stored name on a campaign edit; it
  does not re-case rows that already differ.
