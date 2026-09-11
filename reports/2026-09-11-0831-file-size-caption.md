# File-size follow-up: the caption, the notice, the routing line

```
FOR ADVISOR
Generated: 2026-09-11 09:31 +0100 (UTC 2026-09-11 08:31)
Certifies: __ PENDING
BASE __ PENDING
1 __ PENDING
2 __ PENDING
3 __ PENDING
4 __ PENDING
SHED: __ PENDING
guard-traps: __/__ PENDING
full suite:  __/__ PENDING
Repo: __ PENDING
```

## 0. The base check

```
$ git status --short
(empty)

$ git diff 6fd13f8 HEAD --stat -- src scripts test-data
(empty)
```

Both quoted verbatim. BASE `6fd13f8` is the hash the 0742 report certifies.

**Item 0** — decision 4 recorded under REQ-D6-04 in `test-data/EXPECTED.md`,
verbatim from the brief, committed alone at `b3bab26` before any code.

## 1. The megabyte figures — measured

Grepped all six locale files and `src/` for every digit-then-megabyte shape
before changing anything.

**User-facing, typed in — ONE key, SIX locales:**

| locale | key | value | file:line |
|---|---|---|---|
| de | `up_to_50mb` | `Bis zu 50MB (.xlsx, .xls, .csv)` | `src/locales/de/translation.json:29` |
| en | `up_to_50mb` | `Up to 50MB (.xlsx, .xls, .csv)` | `src/locales/en/translation.json:29` |
| es | `up_to_50mb` | `Hasta 50MB (.xlsx, .xls, .csv)` | `src/locales/es/translation.json:29` |
| fr | `up_to_50mb` | `Jusqu'à 50 Mo (.xlsx, .xls, .csv)` | `src/locales/fr/translation.json:29` |
| it | `up_to_50mb` | `Fino a 50MB (.xlsx, .xls, .csv)` | `src/locales/it/translation.json:29` |
| pt | `up_to_50mb` | `Até 50MB (.xlsx, .xls, .csv)` | `src/locales/pt/translation.json:29` |

**The French row is the finding inside the finding.** My first grep pattern
was `[0-9]+ ?MB` and it returned **five** hits, not six. French writes the unit
as **"Mo"** (mégaoctet), with a space, so a search for the English unit missed
it — the same blindness that let the byte-literal pin miss all six. It was
found only by grepping the key name across locales. A check for this class
therefore cannot be a search for "50MB"; it has to forbid the *shape* in every
spelling.

**Already correct, and why:**

- `app_file_too_large` (the refusal) reads `MAX_UPLOAD_MB` through `{{p2}}`
  (`src/utils/ingest.ts:65`). That is why Jon's 215.4 MB refusal showed the
  exact limit.
- `app_reading_notice` carries `{{p1}} MB` — the size of *the file being read*,
  a placeholder, not the limit.

