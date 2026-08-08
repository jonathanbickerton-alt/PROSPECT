---
name: artefact-verification
description: Use before reading numbers from, or acting on, any artefact whose claims are not yet checked against the repo — an uploaded save file or fixture, a context document, a design doc, a prior report being reused, or an agent's report. Trigger on "verify this against the repo", "is this still true", "check before we install this as context", or whenever a figure is about to be quoted from something other than a fresh measurement.
---

# Verifying an artefact against the repo

An artefact is anything carrying claims you did not just measure. The job is to
say which of its claims the repo supports, which it contradicts, and which it
cannot speak to — and to leave no fourth category.

## 1. Provenance first — and stop if dirty

```bash
git rev-parse HEAD
git branch --show-current
git diff --quiet HEAD && echo clean || echo DIRTY
```

State all three at the top of the output. **A dirty tree means stop**: you cannot
attribute a measurement to a commit when the working copy is not that commit.

For a *file* artefact (a save, a fixture, an export), also establish what build
produced it, and say so. A file created against a partly-changed build is a
weaker witness than one created against the build it represents, and the file
does not carry that fact with it.

## 2. Classify every claim into exactly three buckets

**[VERIFIED]** — checked and it holds. **Name the instrument**: the command, or
the file and line. "I checked" is not an instrument.

**[CONTRADICTED]** — the repo disagrees. Quote what the repo actually says, and
**propose corrected wording** for the artefact. Do not soften a contradiction
into a footnote or a caveat: a wrong claim in persistent context outlives every
session that reads it.

**Superseded is not wrong.** A historical artefact — a prior report, an older
design doc — states figures that were true at ITS commit. When those disagree
with current HEAD, say CONTRADICTED *and* say which: a claim that was false when
written is a defect in the artefact; one that has merely been overtaken is a
staleness fact about the reader's copy. The correction differs — the first needs
rewording, the second needs a commit attached or a refresh.

**[NOT-CHECKABLE]** — the claim lives outside the repo: chat history, walk
events, screenshots, usage panels, people, product intent, figures measured
elsewhere. **List them; do not guess at them.** A NOT-CHECKABLE claim is not a
failure of the artefact — mixing it into VERIFIED is a failure of the check.

## 3. Negatives name their coverage

Every absence claim states what the instrument covered. "No AI imports in `src/`"
means the grep ran over `src/` — say so, and say what it did not cover.

**An enumeration method is evidence about what it found, never about what it
missed.** Two enumerations in this repo's history silently excluded digits from a
character class and dropped a real match each time. If an enumeration surprises
you, suspect the instrument before the conclusion, and record the corrected
instrument alongside the result.

## 4. Verify claims about the artefact's own subject, not just its prose

If the artefact says a symbol exists, resolve it. If it says a hash is an
ancestor, run `git merge-base --is-ancestor`. If it cites counts, re-run the
suites rather than copying the artefact's numbers back as verification — that is
circular, and it is the single easiest way to certify a stale document.

## 5. End with one verdict line

One of:

- `SAFE TO INSTALL AS CONTEXT` / `SAFE TO USE`
- `INSTALL WITH LISTED CORRECTIONS` — contradictions exist and are enumerated
- `HOLD` — something could not be verified that should have been

**If you cannot verify something you expected to, that is a finding, not a gap to
skip past.**

## Output shape

FOR ADVISOR block (see **report-writing**) carrying: the HEAD verified against,
counts of VERIFIED / CONTRADICTED / NOT-CHECKABLE, **only** the contradicted
claims with their proposed corrections, and the verdict line. The full
classification table follows below the block.

## Checklist

- [ ] HEAD, branch, clean/dirty stated — stopped if dirty
- [ ] Artefact's own provenance established
- [ ] Every claim in exactly one bucket
- [ ] Each VERIFIED names its instrument
- [ ] Each negative names its coverage
- [ ] Each CONTRADICTED quotes the repo and proposes wording
- [ ] NOT-CHECKABLE listed, not guessed
- [ ] Counts re-measured, not copied from the artefact
- [ ] One verdict line
