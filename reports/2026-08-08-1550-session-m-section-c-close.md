# Session M — closing section C

## FOR ADVISOR

```
Generated: 2026-08-08 15:50 +0100 (UTC 2026-08-08 14:50)
Certifies: f04ec6f (merge of session-m-section-c-close at d4fc057) — MERGED
FINDING CANDIDATE RESOLVED — the zero MAPE cards are CORRECT, measured on the artefact:
  save's actuals 2023-01..2025-12 (77,760 rows = pristine Dec2025 fixture, identical count)
  save's forecast horizon 2026-01..2027-12 — forecast months WITH actuals: ZERO
  round trip checked not assumed: imported actuals append, export writes, restore reads
  so the earlier solid ~15K line came from a session THIS artefact does not represent
  scope: this artefact only. A different save would reopen it and must be supplied.
F1 CLOSED as unreproduced-with-tripwire — four navigation sequences, mounted, all green
  the spec states its own scope: those four orders, this store, columns mapped
  on recurrence CAPTURE THE EXACT NAVIGATION SEQUENCE SINCE RELOAD — the one input it lacks
Trap 36 exposed the tripwire modelling the effect instead of driving it: all four
  sequences stayed green under a broken effect. forecastForView extracted; now they die.
Trap 37 missed on a population that could not express the defect (segment-only key)
Trap 37's catch rests on ONE assertion — marked load-bearing at the check, not in a report
C-19 recorded as a DQ-phase requirement; no new surface, Step 1's notice rejected with reason
Writer pin: 7 setForecastData sites classified; 4 dead for the panel, NOT deleted
setBaseForecast enumeration 12 -> 11, the collapsed site classified by its own text
Decisions needed: none
State: MERGED. Section C CLOSED. Walk resumes at section D.
```

---

## The finding candidate — resolved on the artefact

Jon's fact pair: on `d4a7f8a` Actuals Review drew a solid actual series (~15K flat)
inside the forecast window; on `89f82dd` after restore it draws forecast series
only, with all eight cards at "0 cohort-months compared".

**Measured, not inferred:**

| | measured |
|---|---|
| save's `Actuals` sheet | **77,760 rows**, 2023-01 → 2025-12 |
| pristine Dec2025 TariffHierarchy fixture | **77,760 rows** — identical count |
| save's forecast horizon | **2026-01 → 2027-12**, 24 months |
| forecast months that have actuals | **0** |

`comparisonRows` iterates `baseForecast.months` and looks up
`actualsAggrMap.get(bm.month)`; `monthsWithActuals` counts rows where
`actual !== null`. With zero month intersection, **zero is the arithmetically
correct answer**, and the absent actual series is correct too.

**The round trip is not at fault, and I checked rather than assumed it.** Imported
actuals append to `data` (`App.tsx:405`), export writes the `Actuals` sheet from
`data` (`:427`), restore reads it back (`:770`) — they *would* survive a save.
This save contains exactly the pristine fixture, so none were imported in the
session that produced it.

**So what drew the earlier line.** That session had actuals inside the forecast
window — separately imported, or a different file — and it is not the session
this artefact represents. **Scope: the 07 Aug 10:26 save only.** If the `d4a7f8a`
screens came from a different session, the finding is open against *that*
artefact and needs it supplied. I am not generalising from one file.

## F1 — closed as unreproduced, with a tripwire that bites

It did not reproduce by diagnosis (L's diff touches neither `ForecastVsActualsTab`
nor `ForecastContext`; no hunk covers restore; L *removed* a `setBaseForecast(null)`)
and did not reproduce under the controlled protocol. One candidate survived:
**navigation order**.

`spec:step3-transition` encodes four sequences as mounted transitions — restore →
Step 3; restore → Step 1 → Step 3; restore → Step 1 → selection change → Step 3;
restore → Step 3 → Step 1 → Step 3 — each mounting the real tab, with a positive
control proving the never-generated message reachable on an empty store. All
green.

**The spec states its own limits** so a later reader cannot upgrade them: green
proves those four orders do not produce the defect, on this store, with columns
mapped. It does not prove the defect impossible.

### What the traps found that review did not

- **Trap 36 exposed the tripwire modelling the effect.** The first version
  reimplemented the tab-switch body in the spec, so breaking the *real* effect
  left **all four sequences green** — only a structural source check noticed. A
  tripwire that cannot see the thing it watches is the defect it exists to catch.
  `forecastForView` now holds that body, App delegates, and the retargeted trap
  kills 8 of 17 checks including every sequence.
