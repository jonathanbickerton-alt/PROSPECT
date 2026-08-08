# Skills extraction — four procedures out of CLAUDE.md, EXPECTED.md and reports/

## FOR ADVISOR

```
Generated: 2026-08-08 15:58 +0100 (UTC 2026-08-08 14:58)
Verified against: HEAD 7951a02, branch main, tree CLEAN
Created 4 skills: report-writing, session-close, artefact-verification, fixture-handling
Exemplar used for skill 1: reports/2026-08-08-1550-session-m-section-c-close.md
CLAUDE.md diff PROPOSED not applied: 64 lines out (the whole Reporting conventions
  section, 101-164, fully covered by report-writing) + 2 lines out (trimmed-fixture
  rule, covered by fixture-handling). 102 lines retained, all always-on.
  CAVEAT ON THE PROPOSAL: CLAUDE.md always loads; a skill is conditional. Removing
  the convention risks a report written on a turn that never triggers the skill.
  Recommend a 2-line pointer stays. Decision is Jon's — proposal only.
Acceptance 1 PASS: skill's command reproduces the M header format exactly (regex match)
Acceptance 2 PARTIAL: steps 1-6 all map to Session L; STEP 7 DOES NOT — see finding 1
Acceptance 3 PASS: procedure run on the K report produced all three buckets w/ instruments
Acceptance 4 PASS: all six fixture row counts verified against local working copy
FINDING 1: the working-agreement update is NOT in CLAUDE.md (0 mentions) and appears
  in NO session report. The final step of the ritual has never been practised — which
  is exactly why the doc was found two merges stale.
FINDING 2: the FOR ADVISOR hash line has two labels in use — "Certifies:" (sessions)
  vs "Verified against:" (read-only checks). Encoded as-is, not normalised.
FINDING 3: reports before 2026-08-07 use "# FOR ADVISOR" + bold lines, not a fenced
  block; and their Generated lines carry no offset/UTC. Evolution, not drift.
FINDING 4: the fixture NON-tell string is now "(not available in this view)", relabelled
  in Session I. Any source still saying "(not mapped)" describes an older build.
State: skills committed. CLAUDE.md UNCHANGED — the diff is a proposal below.
```

---

## What was created

| skill | triggers on |
|---|---|
| `report-writing` | writing any report to `reports/` |
| `session-close` | running the gate, merging, recording a session |
| `artefact-verification` | reading numbers from any unchecked artefact |
| `fixture-handling` | touching anything in `test-data/` |

All four were extracted from what the repo already practises — CLAUDE.md's
conventions, EXPECTED.md's recorded rules, and the shape of the reports
themselves. Nothing was invented.

## Acceptance

### 1. report-writing — PASS

Ran the skill's timestamp command and compared its output shape against the
actual header of the exemplar, `reports/2026-08-08-1550-session-m-section-c-close.md`:

```
skill command now : 2026-08-08 15:56 +0100 (UTC 2026-08-08 14:56)
actual M header   : Generated: 2026-08-08 15:50 +0100 (UTC 2026-08-08 14:50)
```

The actual header matches the skill's stated format under a strict regex
(`^Generated: \d{4}-\d{2}-\d{2} \d{2}:\d{2} \+\d{4} \(UTC \d{4}-\d{2}-\d{2} \d{2}:\d{2}\)$`)
— match count 1. Only the clock differs, which is correct: time passed.

### 2. session-close — PARTIAL, and the gap is finding 1

Dry-run against the Session L merge (`ec77b34`, record `89f82dd`):

| step | evidence in Session L |
|---|---|
| ui-consistency | named in the report |
| qa-tester | named |
| regression-guard | named, with verdict |
| typecheck | named |
| guard-traps | named with score |
| traps | named |
| i18n | named |
| pinned figures re-measured | MAPEs and 72-of-74 both present |
| EXPECTED.md corrected in place | `ec77b34` touches `test-data/EXPECTED.md` (+111) |
| report written | `reports/2026-08-08-1246-session-l-panel-derives.md` |
| record-the-merge commit | `89f82dd Record the Session L merge and where the walk resumes` |
| **working-agreement document updated** | **absent — 0 mentions** |

Steps 1–6 map cleanly. Step 7 does not, and that is a real finding rather than a
gap in the dry-run — see below.

### 3. artefact-verification — PASS

Ran the procedure against `reports/2026-08-08-1040-session-k-panel-gate.md`:

```
[1] PROVENANCE: HEAD 7951a02, branch main, clean
[2] 'Certifies d4a7f8a ... MERGED'      [VERIFIED] git merge-base --is-ancestor d4a7f8a main
    'spec:step1-panel 24/24 mounted'    [CONTRADICTED] now 38 passed
    'guard-traps 32/32'                 [CONTRADICTED] now 36/36
    'Jon confirmed step 9 on screen'    [NOT-CHECKABLE] walk event
```

All three buckets exercised, each VERIFIED naming its instrument.

**The run improved the skill.** Both CONTRADICTED claims were *true at Session
K's HEAD* — they are superseded, not wrong. Classifying them identically to a
false claim would mislead: one needs rewording, the other needs a commit
attached. A "superseded is not wrong" paragraph was added to the skill as a
result. That is the acceptance doing its job rather than rubber-stamping.

