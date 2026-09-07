# PROSPECT — Development History & Working Agreement

**Purpose of this document:** persistent context for the PROSPECT Claude project. Every advisor chat reads this before its first turn. Replace this file in project context whenever it is updated — a stale copy silently applied is worse than no copy. The document is ALSO committed to the repo (`docs/`); project context carries only the latest, git holds the lineage. **This document is a MAP. For settled decisions, EXPECTED.md verbatim is the terrain.** **A prior report's claim is a premise for the next brief, not a fact; a guide's claim is the same class; a report's "not reproduced" is not evidence of absence; an observation from two different saves is two observations.** **Every decision this document relies on is written here in full or cited by its EXPECTED.md HEADING.**

**Last updated:** 2026-09-07 (v3.3.14 — folds the promotion-card coverage, D5-05/D5-06, and REQ-D6-01 (per-event on/off) in both halves; a delta on v3.3.13, which stands in full except where stated, as v3.3.13 does on v3.3.12. Chat: Dev 5.) **UAT IS LIVE — opened 2026-09-01, ~two weeks, closing around mid-September; core users work in GERMAN and ITALIAN; native review inside UAT via the users' findings. NO OPEN UAT FINDINGS as at 2026-09-07 09:30.** Last gated state **`bd50f27`** — **guard-traps 167/167 (0 CRASHED / MISSED / INCONCLUSIVE; ids unique by number)**, **suite 60/60 via `npm run suite`**, event-toggle 65, view-apply-mounted 168, trap-anchors 179/179, survival 104/26, i18n-parity 194/194, lint and build clean. Provenance: reports 2031, 2252 (2026-09-05), 2005, 2027, 2128 (2026-09-06); Jon's walk of `bd50f27` (07 Sep 09:13 save) reconciled against screenshots; hashes from reports only.

---

## 1. What PROSPECT is

*As at v3.3.13 §1 (and v3.3.12 §1) in full. Additions:*
- **Per-event on/off (REQ-D6-01, Alessandro, built `fc718bf` + `bd50f27`).** Every carrier extends a shared base with `enabled?: boolean`; **absent means ON** (every pre-existing save reloads unchanged). ONE predicate `isEventOn` (`forecasting.ts`) is the only definition of "off"; it reads BOTH the typed `enabled` and the raw `Enabled` column because Compare's engine holds sheet rows and never calls `marketEventFromRow`. **Exactly 12 apply sites** (8 What-If, 4 Compare) pinned by marker text; **exactly 6 display sites** (tooltip ×3, month markers, retention warnings, churn exclusion set) pinned apart; zero reads of `.enabled` elsewhere. The pricing self-exclusion needed no change (it routes through `computeAdjustedForecast`). `Enabled` appended LAST on all three sheets, `'Yes'/'No'`, reader `=== 'No' ? false : true`. ONE `EventOnOffSwitch` (`role="switch"`, `aria-checked`, `mixed`), rendered first in the events summary row and in all four card tables (four insertions of one component); off rows greyed by `OFF_ROW`, written once; a promotion's two rows share one field; the campaign pill carries one switch on the group's first row — on/off sets every row through `handleSetEventEnabled` (exactly 5 invocations pinned), mixed renders `aria-checked="mixed"` and a click on mixed turns the campaign ON; switching is not editing, so the percentage-campaign bar does not block it. The summary bar's badge counts events that are on; the KPI caption counts applied (site 1 propagates); the Metadata sheet counts all rows. Compare drops at its engine, so its panel lists an off event greyed via the shared table's read-only mode. The term is "on"/"off", never "scenario".
- **D5-05 (`cb09643`):** a campaign containing a percentage row stays group-edit-barred (the ramp reverse-engineering sums volumes); its rows are editable one at a time; both campaign pills render the existing reason `whatif_campaign_decline_percentage` as TEXT with `aria-disabled` (it had been a `title` attribute only). A row edit writes exactly one row by id. The two pills remain byte-identical JSX (trap 163 on the Volume copy only). **D5-06:** the dilution effect line renders the incomplete and out-of-range reasons distinctly (existing keys; asserted en and de).
- **Coverage (`e177d62`):** the dilution control driven end to end with a non-zero guard in front of the ratio check; the campaign route driven on an absolute campaign (percentage campaigns are barred from group edit by rule); the KPI precision string pinned (`"+0.01"`).
- **The trap registry:** not ordered by id; `spec:trap-anchors` prints `next free trap id` (max + 1) and asserts ids unique BY NUMBER (a duplicated number planted correctly, reported under another trap's label, and would inherit its `KNOWN_NON_UNIQUE` exemption — 2027's four traps were duplicates of 144–147, renumbered 166–169).

## 2. Working agreement

