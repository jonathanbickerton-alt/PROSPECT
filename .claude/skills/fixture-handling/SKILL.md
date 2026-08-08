---
name: fixture-handling
description: Use when touching anything in test-data/ — identifying which fixture is loaded, adding or regenerating one, choosing a fixture for a spec, or interpreting a row count. Trigger on "which fixture is this", "regenerate the fixture", "add a fixture", "the trimmed file", "the edge fixture", or when a walk step turns on identifying the loaded file.
---

# Working with fixtures

## Identifying which fixture is loaded

**Row counts are the primary tell.** Measured on the local working copy (the
`.xlsx` files are untracked, so these are working-copy measurements, not repo
facts):

| fixture | data rows |
|---|---|
| edge (`EdgeCases_ShortHistory_PerScenarioARPU_Jan2023_Jun2026`) | **12,112** |
| `Trimmed_TariffHierarchy_Jan2023_Jun2026` | **12,432** |
| `TariffHierarchy` / `ProductL2_Full` — **Dec2025** | **77,760** |
| `TariffHierarchy` / `ProductL2_Full` — **Jun2026** | **90,720** |

Note the Dec2025 and Jun2026 counts do **not** discriminate between
TariffHierarchy and ProductL2_Full — both files at a given horizon share a count.

**Other reliable tells:**
- the **Tariff FILTER dropdown's populated values** — present on TariffHierarchy,
  absent otherwise;
- **`Avg_Unit_Price_GBP` is 0.00 throughout `ProductL2_Full`**.

**The explicit NON-tell:** the challenger tab's unavailable-dimension label —
currently `(not available in this view)`, formerly `(not mapped)` — is
**permanent**. It reflects a dimension genuinely unavailable in that view, not
which file is loaded. It has been used as a fingerprint and the identification
was retracted; do not reach for it again.

<!-- The string changed in Session I. Anything still saying the tell is
     "(not mapped)" is describing an older build. -->

## Fixtures are untracked; builders are not

`.gitignore:15` — `/test-data/*.xlsx`. This is deliberate: the files are large
and regenerable.

- `scripts/build-trimmed-fixture.mjs` is **committed and deterministic** (no
  `Math.random`).
- **Regeneration goes through the builder. Never hand-edit an .xlsx.** A
  hand-edited fixture is unreproducible, and its provenance dies with the
  session that edited it.
- The edge fixture's synthetic-source generator is **not in this repo** — it
  lives on Jon's work laptop. Regenerating the edge fixture is a request to Jon,
  not a local operation.

## A fixture arriving under a new name gets its provenance recorded

Name, what produced it, which build, what it is for, and what it is expected to
contain — recorded in `test-data/EXPECTED.md` at the time it arrives. A fixture
whose provenance is only in a chat transcript is unusable three sessions later.

**Never silently replace a fixture's contents under an existing name.** A file
that changes under a stable name makes every earlier measurement citing it
unfalsifiable.

## Choosing a fixture

- **Routine agent and spec runs: the trimmed fixture.** Reserve the full
  80k-cohort files for pre-merge validation and bulk-generation testing.
- **ARPU work: the edge fixture.** It is the ARPU baseline — 74 leaves, 2
  deliberately short leaves, per-scenario price *drift*, and an asserted ARPU
  MAPE spread of ≥0.5pp.

## The scale-invariance trap

**A level-only price factor cannot move MAPE.** MAPE is scale-invariant:
multiply a scenario's price by k and both the actual and the fitted scale
together, leaving the percentage unchanged. A fixture built with level-only price
differences produces four ARPU MAPEs agreeing to five decimal places — which
looks like a working test and measures nothing.

**Per-scenario ARPU tests require price DRIFT** — a factor that changes over
time. The edge fixture asserts a spread exceeding 0.5pp precisely so the
level-only variant cannot return silently.

Earlier uniform-ARPU fixtures made per-scenario ARPU tests vacuous. If an ARPU
spec passes on a fixture without drift, suspect the fixture before the code.

## Checklist

- [ ] Fixture identified by row count, not by the challenger label
- [ ] Working-copy measurements named as such
- [ ] Regeneration via the committed builder, never a hand edit
- [ ] New fixture's provenance recorded in EXPECTED.md
- [ ] Existing name never silently repointed
- [ ] Trimmed fixture for routine runs; edge fixture for ARPU
- [ ] ARPU fixture has price drift, not a level factor
