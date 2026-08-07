# FOR ADVISOR

**Generated:** 2026-08-07 10:16
**Certifies:** none — Session G NOT started. Blocked on a conflict in the instructions.

**Findings**
- Path A **is** the ability Jon needs. Deleting it and preserving it are the same instruction, opposed.
- Verified: the export iterates `forecastStore` (`App.tsx:456`) writing `Source: 'ForecastStore'`.
- Path A's write at `:2562` is what puts an All-bearing FITTED entry into a save file. Nothing else does it manually.
- Jon's confirmation is not in this message, and the prompt says to wait for it in this message or after.
- I did not start the branch: a partial Session G would gate a half-state and muddy the test artefact.
- Landing the seam rule first is possible but I recommend against it — reason below, it weakens Jon's file as evidence.
- Path B could be removed alone without affecting the file, but splitting one edit region across two gates is worse.

**Decisions needed from Jon / advisor**
- Confirmation that Jon's manual-aggregate save file exists — then Session G runs as specified, unchanged.
- Or: authorise the seam-rule-first split, accepting that the artefact is then produced by a partly-changed build.
- Or: authorise path B's removal now and hold path A. I do not recommend either split; reasons below.

**Merge state:** Nothing built, nothing branched. Tree clean at `dbbee82`. Awaiting confirmation.

---

## The conflict, precisely

Session G's first instruction is **paths A and B out**. The last is **do not delete or alter
the manual path's ability to produce a manual-aggregate save file until Jon's confirmation
arrives in the same message as this prompt or after it.**

Path A *is* that ability. Verified rather than assumed:

- `generateStandardForecast` fits the summed series and writes it to `forecastStore` under an
  All-bearing key when any dimension is "All (Aggregated)" — `src/App.tsx:2548` (fit), `:2562`
  (write).
- The session export iterates `forecastStore` and writes every entry with
  `Source: 'ForecastStore'` — `src/App.tsx:456`, `:464`.

So the manual aggregate reaches the save file through path A and nothing else. Removing path A
removes the ability the same prompt asks me to preserve.

**Jon's confirmation is not in this message.** The prompt admits both readings — "in the same
message as this prompt or after it" — and it is not here, so the hold is live.

## Why I did not start the branch

I could have branched and built the parts that do not touch path A. I did not, for two
reasons.

**The artefact would stop being evidence.** The point of Jon's file is to represent *stored
fitted aggregates from real sessions* — the thing the retirement rule must handle. If the
seam rule lands first, his file is produced by a build that already ignores such entries on
read. Step 2 and Step 3 would derive rather than show his freshly-generated aggregate, which
at best confuses the person making the file and at worst changes what he does while making
it. A test artefact created against a partly-changed build is a weaker witness than one
created against the build it is meant to represent.

**A half-Session-G gates a half-state.** Stage 3 would certify a tree where the read rule is
in and the write paths are not — a state that ships to nobody and that no walk item
describes. That is the attribution problem you split G, H and I to avoid, reproduced inside
G.

## The two splits I could offer, and why I recommend neither

**Seam rule first, deletions after.** Safe in the narrow sense — the manual path still
writes, so the file is still creatable. Rejected for the artefact reason above.

**Path B now, path A after.** Path B is the channel-specific companion write (`:2639`,
`:2653`); removing it does not affect the manual All-selection path Jon is using. But A and B
sit in one edit region in one function, and their removal shares the same spec and the same
mutation. Splitting them means two gates over one change, and the second gate re-treads the
first — for no benefit beyond starting sooner.

## What happens the moment confirmation arrives

Session G runs exactly as specified, unchanged:

- Paths A and B out.
- The provenance-aware rule at the seam: a store entry whose key is All-bearing **and** whose
  provenance is `fitted` is treated as a miss, so derivation answers instead.
- `spec:aggregate-retire` with both cases — the All-bearing-fitted case, and **the leaf-hit
  case that guards the rule's scope**, so a broadened rule that swallows leaf fits is caught.
  Mutations: restore store-first for All-keys (kills case 1); broaden the rule to all fitted
  keys (kills case 2).
- `bulk_complete_retired` as the on-screen statement, keyed across six locales.
- Full gate. Stage 2 confirms a restored old session's numbers change **in the claimed
  direction and no further**. Stage 3 reports specifically whether any figure from Jon's
  earlier walks moves.
- Pre-authorised merge on a clean run.

Nothing in that plan needs revisiting — the design is approved and the census is done. The
only missing input is the confirmation.

## One note for when it comes

Jon's file should be created **before** anything in Session G merges, which the prompt already
requires — but it is worth him also noting *which* aggregate keys he generated. Stage 2's
check is that a restored session's numbers change in the claimed direction and no further, and
that check is sharper if we know which keys are supposed to move. A one-line note from him
naming the selections is enough; without it, stage 2 measures the change but cannot say
whether the set of changed keys is the expected set.
