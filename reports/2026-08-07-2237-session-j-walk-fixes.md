# Session J — the walk fixes

## FOR ADVISOR

```
Generated: 2026-08-07 22:37 +0100 (UTC 2026-08-07 21:37)
Certifies: a51ec8e (merge of session-j-walk-fixes at fa5813d) — MERGED
Audit: agent model fields were ALREADY PRESENT and correct — nothing restored
Audit: no model key in project or user settings; no model env var set
Audit: I also passed the matching model param on every gate call this session
Finding: defect 1 DESIGN GAP — missing meant has-no-forecast, so the loop had no exit
Finding: missing now means fittable-and-not-fitted; three zero states kept apart
Finding: defect 2 DESIGN GAP — the user story ended on a placeholder; now shows the forecast
Finding: defect 3 DESIGN GAP — the error banner outlived its subject
Finding: coverage messages moved off the red surface, consistent with Session I
Finding: defect 4 INTRODUCED BY PHASE 3 — Session H added a caller bypassing the finally
Finding: third instance of one shape — safety living outside the thing it protects
Finding: the pass hiding in the failure — the no-data empty state was CORRECT
Finding: gate found a tab-switch race; a Step 1 result could overwrite Step 2
Finding: three self-inflicted spec faults, all caught by the harness not by review
Decisions needed: none
State: MERGED. Walk resumes at section A step 6; sections B–E stand as written.
```

---

## 0. The routing audit — the fields were never absent

| Agent | `model:` in frontmatter | Passed at call time | Designed |
|---|---|---|---|
| ui-consistency | `haiku` | `haiku` | haiku ✓ |
| qa-tester | `sonnet` | `sonnet` | sonnet ✓ |
| regression-guard | `sonnet` | `sonnet` | sonnet ✓ |
| dependency-mapper | `sonnet` | not invoked | sonnet ✓ |
| debugger | `sonnet` | not invoked | sonnet ✓ |
| ux-design | `opus` | not invoked | opus ✓ |
| **this session** | — | — | `claude-opus-5` |

CLAUDE.md's routing table matches all six. No `"model"` key in
`.claude/settings.json`, `.claude/settings.local.json` or the user-level
settings; no `ANTHROPIC_MODEL`, `CLAUDE_MODEL` or subagent env var.

**So nothing was restored — there was nothing missing to restore.** Per the
instruction, I stopped at the diagnosis.

What I could not determine from inside the session: whether the override is
applied and the usage breakdown attributes subagent tokens to the session's model
line, or whether the harness is not honouring `model` for subagents at all. Both
produce what you saw. That needs the usage breakdown or harness-side visibility,
and guessing between them is precisely what the timestamp convention was written
against.

**One thing I did not have:** the screenshots. They are referenced as the
evidence but did not come through on the turn. I worked from the written
descriptions, which were specific enough; if the images show something the
descriptions do not, that changes what follows.

## 1. The loop — classified DESIGN GAP

`missing` meant **has-no-forecast**. One leaf has two months of history and
cannot be fitted, so it never acquired a forecast, so it was counted as missing
on every render. The button offered a generate, the generate produced nothing,
the count did not move, and there was no exit.

**Every individual step was correct. Only the cycle was wrong** — which is why no
spec that checks one click could see it, and why it took a walk.

`missing` now means **fittable-and-not-fitted**. Unfittability is only knowable by
trying, so the known-unfittable set starts empty and grows from run results;
predicting it up front would be a second copy of the fitting rule and would drift
from it. The set is additive, and resets on a new upload because that is genuinely
new facts.

| state | leaves | button |
|---|---|---|
| `generate` | N fittable-missing | invites, names N |
| `blocked` | 0 fittable, ≥1 unfittable | disabled, says why |
| `covered` | 0 and 0 | disabled, says so |
| `never` | no leaves at all | disabled, says so |

**When only unfittable leaves remain the button is not an invitation.** The
caption already named them; the button now agrees with the caption instead of
contradicting it. Stage 3 confirmed the three disabled states render *different
text*, so the distinction is user-visible rather than memo-only.

## 2. The forecast is visible — DESIGN GAP

The user story ends with a forecast on screen. It is handed to an **effect**
rather than resolved in the promise callback, because the store the run just
wrote has not committed there.

The first attempt read it by passing an identity updater to `setForecastStore` —
a state setter used as a getter. It worked, and `spec:generate-missing`'s mirror
control counted it as a ninth store-writing site. That complaint was correct: **a
reader that looks like a writer is one refactor from being one.**

**The gate then found a race I had not:** generation runs in a worker pool, so a
user can start a Step 1 generate and switch tabs before it lands — and the effect
would call `setBaseForecast` with Step 1's aggregate while they are on Step 2 or
3. Now gated on `activeView === 'standard'`, and the pending key is **discarded**
rather than held: firing it on their return would resurrect a result from a
selection they had moved on from.

## 3. The banner — DESIGN GAP, and the pass inside the failure

The generation error was raised for one cohort and never cleared, so it followed
the user across selections onto unrelated screens. Cleared on selection change,
along with the previous run's result panel.