### 4. fixture-handling — PASS

Row counts measured on the **local working copy** — the `.xlsx` files are
untracked (`.gitignore:15`), so these are working-copy measurements, not repo
facts:

| file | measured |
|---|---|
| EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026 | 12,112 |
| Trimmed_TariffHierarchy_Jan2023_Jun2026 | 12,432 |
| ProductL2_Full_Jan2023_Dec2025 | 77,760 |
| ProductL2_Full_Jan2023_Jun2026 | 90,720 |
| TariffHierarchy_Jan2023_Dec2025 | 77,760 |
| TariffHierarchy_Jan2023_Jun2026 | 90,720 |

All match the skill's table. The measurement also confirms a point the skill
makes explicitly: **the Dec2025 and Jun2026 counts do not discriminate between
TariffHierarchy and ProductL2_Full** — both files share a count at each horizon,
so a row count alone identifies the *horizon*, not the *file*.

## The proposed CLAUDE.md diff — NOT APPLIED

### Out: `## Reporting conventions` in full, lines 101–164 (64 lines)

Covered by **report-writing**, which carries the filename convention, the
`HHMM` rationale, the FOR ADVISOR contents and line cap, the exact timestamp
command, the `GMTST` offset caveat, and the Session H fabrication as the reason
the rule exists.

### Out: the trimmed-fixture line, lines 61–62 (2 lines)

> `- Use the trimmed test fixture for routine agent runs. The full 80k-cohort file`
> `  is only needed for pre-merge validation and bulk-generation testing.`

Covered by **fixture-handling** under "Choosing a fixture".

### Retained — 102 lines, all always-on

- **Model routing table, tier-change evidence, escalation rule** (8–48) — applies
  to every subagent dispatch, not a procedure with a trigger.
- **Efficiency rules** minus the two lines above (49–66) — subagent overhead,
  test data by path, scratch scripts to the scratchpad. Always-on.
- **Folding gate checks back into definitions** (67–84) — **retained
  deliberately.** It is gate-adjacent, but I did not encode it in session-close,
  so claiming coverage would be false. It stays until it is either encoded or
  consciously dropped.
- **Reserved decisions** (85–100) — always-on, and explicitly out of scope for
  extraction.
- **Compact instructions** (165–168) — always-on.

### The caveat that matters more than the line count

**CLAUDE.md is loaded on every turn; a skill is conditional on triggering.**
Moving the reporting convention out means a turn that writes a report without
tripping the skill's description loses the convention entirely — and the
convention exists because a fabricated timestamp shipped in a header.

**Recommendation:** if the removal is taken, leave a two-line pointer in
CLAUDE.md — *"Reports follow `reports/<yyyy-mm-dd-HHMM>-<topic>.md` with a FOR
ADVISOR block; see the report-writing skill"* — so the always-on file still
names the obligation even when the skill does not fire. That is a decision for
Jon; nothing has been applied.

## Findings — procedures practised inconsistently

### 1. The final step of the session-close ritual has never been practised

The working-agreement document update appears in **zero** lines of CLAUDE.md
(`grep -ci "working agreement\|development history\|project context"` → 0) and in
**no** session report other than the verification report that examined the
document itself.

The instruction exists only as a bullet *inside the document being updated*. A
ritual step recorded only in its own output is one nobody performing the ritual
will see — which is precisely why the verification found the document two merges
stale, with C-17 listed OPEN after it had been fixed and merged.

**This is why the skill puts it as an explicit FINAL STEP with the
replace-the-context-copy flag.** But the skill is conditional too: if the step is
meant to hold, it belongs in CLAUDE.md as well.

### 2. Two labels for the FOR ADVISOR hash line

`Certifies:` on session reports; `Verified against:` on read-only verification
and diagnosis reports. Both name the commit the numbers were measured against.
The distinction looks deliberate and useful — a session certifies a merge, a
verification certifies nothing — so the skill **encodes both with the rule for
choosing**, rather than normalising one away.

### 3. Two structural forms for the block

Reports before 2026-08-07 use `# FOR ADVISOR` with `**Generated:**` bold lines;
later ones use `## FOR ADVISOR` with a fenced code block, and only the later ones
carry offset + UTC. This is convention *evolution* — the offset amendment landed
in Session I — not drift. The skill names the current form and names the exemplar,
and flags the three pre-HHMM reports as non-templates.

### 4. The fixture NON-tell string is stale in the sources

The challenger label is now **`(not available in this view)`** — relabelled in
Session I, confirmed in `src/locales/en/translation.json`. EXPECTED.md's earlier
narrative and the working-agreement document both still say `(not mapped)`.

The *substance* is unchanged (the label is permanent and never a fixture
fingerprint; the identification that rested on it was retracted). But anything
still quoting the old string is describing an older build, and a walk step told to
look for `(not mapped)` would find nothing. The skill records both strings and
which is current.

## What was not changed

No product code, no spec, no EXPECTED.md lead, and **no change to CLAUDE.md** —
the diff above is a proposal. The only files added are the four `SKILL.md` files.