- **Trap 37 missed on a population that could not express the defect.** The
  sequences used a segment-only key, where `product` is already `'All'`, so the
  product arm of the round trip was never exercised. Now partially specified,
  matching Jon's real `Is_Active` cohort.
- **Trap 37's catch rests on one assertion.** The gate measured that the four
  sequences stay green under a broken round trip — the store's aggregation still
  resolves the malformed key. That assertion is now marked load-bearing **at the
  check**, because that is where someone about to prune it as redundant will be
  looking.

Two extractions were required to make any of this honest: `filterToKey` /
`cohortToFilter`, then `forecastForView`. Both are verbatim moves; stage 1
verified semantic identity against `main`'s inline bodies.

## C-19 — recorded, not implemented

`bulk_complete_retired` renders in exactly one place: `BulkGenerateModal:443`,
inside the complete panel, reachable only from `handleConfirm`. It has never
appeared in `App.tsx` in any commit that touches it. Restore never opens that
modal, so the statement has never shown after a restore — the case where it
matters most.

Per the surface decision: **no new surface this phase.** The statement is a fact
about the session's store, and its home is the DQ phase's always-present "How
your data was read" line: *"N stored aggregate fits are retired; aggregates
derive from their leaves."* Recorded in EXPECTED.md with C-19 as provenance, with
the requirement that the count derives from what the store **contains**, not from
which path populated the screen.

**Step 1's notice surface was rejected, and the reason is kept:** Session J
clears it on every selection change, so a session-level fact would vanish on the
first filter click.

## The writer pin

Seven `setForecastData` sites, classified by enclosing function: `handleFileUpload`
(1), `onSelectCohort` (1), `generateStandardForecast` (5 — three compare-mode
branches plus the legacy multi-combo and single-cohort writes). **Four are dead
for the panel**, which derives outside compare mode. They are **not** deleted:
that is a behaviour change to compare entry/exit and `onSelectCohort`, backlogged
separately. Trap 38 confirms an eighth site fails the pin.

The `setBaseForecast` enumeration moved 12 → 11 as the two inline tab-restore
arms collapsed into one delegating call. That site is classified **by its own
text** — attributing it to the nearest named const would have given it a reason
untrue of it, which is what the table was rewritten to prevent.

## Gate

- **ui-consistency** — confirmed the no-UI-change claim by measurement:
  `git diff -- src/components/` and `-- src/locales/` both empty, every App hunk a
  delegation or import, and the three extracted functions semantically identical
  to their inline precursors.
- **qa-tester** — planted all three traps itself rather than trusting the harness,
  and measured that trap 37's catch is narrower than trap 36's. That measurement
  produced the load-bearing marker.
- **regression-guard** — **SAFE FOR USER TESTING**, having **mounted both tabs**:
  the four Step 3 sequences plus the empty-store control, and Step 1's
  section-A and C-17 checks. It re-measured the save artefact independently and
  reached the same zero-overlap conclusion. It also flagged honestly that it could
  not find literal "A8/A9/A10" headings in the repo and named what it mounted
  instead — a citation gap reported rather than papered over.
- 24 spec suites green (`step3-transition` 17/17, `walk-fixes` 81/81,
  `import-seam` 31/31, `step1-panel` 38/38 untouched), `guard-traps` 36/36 with
  36–38 caught, `traps` 3/3, typecheck 0, build clean, i18n clean, scoped no-AI
  confirmed.

**Figures re-measured, not quoted:** ARPU MAPEs 13.8845 / 13.4315 / 14.3888 /
13.0192; leaf-grain 72 of 74; generate-missing 74 leaves, 72 fit, 2 unfittable.

## Where the walk stands

**Section C is CLOSED.** Both findings resolved: C-17's second half as
unreproduced-with-tripwire, C-19 as a recorded DQ-phase requirement. The MAPE
cards are correct at zero on this artefact.

**The walk resumes at section D** (the Step 1 chart), then E (copy). Both stand as
written in the Session I report and are untouched by this diff.

**On recurrence of the Step 3 inversion, capture the exact navigation sequence
since reload.** That is the one input the tripwire cannot supply itself, and the
four sequences it already covers are listed above — a fifth order is the thing
worth knowing.
