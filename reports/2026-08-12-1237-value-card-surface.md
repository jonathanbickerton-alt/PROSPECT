# Request 2's card surface — written after the close it should have had

## FOR ADVISOR

```
Generated: 2026-08-12 12:37 +0100 (UTC 2026-08-12 11:37)
Certifies: 4d8ae2b, branch main, tree CLEAN.
Repo: committed 4d8ae2b, pushed (origin in sync)
RETROSPECTIVE: the build happened last session and its close did not — guard-
  traps was still running when it ended. This session re-ran exactly what the
  close requires (full suite, pinned figures) and nothing more. Guard-traps was
  NOT re-run; 62/62 is quoted from the run that completed on this same tree.
MY STATE-CHECK ERROR, recorded: the first check found src/App.tsx modified and
  it read like a stranded mutation. It was not — the run had not died, it was
  still going, and I read the tree mid-mutation. Against a rule I amended
  myself: a STATE CHECK is part of "everything else" that waits. Once the run
  finished, every guard-traps target verified at 0 changed lines.
SHIPPED: per-tier Base ARPU editable on the Value card. The derived figure is
  the PLACEHOLDER; clearing DELETES the key (Number('') is 0, and those two
  states are what the carrier exists to separate); stated zero and negative
  carried verbatim, zero sign transforms asserted at source.
ONE DEFINITION, THREE READERS that must agree: effectiveTierArpu feeds the live
  blend, the yield column and the construction snapshot. The saved event stores
  the EFFECTIVE rate so a reload behaves as the card showed, and the override map
  persists alongside so PROVENANCE survives.
SHED, both declared: item 3's ?? 0 display fixes (pre-authorised first drop) —
  an ARPU-less tier still reads 0.00, not "not known"; and THE MOUNTED SPEC. Its
  stand-in is 8 source assertions plus trap 64, which catch the wiring being
  SEVERED but do NOT prove rendered behaviour. 26/26 covers the wiring, not the
  four transitions. GATE: 36/36 suite, lint+build clean, 74/72/2 and MAPEs held.
```

---

## 0. Why this is retrospective, and what was re-run

**The build happened in the previous session and its close did not.** Guard-traps
was still running when that session ended, so the suite, commit, push and report
never ran. This session completed them.

**Retrospective, and labelled.** The build itself is not re-described from
memory — it is in the diff at `4d8ae2b`. What this session re-ran is exactly what
the close requires and no more: **the full suite (36/36), the pinned figures, and
nothing else**. Guard-traps was not re-run; its result (**62/62 caught**, trap 64
new and caught) is quoted from the run that completed at the start of this
session, on this same tree.

### A state-check error worth recording

The brief's third branch asked me to check for stranded mutations if the session
died mid-guard-traps. My first state check found `src/App.tsx` modified — a file
the card-surface work never touched — which read exactly like a stranding.

**It was not.** The run had not died; it was still going, and my `git status`
read the tree mid-mutation. By the time I diffed the file, guard-traps had
restored it and the diff was empty.

**That is my error, against a rule I amended myself**: nothing else may read the
tree while guard-traps runs. I read it, drew a conclusion from the read, and the
conclusion was wrong in the alarming direction. The rule's own wording says
"start it, wait for it, then run everything else" — a *state check* is part of
"everything else", and I did not treat it as such.

Once the run genuinely completed, every guard-traps target was verified clean:

| target | changed lines |
|---|---|
| `ForecastVsActualsTab.tsx`, `forecasting.ts`, `App.tsx`, `StandardForecastTab.tsx`, `BulkGenerateModal.tsx`, `viewFilter.ts`, `mixConstraint.ts` | **0 each** |

`WhatIfTab.tsx` was the only target with a diff, and that diff is the card
surface.

## 1. What the surface does

The per-tier **Base ARPU** is editable on the Value card. The blend stays
derived — that is reading (b), and the point of it.

The input follows `pct-arpu-override`:

- the **derived figure is the placeholder**, so an unset box shows it without
  claiming it as a choice;
- a stated value is styled distinctly — red border and weight, the app's
  established user-set-vs-derived treatment;
