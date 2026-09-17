# REQ-D6-08 clause 18 — a casing-only rename re-cases the initiative

## FOR ADVISOR

```
Generated: 2026-09-17 11:19 +0100 (UTC 2026-09-17 10:19)
Certifies: a497ff5971b22259146a0bc7c3206fd1ac61aece
Repo: committed a497ff5, pushed (origin in sync)
Clause 18 recorded alone: cf22201. Skeleton: 75da423.
Rename path only (EventsSummaryTable commitRename): when
existingInitiative(to) is the initiative being renamed, it now calls
onSetInitiative(members, to) - the same setter, no new writer. A name
identical to the current one is still nothing. Other-initiative matches
still prompt and merge into the existing casing; no match renames plainly.
Group as unchanged. Setter defs 1, writes 3; initiativeKey 1/2/2.
spec:initiatives 130 -> 140: (s) Launch test -> LAUNCH TEST re-cases every
member, no prompt, one header, count 2; (t) Q4 test -> 'launch TEST'
still prompts "Merge into 'LAUNCH TEST'?" and merges into it.
Trap 275 (self-match stays a no-op) seen RED by hand, restored identical.
No structure pin counted the self-check: nothing to re-aim, none red.
No new i18n keys: 947 per locale. Nothing was shed.
guard-traps targeted 98/98 CAUGHT, rotation 20, NOT RUN 172 (line
verbatim in section 5), last FULL run 6693bd6 2026-09-16T15:35Z
full suite:  76/76 green
```

## 0. Base

Quoted before any change:

- `git status --short` — empty.
- `git diff 8422374 HEAD --stat -- src` — empty.
- `git diff 8422374 HEAD --stat -- scripts` —
  `scripts/guard-traps-ledger.json | 498 +++++++++++++++++++++-------------------`
  (the ledger only, committed with the 0841 report in 9b56400).

HEAD and origin/main were both `9b56400`. Skeleton `75da423` was the first repo
action.

## 1. Item 0 — record

Clause 18 appended under REQ-D6-08 in `test-data/EXPECTED.md`, verbatim, and
committed alone as `cf22201`, pushed before any code.

## 2. Item 1 — the Rename path

`src/components/EventsSummaryTable.tsx`, `commitRename`, now:

```ts
// A typed name identical to the current one is nothing.
if (!to || to === renaming.from || members.length === 0) return;
const into = existingInitiative(to);
// Clause 18: resolving to the initiative BEING RENAMED is a rename.
if (into === renaming.from) { onSetInitiative(members, to); return; }
if (into) { setMerge({ into, members }); return; }
onSetInitiative(members, to);
```

- `to` is already trimmed, so the re-case writes the typed trimmed name.
- The exact `to === renaming.from` check is back as the "identical is nothing"
  guard: the 0841 build had folded it into the no-op self-match, which this
  clause removes.
- Same setter (`handleSetInitiative` definitions 1, `{ initiative }` writes 3),
  no new writer. Group as and the layout are untouched (`initiativeKey` 1
  definition, 2 layout reads, 2 table reads).
- The table now calls `onSetInitiative(members, to)` at 2 places (the re-case
  and the plain rename); no existing pin counts that.

## 3. Mounted — `scripts/initiatives-mounted-spec.tsx`, 130 → 140

Fixture: 'Launch test' on two Volume rows, 'Q4 test' on a Value row.

- **(s)** start: headers `Launch test,Q4 test`, Launch test 2 events. Rename
  Launch test → `LAUNCH TEST` → no prompt; both rows read `LAUNCH TEST` exactly;
  headers `LAUNCH TEST,Q4 test` (old casing gone, Q4 untouched); still 2 events.
- **(t)** Rename Q4 test → `launch TEST` → the prompt reads exactly
  `Merge into 'LAUNCH TEST'? 1 events will join it`; nothing written while it
  asks; Merge → the Value row reads `LAUNCH TEST`; one header, 3 events.

(s) and (t) type names with the same key into the same Rename control; one
re-cases, the other prompts. The branch is self-versus-other, not case.

## 4. Re-aims and traps

**No re-aim.** No structure pin counted the self-check (`into === renaming.from`
appears in no spec or trap), and nothing went red after the change:
`initiatives spec: 140 passed, 0 failed` on the first run; trap-anchors
288 passed, 0 failed (270 traps, 283 anchors) — trap 269's anchor, the
`if (into) { setMerge(...) }` line, is unchanged.

### Trap 275, seen red by hand

EventsSummaryTable md5 `792315c2b88355f5f5c0aedeb39a348c` backed up; the
self-match planted back to `if (into === renaming.from) return;` (planted
`abc6bbd07db70774fac2e5e16b897a80`); restored from the backup
(`792315c2b88355f5f5c0aedeb39a348c`, identical):

    initiatives spec: 134 passed, 6 failed
      FAIL  (s) every member reads 'LAUNCH TEST' exactly  [Launch test,Launch test]
      FAIL  (s) one header 'LAUNCH TEST', the old casing gone, Q4 test untouched  [Launch test,Q4 test]
      FAIL  (s) the member count unchanged (2)
      FAIL  (t) renaming ANOTHER initiative onto it still prompts: Merge into 'LAUNCH TEST'? 1 events will join it  [Merge into 'Launch test'? 1 events will join it]
      FAIL  (t) the merge writes the existing casing 'LAUNCH TEST'  [Launch test]
      FAIL  (t) one header 'LAUNCH TEST' with 3  [Launch test ]

(t) goes red too under this plant only because (s) never re-cased: (t)'s own
prompt still appears, naming the unchanged casing. Registered in
`scripts/guard-traps.ts` under `INITIATIVES`.

## 5. Gate

Run serially on the tree committed as `a497ff5`.

| check | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (exit 0) |
| `npm run build` | built |
| `spec:initiatives` | 140 passed, 0 failed |
| `spec:trap-anchors` | 288 passed, 0 failed (270 traps, 283 anchors) |
| `spec:i18n-parity` | 203 passed, 0 failed; **no new keys, as expected** — 947 in each of en de es fr it pt, locale files untouched |
| `spec:i18n-scan` | PASS |
| `spec:survival` | 27 passed, 0 failed; FIRST-ROW DEREFERENCES 104 across 26 files |
| `npm run suite` | **76/76 green** |
| `npm run guard-traps -- --targeted` | **98/98 CAUGHT**, to a file |

The certification line, verbatim:

```
guard-traps targeted 98/98 CAUGHT (ids 70 71 74 75 76 77 78 79 80 81 121 122 132 133 166 167 168 169 170 171 174 175 176 177 178 179 180 181 182 183 184 185 186 187 190 191 202 203 204 205 222 225 226 227 228 229 230 231 232 234 235 236 237 238 239 240 241 242 243 244 257 258 260 261 262 263 264 265 266 267 268 269 270 271 272 273 274 275), rotation 20 (ids 63 64 65 66 67 68 69 72 73 82 83 84 85 86 87 88 89 90 91 92), NOT RUN 172, last FULL run 6693bd6 2026-09-16T15:35:08.324Z
```

Trap 275 CAUGHT. All 23 harness TARGETS were
backed up to `scratchpad/pre-gt54/` and md5'd before the run and are identical
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

- A rename that differs only by surrounding spaces (`' Launch test '`) trims to
  the current name and is nothing, by the identical-name guard.
- The (s) fixture has no Pricing member; re-casing uses the same setter every
  other rename path uses, which (n) and (p) already drive across all three carriers.