**Not user-facing — ten hits, all COMMENTS**, and left alone:
`src/App.tsx:725, 1168, 1931` and `src/utils/ingest.ts:6, 22, 23, 26, 30, 55,
156`. Each is a historical note explaining why the limit moved ("the 50MB
literal that stood here…"). Rewriting them would erase the record of the
change; they are prose, never rendered.

## 2. The caption, the notice, and the six locales

**The caption.** `up_to_50mb` is renamed `up_to_max_mb` and its value carries
`{{p0}}`, filled at the render site (`HomeTab.tsx`) from `MAX_UPLOAD_MB`.
**The key name is renamed deliberately**: a reader grepping for the limit found
a key called `up_to_50mb` and read it as documentation of a rule that had
already changed. A stale figure in an identifier is the same defect as one in
copy.

**The notice.** Only the middle clause changes, "can take up to a minute" →
the measured figure; the rest of each sentence is left exactly as the locale
had it:

| | new clause |
|---|---|
| en | large files usually take under 15 seconds |
| de | große Dateien dauern in der Regel unter 15 Sekunden |
| es | los archivos grandes suelen tardar menos de 15 segundos |
| fr | les fichiers volumineux prennent généralement moins de 15 secondes |
| it | i file di grandi dimensioni richiedono di solito meno di 15 secondi |
| pt | ficheiros grandes demoram normalmente menos de 15 segundos |

de and it are the session's own wording, as the brief requires — never English.
**"15" is safe under the zero-occurrence rule**: it is followed by a word for
seconds, not a megabyte unit.

**15 is Jon's measurement with margin, not a new estimate.** 197.3 MB — the
largest file under the limit — parsed in 9.6 s on the target laptop. "Under 15"
covers it with a third to spare. It would not have been honest to write "under
10".

### `spec:size-copy` — 28/28, explicit exit after its report line

**The check that matters is structural and zero-occurrence**: no string in any
of the six locales may match a digit, optional space, then `MB` / `Mo` / `MiB` /
`Mio`, case-insensitive. It asserts the *absence of a shape* rather than the
value of one key, so a seventh mention appearing somewhere else is caught the
day it is typed, and a pin on one key could never do that.

**The placeholder is excepted by construction, not by a special case.**
`{{p0}}MB` has a brace before the unit, not a digit. `({{p1}} MB)` likewise —
the `1` in `p1` is followed by `}}`. Nothing had to be carved out.

**Not vacuous, and proved so inside the spec**: the matcher is run against the
old English caption and the old *French* one ("50 Mo") and must fire on both,
and must *not* fire on either placeholder form. A zero-occurrence check whose
regex never matches anything would pass forever.

**Mounted**: `HomeTab` is rendered in all six locales and the caption must
contain `200` (read from `MAX_UPLOAD_MB`, not typed into the test), must not say
50, and must still name `.xlsx` and `.csv` — a copy change, not a cut. Nothing
mounted `HomeTab` before this; its nine props are simple, so it now does.

## 3. The routing line — measured, then decided

**Measured before changing anything, and the screenshot's explanation was
wrong.** Jon's screenshot shows only "Session restored successfully", which
reads as the routing line being *replaced by the restore banner*. It was not.

The line **was set**: the session branch called
`setIngestNotice(t('app_routed_to_import_save'))` (`App.tsx:1993`). It was then
**wiped by `runIngest`'s own `finally { showNotice(null) }`**
(`ingest.ts:185`) — because `showNotice` **is** `setIngestNotice`
(`App.tsx:1963`). The branch runs inside `onResult`, which that `finally`
follows. So the line existed for less than a task and never painted.

The brief's two branches were "never renders → add it" and "renders and is
replaced → keep both". The truth was a third: **it was set and cleared by the
machinery that displays it.** Both keys already existed in all six locales, so
**no new key was needed** — only a state the teardown does not own.

**The fix**: a `routedLine` state with its own render site (`ingest-routed`),
**beside** the restore banner and **not gated on the notice** — `ingest-loaded`
renders `{loadedLine && !ingestNotice`, deliberately, but the routing line says
something the banner does not, so it must not copy that shape. All three ingest
paths clear it at their start, so a line explaining one file cannot survive
onto the next.

### What is proved, and what is a stand-in — stated, not implied

**`App.tsx` cannot be mounted headlessly** — `nav-target-spec` records the same
limit. So "both lines in the DOM after routing" is proved in two halves:

1. **The mechanism, against the real modules.** `ingest-spec` drives the app's
   real `runIngest` and real `isSessionWorkbook` over a session workbook's sheet
   names, and asserts the ORDER that broke: the line is set at `result`, the
   notice is cleared *after* it, and the routing line is **still in the DOM**
   when the notice is gone. The two `<div>`s are the harness's; the ordering is
   the app's.
2. **The render, structurally.** Seven pins on `App.tsx` with comments stripped:
   its own state; the branch sets that state; the old `setIngestNotice` route is
   gone; its own render site; **not gated on the notice**; exactly **three**
   clears, one per ingest path; and the restore banner still HomeTab's.

That is weaker than a mounted `App`, and it is said here rather than dressed
as one. **What neither half proves is the pixels**: that both lines are
visible together on Jon's laptop. That needs a Chrome walk.

**One pin first fired on its own comment**, and it is worth recording because
it is a pin-quality lesson rather than a code one. The "no longer routes through
`setIngestNotice`" check read raw source, and the comment explaining the fix
quotes the old call verbatim — so it went red on documentation. Comments are now
stripped before the pins read `App.tsx`, as `amount-control-spec` already does.
A pin that cannot tell code from prose is a pin on prose.

`ingest-spec` is **53/53**, 42 → 53.

## 4. Trap 224

```
════ TRAP 224 PLANT — a locale string carries a typed 50MB ════
size-copy spec: 25 passed, 3 failed
  FAIL  ZERO-OCCURRENCE: no locale string carries a typed megabyte figure
        [en:up_to_max_mb]
  FAIL  CAPTION en: renders 200, the constant  [absent]
  FAIL  CAPTION en: and no longer says 50
```

Planted by hand against the pre-plant md5 `3cb249c857a31b4fd6c0a7ef5a71b357` of
`src/locales/en/translation.json`, restored from the scratchpad backup, hash
verified identical before and after, 28/28 green again.

**The mutation is the defect as it actually shipped** — "Up to 50MB" in a locale
file, which is what the drop zone said through the entire 200MB build.

**Three assertions fire, by two independent routes.** The structural check names
the offender by locale and key, `en:up_to_max_mb`; the mounted caption catches it
separately by reading the rendered text. Either alone would redden the trap.

**Its target is a locale file, not source — and that exposed a real gap.** The
harness only mutates files listed in `TARGETS`, which it snapshots and restores.
No locale file had ever been a trap target, so `en/translation.json` was not in
it, and **trap 224 would have aborted the gate** with "not in TARGETS". The
existing setup guard said so on the scratch run before the gate; the locale file
is now registered.

## 5. The guard-traps restore

**Not shed.** Item 1 did not spend the budget, so Item 2 was built and proved.

### What actually failed on 2026-09-11 0225

The harness **already had** an outer `finally` that restores every snapshot.
It did not save the tree, and the reason is the whole design of this fix:
**that restore loop threw on the same Windows lock** (`UNKNOWN` / errno -4094 on
`writeFileSync`), and every file after the throwing one stayed planted. A
`finally` that can throw is not a guarantee, it is a first attempt.

### What changed

1. **Per-trap `try / catch / finally`** around plant → run. The restore is in
   the `finally`, attempted even if the plant itself threw, because a partial
   write is exactly the state that must not reach the next trap.
2. **A throw is recorded as CRASHED for that trap, and the run continues.**
   `mutate()` throwing gets its own catch and its own detail. A crashed trap is a
   state, never a catch — `caught` still counts only `CAUGHT`.
3. **`writeResilient`**: four attempts at 0 / 25 / 100 / 225 ms, sleeping with
   `Atomics.wait` because the harness is synchronous and an async pause would let
   the next trap start against a planted file. Bounded, not infinite: a lock that
   outlives ~350 ms is not transient, and the caller's `finally` needs this to
   *return* so it can decide what to say. The last error is rethrown with its
   errno.
4. **If a per-trap restore still fails, the run STOPS** with `FATAL` and exit 2,
   naming the file. Running 200 more traps against a corrupt file would bury the
   one fact that matters.
5. **The outer restore is now per-file**, each in its own `try`, so one locked
   file cannot strand the rest.
6. **`--only=<substring>`** runs a subset by id, so the proof below cost one
   filtered run instead of a second full one. A filtered run prints
   `[FILTERED] … This is NOT a gate run.` on its own line.

### The proof — three scratch traps, one filtered run

```
════ md5 BEFORE ════
3cb249c857a31b4fd6c0a7ef5a71b357 *src/locales/en/translation.json
[FILTERED] --only=SCRATCH-PROOF selected 3 of 223 traps. This is NOT a gate run.
[CRASHED ] SCRATCH-PROOF  the spec throws …  — exited non-zero with NO FAIL line
[CRASHED ] SCRATCH-PROOF2 mutate() itself throws … — mutate() threw before
           anything was planted — deliberate: mutate() exploded after reading
           its anchor
[CAUGHT  ] SCRATCH-PROOF3 a normal trap AFTER the crashes still runs
1/3 caught
════ md5 AFTER ════
3cb249c857a31b4fd6c0a7ef5a71b357 *src/locales/en/translation.json
```

| claim | shown by |
|---|---|
| a spec that throws is CRASHED, file restored | PROOF1 + md5 equal |
| a throw **inside the harness** is CRASHED, not an abort | PROOF2 — the new `catch` |
| **the run continues** past crashed traps | PROOF3 runs and is CAUGHT after two crashes |
| a crash is never counted caught | `1/3 caught` |
| the tree is left clean | md5 before = after |

All three scratch traps and `scripts/throwing-scratch-spec.ts` were removed
before the gate; a copy of the throwing spec stays in the scratchpad.

### What the proof did NOT exercise — declared

- **The lock itself.** errno -4094 cannot be produced on demand, so
  `writeResilient`'s retry has never met a real lock. It is reasoned from the
  0225 stack trace, not observed recovering.
- **A throw from the PLANT write** — the exact 0225 failure point. PROOF2 throws
  from `mutate()`, one step earlier, before anything is written. The per-trap
  `finally` around the plant is therefore proved by construction and by PROOF1's
  restore, not by a write that failed halfway.
- **The FATAL path** (a restore that fails after four attempts). Unexercised for
  the same reason as the lock.
- `exit=0` in the capture is `tail`'s exit code, not the harness's; the harness
  exits 1 whenever a trap is not CAUGHT.

### Three harness defects the proof and its setup surfaced

1. **The CRASHED summary claimed "the mutation landed"** for every crashed trap —
   true when only a spec could crash, false once `mutate()` could, since PROOF2
   planted nothing. Made cause-neutral: "a spec DIED, or the HARNESS itself threw.
   Each line above says which."
2. **No locale file was in `TARGETS`**, so trap 224 would have aborted the gate
   with "not in TARGETS". The existing setup guard said so on the first scratch
   run; `en/translation.json` is now registered.
3. **The positive control refused a scratch trap** whose `mutate()` never read an
   anchor — trap-anchors correctly treats that as a finding. Not loosened: the
   scratch trap was re-aimed to read a real anchor, then throw.

### A correction to the 0742 report's certification

**`spec:d5-05-held` was never registered in the positive control**, although
trap 223 has targeted it since the 0742 session. The control exists so that a
spec red on the unmutated tree cannot let its traps "catch" vacuously — so the
0742 report's **219/219 was not protected against that for trap 223**. It did
not in fact happen: `spec:d5-05-held` was 39/39 in that session's own suite, run
before guard-traps. But the control was not there to prove it, which is the
exact lapse the HOLDSHAPE comment in the harness already records. Found while
registering `SIZECOPY`; `D505HELD` is now registered too, late, with a comment
saying so.

## Gate

| check | figure |
|---|---|
| `npm run suite` | __ PENDING |
| guard-traps | __ PENDING |
| `spec:trap-anchors` | __ PENDING |
| `spec:i18n-parity` | __ PENDING |
| `spec:survival` | __ PENDING |
| `tsc --noEmit` / `lint` | __ PENDING |
| `npm run build` | __ PENDING |

### Exact counts the brief named

| pin | required | measured |
|---|---|---|
| `runIngest` sites | 3 | __ PENDING |
| apply sites | 12 | __ PENDING |
| display markers | 6 | __ PENDING |
| `type="checkbox"` ramp/hold controls | 6 | __ PENDING |
| last-column pins, Market / Yield / Pricing | 3 / 2 / 3 trailing positions | __ PENDING |

## What was shed

**Nothing was shed.** Item 0 (record, committed alone), Item 1 (caption, notice,
routing line, trap 224 — marked NEVER SHED) and Item 2 (the guard-traps restore)
all completed. The brief allowed Item 2 to be shed if Item 1 spent the budget;
it did not, so it was built and proved rather than deferred.

**Added beyond the brief's letter, each forced rather than chosen:** the locale
file registered in `TARGETS` (trap 224 would otherwise have aborted the gate);
`D505HELD` and `SIZECOPY` registered in the positive control (the first closing a
lapse from the 0742 session); the CRASHED summary made cause-neutral; and
`--only=` so the proof cost one filtered run.

**Not done, and named:** a real Windows lock was never produced, so
`writeResilient`'s retry and the FATAL path are reasoned, not observed (§5). The
routing line's on-screen appearance awaits a Chrome walk (Limits).

## Limits

- **The routing line's pixels are unproved.** `App.tsx` cannot be mounted
  headlessly, so "both lines visible after a routed restore" is proved as a
  mechanism against the real `runIngest` plus seven structural pins — not as a
  rendered screen. Jon's next Chrome walk is the check that closes it: drop the
  16:50 save on the input and look for the sky-blue line above the restore
  banner.
- **The 15-second figure is one laptop, two files.** 106.7 MB in 4.7 s and
  197.3 MB in 9.6 s in Chrome on the target machine. "Under 15" has a third of
  margin over the worst measured case; a slower machine could exceed it, and
  the notice would then be optimistic rather than wrong about the freeze.
- **de and it wording is the session's, unreviewed by a native speaker.** So
  are es, fr and pt, which were adapted clause-for-clause from the existing
  sentences rather than written fresh.
- **The ten `50MB` mentions in comments were left.** They are historical notes
  on why the limit moved; they are never rendered and the zero-occurrence check
  reads locale files only, by design.
- **The zero-occurrence rule covers locale files, not JSX literals.** A
  megabyte figure typed straight into a component as text would not be caught
  by `spec:size-copy`. The i18n scan (`spec:i18n-scan`) is what forbids bare
  user-facing English in JSX, so the two together close the class — but that is
  a composition of two checks, not one.
- **`--only=` was added to guard-traps.** It narrows what runs and changes
  nothing about how a trap is judged; a filtered run prints `[FILTERED] … This
  is NOT a gate run.` on its own line so it cannot be quoted as the gate.