- **clearing DELETES the key** rather than storing a zero. `Number('')` is `0`,
  and "a band priced at nothing" versus "a band the user said nothing about" is
  exactly what the carrier exists to separate;
- a stated **zero** or a **negative** is carried verbatim, with **no sign
  transform** — asserted at source.

### One definition, three readers

`effectiveTierArpu(tier, derived)` — override-if-present **by presence**, else
derived. Three things read it, and they are the three that must agree:

1. the **live blend**, which depends on the override map — that dependency is
   what makes a tier edit move the blend with **no save**;
2. the **yield column** on each row;
3. the **construction site's snapshot**.

The third is the one worth pausing on. The saved event stores the **effective**
rate, so a reloaded event behaves as the card showed it — while the override map
persists alongside, so **provenance survives**. Which number was the user's is
not recoverable from the snapshot alone, which is why both are stored rather than
one.

## 2. What was shed — declared, not quiet

**Item 3, the `?? 0` display fixes.** Pre-authorised in the brief as the first
drop. So an ARPU-less tier still reads as a real and very cheap tier rather than
"not known", and an override does not yet *resolve* an absence on screen. The
four **engine-arithmetic** sites remain untouched, as option-(b) scope.

**The mounted spec.** What stands in its place is **eight source-level
assertions** — the input exists and is addressable, it writes by presence,
clearing deletes, the derived figure is the placeholder, the effective rate tests
presence not truthiness, the blend reads it, the blend depends on the override
map, the construction site snapshots it — plus **guard-trap 64**, which makes
clearing store a zero instead of unsetting.

**This is weaker than what the brief asked for and the difference matters.**
Those checks catch the wiring being *severed*. They do **not** prove rendered
behaviour: that a tier edit visibly moves the blend on screen is still unproven
by machine. 26/26 on this spec should not be read as covering the four
transitions — it covers the wiring beneath them.

## 3. Gate

| instrument | result |
|---|---|
| `spec:yield-roundtrip` | **26/26** (18 persistence + 8 wiring) |
| full suite | **36/36** npm scripts green |
| guard-traps | **62/62** caught — trap 64 new and CAUGHT *(quoted from this tree's run, not re-run)* |
| lint (`tsc --noEmit`) | exit 0 |
| build (vite) | succeeded |
| edge fixture | 74 leaves, 72 fit, 2 skipped |
| PINNED ARPU MAPEs | 13.8845 / 13.4315 / 14.3888 / 13.0192 |

Suite and figures re-measured in this session. **No earlier figure moved.**

No three-stage agent gate was run. i18n: 2 new keys × 6 locales, additive; the
9-key parity gap is unchanged and pre-existing.

§33 with the scope named: **main's working tree and build output are AI-free**
(`package.json`, `src/`, `.env`). History and remote branches are out of scope;
the preserved `ai-capability` branch is expected.

## WALK INSTRUCTIONS

Step 2 → **Value** card → pick a cohort with tiers.

**1. A tier edit moving the blend live.** The Base ARPU column is now a set of
boxes, each showing its derived figure in grey as a placeholder. Type over one.
The box should change appearance, that row's Yield figure should move, and the
**New blended ARPU** below should move **immediately — no save**. That live
movement is the thing to confirm; it is the half a machine has not proven.

**2. Cleared is unset, not zero.** Clear the box you edited. It should return to
the grey derived placeholder, not sit at `0.00`, and the blend should return to
where it was. Then type `0` deliberately — that must read as *your* value, styled
as an override, and pull the blend down. Zero and empty are different answers.

**3. Reload survival.** Add the yield event, export, reload, reopen it. Your
stated tier rates must come back exactly as typed, including a negative if you
try one.

**What you will NOT see, and should not go looking for:** a tier with no ARPU
still shows `0.00` rather than "not known". That is item 3, deliberately shed —
so if you find a tier reading zero that ought to read unknown, it is a known hold
rather than a new defect.

## Where things stand

Request 2: **complete** — persistence at `a50cca9`, surface at `4d8ae2b` — with
item 3 and the mounted spec held. Request 3: designed, not built. Option (b):
queued, scoped, untouched.