**Three coverage messages also moved off the red error surface.** Stage 1 raised
it as a judgement call and it is the right call: Session I made the completion
modal a coverage statement rather than a success claim, and routing *"the
remaining cohorts have too little history, the aggregate is summed from the
rest"* through a red banner one screen away would contradict that. Genuine
failures stay red, and the spec checks **both** directions — making everything a
notice is the same defect facing the other way.

**The pass hiding in the failure, as asked:** on a nonexistent leaf combination
the app rendered *"No data for this selection"* correctly. **That screen was
right.** The stale banner sitting on top of it was defect 3 — and an empty state
wearing someone else's error looks exactly like a broken empty state.

## 4. The blocked bulk path — INTRODUCED BY PHASE 3

**Diagnosed before assuming**, as instructed. The Generate Missing button has two
disable conditions: `missingStandardCohorts.length === 0` and
`isGeneratingMissing`. Only the first was suspected, and it is not the one.

`isGeneratingMissing` is set at the top of `generateAllMissingForecasts` and was
cleared on the normal path only. A `try/finally` existed — in the **bulk modal's
`onConfirm` wrapper**, carrying a comment that predicted the exact symptom:
*"would skip the line that clears isGeneratingMissing and leave Generate Missing
permanently disabled reading Generating…"*.

**Session H added a second caller.** The Step 1 aggregate branch calls the
function directly and never touches that wrapper, so a throw left the flag set
and the button disabled for the rest of the session. Independent of defects 1 and
3 — neither touches that flag.

The `finally` is now inside the function. The wrapper stays as harmless
redundancy, with its comment corrected: it claimed the function had no `finally`,
which was true when written and is false now.

**This is the third instance of one shape**, after Session G's import bypass and
the retirement rule's reach. Stated as a rule since three is enough: **if the
reason a thing is safe lives outside the thing, the next caller will not inherit
it.**

## 5. Three self-inflicted spec faults, all caught by the harness

Worth listing because none was caught by reading:

- **Trap 25 MISSED** — `s.replace` matched the first `setBaseForecast(forecast);`
  in the file, which belongs to a filter handler, not the resolver. The trap's
  fault; now anchored inside the function it targets.
- **Trap 24 MISSED** — the **spec's** fault: its state machine is a transcription
  of App's memo, so mutating App left every check green. Same lesson as trap 13;
  a structural guard now gives the trap something to kill.
- **Trap 26 INCONCLUSIVE** — its anchor broke when `setNotice` landed between the
  two lines it pinned, and the harness reported INCONCLUSIVE rather than a false
  catch. That state earning its keep.
- A spec check anchored on a message string found it in **a comment I had written
  about that message** and reported a failure entirely its own.

Two pinned counts also fired as designed — the `setBaseForecast` enumeration
(11→12) and the store-writer count (8→9) — and both new sites were classified
rather than waved through.

## 6. Gate

- **ui-consistency** — technical checks clean; raised the error-surface question
  as a judgement call, which produced the notice surface above.
- **qa-tester** — drove the loop and its negative control, traced the effect
  dependencies and found the tab-switch race, verified every
  `missingLeavesForKey` caller, confirmed the 3-arg specs still measure what they
  claim.
- **regression-guard** — **SAFE FOR USER TESTING**. Drove `resolveFromStore`
  against a real store rather than accepting the specs' word, confirmed the four
  states render distinct text, and re-measured 74/72/2 independently.
- 22 spec suites green (`walk-fixes` 54/54), `guard-traps` 27/27 with 23–27
  caught, `traps` 3/3, typecheck 0, build clean, i18n parity 0 missing, scoped
  no-AI confirmed, `.env` untracked.

**No figure from any earlier walk moves.** `spec:derive`'s pinned ARPU MAPEs and
`spec:leafgrain`'s 72-of-74 re-ran identical; 74/72/2 stands.

## 7. The walk resumes

**From section A step 6, on `a51ec8e`.** Stage 3 checked each later section
against the diff:

| section | depends on | touched? | valid as written? |
|---|---|---|---|
| B — coverage modal | `BulkGenerateModal.tsx` | zero diff | **yes** |
| C — retired-aggregate notice | session restore, `App.tsx:790-882` | outside every diff hunk | **yes** |
| D — Step 1 chart | chart region of the tab | diff confined to the button/notice block | **yes** |
| E — copy | locale files | additive keys only, no existing key edited | **yes** |

**Section A's expectations change**, and these supersede the earlier walk text:

- **Step 7** — the button names a count as before.
- **Step 8** — after generating, the derived forecast now **appears on screen**
  without further interaction, and the two short leaves are named beneath it.
- **Step 9** — on a scope where the only remaining leaves are the unfittable ones,
  the button is disabled reading *"2 cohorts have too little history to
  forecast"* — **not** "already forecast", and **not** an offer to generate.
  Clicking is impossible; the count no longer sits at "Generate 1 missing".
- **Step 10** — unchanged: a combination not in the data reads *"No cohorts in
  your data match this selection"*, distinct from step 9's message.
- **New** — coverage messages appear in a **grey** panel, not a red one. A red
  banner now means something actually failed.
- **New** — changing selection clears any banner. If a message follows you to
  another cohort, that is a regression of defect 3.