*As at v3.3.13 §2 in full. Additions:*
- **A check reports; it does not guard** — a `check(rows.length === 2)` in front of `rows[0]` still throws on an empty array (survival caught the session that wrote it, twice running).
- **A check that has not been seen red has not been seen** — the first id-uniqueness check passed on a planted duplicate.
- **Measure an event with an instrument it can move** — an ARPU-only event read by a volume delta reports "nothing happened".
- **A collapsed panel is fixture, not evidence** — open it before asserting its rows.
- **UAT observation log:** through D5-04 as at v3.3.13; **D5-05 CLOSED `cb09643`** (user-raised; Jon's en walk shows the reason as text — the de/it native read is a watch); **D5-06 CLOSED `cb09643`**; **REQ-D6-01 CLOSED `bd50f27`** (walked 2026-09-07: switch off/on from summary and cards, campaign off then mixed, export/reload keeps the state, +8.22K / 4 applied with a five-row campaign off). Re-observation = new diagnosis.

## 3. Settled decisions — do not reopen

*As at v3.3.13 §3 in full.* **Jon, 2026-09-05:** D5-05 (bar stands, rows editable, reason rendered) and D5-06 (distinct reasons) — recorded `8e79708`. **Jon, 2026-09-06:** **REQ-D6-01 — PER-EVENT ON/OFF**, one entry, eight decisions as written in §1 above (independent switches, not radios; summary AND card tables; export with `Enabled`; campaign switch; Compare respects the flag at the engine; "on/off" not "scenario"; badge counts on / caption counts applied / Metadata counts rows; tooltip, markers and warnings exclude off events; `enabled?: boolean`, absent = true) — recorded `a23d8bf`.

## 4. Standing rules

*As at v3.3.13 §4 in full. Minted 2026-09-05/07:* the four in §2 above, plus **an id is unique by the part that keys other checks**, and **a title attribute is not a rendered reason** (D5-05).

## 5. Development history (condensed)

**Everything through D5-04: CLOSED at `2864d60`** — v3.3.13 §5.

**Coverage, D5-05/06, REQ-D6-01 (2026-09-05 → 07, CLOSED at `bd50f27`):** *2031* (`e177d62`: dilution control and campaign route driven; the vacuous `arpu 0` ratio check caught) → *2252* (`cb09643`: the pill's reason was a `title` only; rendered as text; row edit writes one row; D5-06 en+de; survival caught its own three unguarded sites) → *2005* (read-only inventory: 12 apply / 14 display / 2 grouping / 9 persistence / ~20 mutation; five renderers, one shared; Compare holds raw rows) → *2027* (`fc718bf`: predicate, pins, columns, summary switch, Compare at the engine, round trip; four traps mis-numbered) → *2128* (`bd50f27`: duplicates confirmed and renumbered; the id check written, seen red; four card switches; campaign switch with mixed) → *Jon's walk* (REQ-D6-01 green).

## 6. Current state and what's next — THE RESUME POINT

**Base for the next session: the Repo line of `reports/2026-09-06-2128-event-toggle-tables.md` — `bd50f27`.** Report-only drift expected.

**FIRST ACTS OF THE NEXT ADVISOR CHAT (if rotated):** (1) check the UAT log — findings go ahead of everything; (2) confirm the queue.

**THE QUEUE (UAT closing ~15 Sep; findings first; DQ after):**
1. **Further UAT findings** — ahead of everything below. Alessandro's own use of on/off is the real test of REQ-D6-01.
2. **Hold.** No pre-close build is queued; the advisor waits for findings or the close.
3. **After UAT:** as at v3.3.13 §6 item 3, plus: the two byte-identical campaign pills → one component; the three inline amount-mode controls; `EventOnOffSwitch.tsx` into TARGETS with a trap of its own; the campaign switch driven on the Volume card's pill as well as the Promotion card's; the de/it native read of the D5-05 reason; the `Enabled` column's effect on an OLD app version opening a new file (it will apply off events — a compatibility note in the guide); the guide's Step-2 addendum gains on/off, D5-05's reason, and percentage promotions.
4. **DQ** — true-state (first act records the UAT re-scope and DQ-after-UAT in EXPECTED.md), then build. **After UAT.**

**Product decisions surfaced, awaiting Jon:** as at v3.3.13, plus: **main is
under the AI-approval hold; the `ai-capability` branch is preserved and must
not reach main; enforcement moves to `spec:ai-hold` (queued)** (Jon,
2026-09-07 — the hold stands; EXPECTED.md §33 "AI capability — hard gate").

**Standing UAT watches:** as at v3.3.13, plus: `EventOnOffSwitch` has no trap of its own; the campaign switch is driven on one card's pill; the summary panel is collapsed by default (a user must open it to see the switches — Alessandro's first reaction will say whether that is a finding).

**An advisor must NOT draft fix sessions for** (closed on main): everything in v3.3.13's list, plus **D5-05/D5-06 (`cb09643`)**, **REQ-D6-01 (`fc718bf`, `bd50f27`)**.

## 7. Backlog

*As at v3.3.13 §7 in full, plus:* the id/anchor registry ordering; `spec:survival` counts quoted anchor text as dereferences (4 in `guard-traps.ts`); the `Enabled` column and old app versions. Walk saves: **07 Sep 09:13** (four events on, a five-row campaign off — the REQ-D6-01 walk artefact; in `Downloads/`; sha1 unrecorded).

---

*Maintenance: at each session close, the advisor updates this document, commits it to `docs/` (superseded copy removed in the same commit), and Jon replaces the project-context copy (latest only — git holds the lineage).*
