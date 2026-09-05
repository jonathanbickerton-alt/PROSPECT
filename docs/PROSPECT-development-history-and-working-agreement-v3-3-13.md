# PROSPECT — Development History & Working Agreement

**Purpose of this document:** persistent context for the PROSPECT Claude project. Every advisor chat reads this before its first turn. Replace this file in project context whenever it is updated — a stale copy silently applied is worse than no copy. The document is ALSO committed to the repo (`docs/`); project context carries only the latest, git holds the lineage. **This document is a MAP. For settled decisions, EXPECTED.md verbatim is the terrain.** **A prior report's claim is a premise for the next brief, not a fact; a guide's claim is the same class; a report's "not reproduced" is not evidence of absence; an observation from two different saves is two observations.** **Every decision this document relies on is written here in full or cited by its EXPECTED.md HEADING.**

**Last updated:** 2026-09-05 (v3.3.13 — folds D5-03 and D5-04; a small delta on v3.3.12, which stands in full except where stated. Chat: Dev 5.) **UAT IS LIVE — opened 2026-09-01, ~two weeks, closing around mid-September; core users work in GERMAN and ITALIAN; native review inside UAT via the users' findings. NO OPEN UAT FINDINGS as at 2026-09-05 20:30.** Last gated state **`2864d60`** — **guard-traps 156/156 (0 CRASHED / MISSED / INCONCLUSIVE)**, **suite 59/59 via `npm run suite`**, view-apply-mounted 124, trap-anchors 167/167, survival 96/25, i18n-parity 194/194, lint and build clean. Provenance: reports 1903, 1950 (2026-09-05); Jon's walks of `ede9b43` and `2864d60` reconciled against screenshots; hashes from reports only.

---

## 1. What PROSPECT is

*As at v3.3.12 §1 in full. Additions (`ede9b43`, `2864d60`):*
- **A promotion is edited from its source (Jon, 2026-09-05, option 1).** The Volume table lists promotion-built rows (unchanged) but its row pencil and its campaign pill route through ONE router (`editEventFromVolumeTable` / `editCampaignFromVolumeTable`): `isPromotion` → switch to the Promotion tab first, then `handleEditPromoStart` / `handleEditPromoCampaign`; otherwise the Volume form. The Volume form is never opened for a promotion-built row (its patch-spread save preserved the arms but zeroed the baked rate, 36 → 0 — measured 1903). The Volume card's campaign pill for a promo campaign previously rendered as a disabled span with no reason; it now routes.
- **Edit-restore of a promotion restores `amountType`** in both edit paths and `resetPromoDraft` clears it (D5-03: one writer, the toggle; a reopened +10% promotion saved back as ten subscribers). All three promo builders now declare `promoAmountMode`, `promoMixLocked` and the dilution pair in their dependency arrays (D3-04's shape).
- `computeTierData` returns `[]` unless a revenue or ARPU COLUMN is named; a mix with zero tiers correctly disables Save (fixture facts, recorded at the spec).

## 2. Working agreement

*As at v3.3.12 §2 in full. Additions:*
- **A pinned "measured, not endorsed" check must go RED before it is re-aimed** — its red line is the signal the decision landed, and it is quoted in the report (1950).
- **Capture every writer** — which writer fires says which editor took the row without spying on a handler.
- **UAT observation log:** through D5-02 as at v3.3.12; **D5-03 CLOSED `ede9b43`** (walked 2026-09-05: % pressed on reopen, save keeps +10%, no leak into a new promotion); **D5-04 CLOSED `2864d60`** (walked 2026-09-05: the Volume pencil lands on the Promotion editor with the arm restored). Re-observation = new diagnosis.

## 3. Settled decisions — do not reopen

*As at v3.3.12 §3 in full.* **Jon, 2026-09-05:** **D5-04 option 1** — recorded in EXPECTED.md beside the D5-04 measurements: a promotion is edited from its source; the Volume table's pencil routes to the Promotion card; the row stays listed. Built `2864d60`.

## 4. Standing rules

*As at v3.3.12 §4 in full. Minted 2026-09-05:*
- **An editor that cannot show what it is editing drops it silently** — one editor per event shape.
- **A disabled control with no reason is a defect of its own** (the campaign pill).
- **A dependency array declares every read, even the ones that happen to work** (three promo builders).

## 5. Development history (condensed)

**Everything through the promotion arc: CLOSED at `e5f1e79`** — v3.3.12 §5.

**D5-03 / D5-04 (2026-09-05, CLOSED at `2864d60`):** *1903* (`ede9b43`: v3.3.12 committed `510eb70`; D5-03 confirmed worse than the screenshot — silent conversion on save and a leak into the next promotion; three faults from one gap, fixed; D5-04 measured — arms preserved, rate zeroed; three options recorded) → *Jon's walk* (D5-03 green) → *1950* (`2864d60`: option 1 built through one router; the pinned check red first; the campaign pill found dead and made to route; traps 159/160) → *Jon's walk* (D5-04 green).

## 6. Current state and what's next — THE RESUME POINT

**Base for the next session: the Repo line of `reports/2026-09-05-1950-d5-04-promo-pencil.md` — `2864d60`.** Report-only drift expected.

**FIRST ACTS OF THE NEXT ADVISOR CHAT (if rotated):** (1) check the UAT log — findings go ahead of everything; (2) confirm the queue.

**THE QUEUE (UAT closing mid-September; findings first; DQ after):**
1. **Further UAT findings** — ahead of everything below.
2. **Promotion-card coverage, small (Sonnet):** the dilution CONTROL driven through the DOM and its gating (`promoDilutionBlockReason`) asserted; the campaign route from the Volume table driven; a walk re-check of KPI precision (a known 0.006 delta reads 0.01). Nothing user-visible changes.
3. **After UAT:** as at v3.3.12 §6 item 4, plus: the tab-active assertion reads a class name (`bg-white`); `via Volume 0` is a writer observation, not a call observation.
4. **DQ** — true-state then build. **After UAT.**

**Product decisions surfaced, awaiting Jon:** as at v3.3.12 (auto-lock-on-drag; stored-aggregate weighting; the mix card's catch-all refusal copy; Step 3/Compare localised month names; "Previsione Standard").

**Standing UAT watches:** as at v3.3.12, plus: the campaign route is built, not driven; one promotion shape drove D5-04 (no dilution arm, no spread).

**An advisor must NOT draft fix sessions for** (closed on main): everything in v3.3.12's list, plus **D5-03 (`ede9b43`)**, **D5-04 (`2864d60`)**.

## 7. Backlog

*As at v3.3.12 §7 in full.* Fixtures: the D5-04 mount carries Retention rows with real value tiers and an ARPU column (the shared props pass `''` for both and cannot produce tiers). Walk saves: unchanged; the 04 Sep 21:37 save (in `Downloads/`) is the D5-03/D5-04 walk subject.

---

*Maintenance: at each session close, the advisor updates this document, commits it to `docs/` (superseded copy removed in the same commit), and Jon replaces the project-context copy (latest only — git holds the lineage).*
