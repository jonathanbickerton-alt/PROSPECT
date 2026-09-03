# PROSPECT — Development History & Working Agreement

**Purpose of this document:** persistent context for the PROSPECT Claude project. Every advisor chat reads this before its first turn. Replace this file in project context whenever it is updated — a stale copy silently applied is worse than no copy. The document is ALSO committed to the repo (`docs/`); project context carries only the latest, git holds the lineage. **This document is a MAP. For settled decisions, EXPECTED.md verbatim is the terrain.** **A prior report's claim is a premise for the next brief, not a fact** — and this arc adds: **a report's "not reproduced" is not evidence of absence** (three sessions measured D2-03 through the engine and none saw it; the browser did).

**Last updated:** 2026-09-03 (v3.3.9 — folds the D2-02/D2-03/D2-04 arc, the 1005 guide addendum, and Jon's 2026-09-02/03 decisions. Chat: Dev 5; uploads arrived intact throughout — the Dev 4 transport failure did not recur.) **UAT IS LIVE — opened 2026-09-01 on curated files, ~TWO WEEKS (Jon, 2026-09-03), so closing around mid-September; core users work in GERMAN and ITALIAN; native review happens INSIDE UAT via the users' own findings, no separate channel (Jon, 2026-09-03).** Last gated state **`051a9b3`** — **guard-traps 126/126**, **55 specs**, mounted mix-card 235/235, view-apply-mounted 30/30, lint and build clean. Provenance: reports 1456, 1556, 1634, 2044 (2026-09-02), 0857 (2026-09-03), 1005 (guide addendum), Jon's two browser walks reconciled screenshot-by-screenshot against the 03 Sep 08:01 save; hashes from reports only.

---

## 1. What PROSPECT is

PROSPECT (Predictive Reporting Of Scenarios & Planned Execution for Commercial Trends) is a React/TypeScript subscriber forecasting application for Vodafone, built entirely through Claude Code — Jon directs, writes no application code himself. Rebuilt around real IBRO data (Inflow, Base, Retention, Outflow).

- Three-step workflow via ForecastContext: Baseline Forecast → Market Events → Actuals Review; plus **Scenario Compare** (up to 4 session files; own parser feeding `computeScenarioForFilter` — **a SECOND ENGINE, blended-ARPU only, the last blended consumer**). Step 2/3 unlock derives from store contents. Top-nav: **Overall Forecast** (cohort table; no chart seam).
- Models: SES, Holt Linear, Damped Trend, true Holt-Winters. Scoring: symmetric absolute percentage deviation + band position.
- **Base volume is never fitted or stored per month** — reconstructed at read time from the seed rolled through flows; `seedBaseKnown` gates; unknown seed declines. **All four per-scenario ARPUs (inflow/outflow/retention/base) ARE fitted and banded on every forecast month.** Base ARPU is real.
- Dimensions: Customer Segment + Product/Channel/Tariff L1/L2; 7-part keys. ScopeDims wildcards; a literal 'All' is a DATA VALUE (never translated — TERMBASE §5) and the wildcard in recorded scopes. **'All' has TWO representations in the app — `null` and the string `'All'` — and `cohortScope` (`WhatIfTab`) hands the engine the string.** Any predicate on a view must accept both; there is ONE such predicate, `eventScopeMatchesView` (`forecasting.ts`), with **seven pinned callers** in the tab (2044).
- **Event carriers — THREE** (`MarketEvent`, `YieldEvent`, `PricingEvent`). Pipeline order by kind: market → yield → pricing.
- **How a market event reaches a view (as at `051a9b3`):** (1) applicability — `eventScopeMatchesView`, target INTERSECTS view, per dim `!dim || dim==='All' || !view || view==='All' || dim===view`; (2) weighting — percentage events by `forecastCoverage` (fitted forecast at the view for the month, from the per-leaf forecasts `resolveFromStore` now returns; `null` never `0` when it cannot answer; real `0` when the target matches no populated leaf; falls back to `eventCoverage`, historical rows, for STORED aggregates), absolute events by `eventProRataShare` (**still conflates cannot-answer with measured-zero — decided, unbuilt, §6 queue item 1**); (3) record — an event with coverage 0 goes to `zeroCoverageEventIds`, not `appliedEventIds`; **three readers** of `appliedEventIds`: the `Applied_Event_IDs` export column, `hasEvent` on chartData (reaches users only via the chart export), the KPI caption. The event-row expander reads the engine's record, never the predicate; two keyed empty states (`whatif_event_not_in_current_view`, `whatif_event_no_coverage_in_view`).
- **The Step-2 chart is a GRID** (`42c55ac`): MEASURE row (Volume / Revenue / ARPU, single-select) × SCENARIO pills (Inflow / Outflow / Retention / Base, multi-select, never none), **baseline SOLID / adjusted DASHED** (verified in source by 1327 and 1005; do not restate from memory). Service revenue is the numerator of ARPU at every grain; aggregate revenue = Σ leaf revenue. Base measures carry the T+1 lag. Per-tab defaults stand (Jon 2026-09-02). Blended ARPU line and "ARPU Outflow (Ref)" retired from display; `chartData` columns persist (29 keys, pinned order); `ARPU (Adjusted)` remains the pricing card's `originalBaseArpu` feed UNTIL Q3/Q4 lands. **The KPI ARPU Delta card is still the blended consumer** — it read +0.00 at view All for an event that moved the leaf +6.97 (UAT-D3-01, routed to Q3/Q4).
- **The pricing card's three surfaces** as at v3.3.6. **Q3 (per-scenario baseline) queued, briefed, not run.**
- **Churn mode (R7)** as at v3.3.6 plus D5-revised and Δ direction-of-effect. **Q1 (hold/revert) queued.**
- **The volume card's ARPU companion is a RATE in both amount modes** (engine and rows correct; a row formatter keyed off the volume's % flag, fixed `a4550bf`, UAT-D2-02). **Decision: the companion gets its OWN mode (absolute rate / % change), independent of the volume mode — queued.**
- **Locales:** six, fully translated (856 keys per locale at `051a9b3`); TERMBASE governs (no "view" row — 0857 used the bundles' precedent: Ansicht / vista / vue / vista / vista); allowlist with reasons; `scan-i18n --check` in the gate. **Its `I18N_PHASE2` and `TRANS_BACKLOG` deferral lists are never checked for staleness** (backlog). Known copy flags for native review: "Base (Basis)" beside "Base (Angepasst)"; "Previsione Standard" capital S; the "view" terminology.
- Business users: Alessandro Russo and Marcel Wiegand. Roadmap: Cloud Run + BigQuery, AI Booster ML, four AI use cases; AISHA event schema.

## 2. Working agreement

- **Two-tier structure:** the advisor drafts prompts and pushes back on wrong premises; Claude Code writes the code. Nearly every turn ends in a pastable prompt. **Sessions are SEQUENTIAL** — a brief drafted while a session runs is pasted after that session's report is reconciled; its base line resolves to that report's Repo line. **Mid-session injections** (a decision the session asks for while its gate runs) are phrased as Jon's dated decision plus an explicit NOT-THIS-SESSION and a report-section request — never a scope change into a running gate.
- **TRANSPORT NOTE:** reports may arrive EMPTY — read `/mnt/user-data/uploads/<name>` directly. Did not recur in Dev 5.
- **Reports**: `reports/<yyyy-mm-dd-HHMM>-<topic>.md`, ≤25-line FOR ADVISOR block, mandatory Repo line; skeleton first; a dead session's skeleton is the diagnostic. **Documentation-only sessions certify no test state** (1005) — the last gated commit is stated, not re-run.
- **Close ritual / stability rule / brief conventions / base-drift convention** as at v3.3.6. **Measured stop-conditions are outcomes** — nine on record (the six at v3.3.8; 1556's refusal to write the reconciliation spec green; 1634's shed of the no-populated-leaf clause before the gate; 0857's deferral of `eventProRataShare` with a measured blast radius).
- **Jon's walks are screenshot-gated at step zero.** **A walk observation is exported before it is reported** — the save plus the screenshots are the artefact; a recreation is a different artefact and is labelled as one (D2-03 cost two sessions to "not the walk's save"). **A walk observation is cleared by a walk, or by a MOUNTED reproduction through the app path** — an engine call that is handed the event cannot see a filter that withholds it. **The advisor reads user-supplied saves directly** (the 03 Sep export's two events were verified from the sheet before verdicts).
- **Agentic QA:** three-stage gate; EXPECTED.md = what was DECIDED, never what is true of the build. Instruments as at v3.3.8 plus **spec:view-apply-mounted** (30 — the class the D2-03 arc lacked: mounts the card, resolves through the real `resolveFromStore`, reads the rendered KPI by testid), **spec:aggregate-reconciliation** (34), **spec:applied-count** (16). **Gate output is captured to a file, never read from a scrolling buffer** (a 123/124 with the one INCONCLUSIVE line scrolled off nearly passed). **INCONCLUSIVE is a distinct state from CAUGHT — read the states, not the ratio**; a trap whose anchor no longer matches plants nothing and ends green (trap 13, re-armed). **One assertion per source check** — a literal spanning two things fails for a reason it cannot name. **Exact counts, never `>=`**; pins raised by a forced change are raised to the new exact number with the reason at the check (mix-card 2→3, pricing-roundtrip 6→7 — both accepted by Jon). **New controls get testids; selectors never match by text.** **Plant a trap by hand and confirm red before trusting it.**
- **UAT observation log** (Jon keeps it; the advisor triages): **D1-01/02 CLOSED `42c55ac`; D2-01 CLOSED `59731fa`; D2-02 CLOSED `a4550bf`; D2-03 CLOSED `0737ebf`** (walked green 2026-09-03 on the 03 Sep 08:01 save, sha1 `56f5e7e0…`, two events, 12,112 rows); **D2-04 CLOSED `051a9b3`** (advisor-found hardcoded literal); **D3-01 OPEN** (ARPU Delta +0.00 at All — routed to Q3/Q4 as a measured check); **REQ-D2-01 OPEN** (Promotion-card parity — Jon still to supply the Dev 4 brief text or a one-line statement); **REQ-D3-01 OPEN** (Alessandro: the Promotion tab's slider padlock on every slider in the Market Events cards, Value's tariff and product mixes first). A re-observation of anything closed is a NEW diagnosis.

## 3. Settled decisions — do not reopen

*(EXPECTED.md verbatim governs. Everything in v3.3.8 §3 stands — bottom-up; carriers; R4/R5; Compare arc; R7; D5-revised; Δ option (a); pricing baseline scope; chart-grid decisions; Q1–Q6; locale decisions.)*

**Jon, 2026-09-02:**
- **Aggregate application of a percentage event — option (i):** the aggregate adjustment equals Σ over targeted populated leaves of (pct × that leaf's fitted forecast for that month); implemented as `forecastCoverage` weighting by the fitted forecast at the view; a leaf with a forecast but no history is covered by its forecast. Absolute events measured unchanged (already leaf-summed). Built `63cc27f`.
- **An event matching no populated leaf is COMMUNICATED and applied nowhere, consistently at every view.** Built for percentage events `051a9b3`.
- **The applied-count caption counts events applied AT THE VIEW.** Built `bd2cf63`.
- **The ARPU companion gets its own mode** (absolute rate / % change), independent of the volume mode. Queued.
- **The three-denominator finding** closes by obsolescence at Q3/Q4 — unchanged.

**Jon, 2026-09-03:**
- **The no-populated-leaf rule covers ABSOLUTE events too.** `eventProRataShare` adopts the coverage contract: `null` (never `0`) when the denominator cannot answer; real `0` when the target matches no populated leaf; the "don't silently drop it" fallback survives only for cannot-answer. Recorded in EXPECTED.md; **UNBUILT — queue item 1.**
- **UAT length ~two weeks; UAT findings take priority over DQ for the fortnight — DQ delivers AFTER UAT** (supersedes the 2026-08-21 "DQ delivers before UAT closes"; Jon to confirm the wording).
- **Native review inside UAT, no separate channel.**
- **Pins raised 2→3 (mix-card) and 6→7 (pricing-roundtrip) accepted.**
- **Stored (fitted) aggregates keep historical weighting** — the `63cc27f` fix reaches DERIVED views only; on the watches, decide after UAT.

**Reconciled, sign-off pending Jon's word:** the 1005 guide addendum (`3c0dcb2`) — six Step-2 subsections, three glossary entries (en 50→53), translated tail SHA-identical. Its §5 "honest note" (Events summary delta and Pricing Baseline ARPU still blended) becomes false at Q3/Q4 — the Q3/Q4 brief carries a guide line item.

## 4. Standing rules (mirrored in EXPECTED.md / agent definitions)

*(The full inherited set stands — v3.3.8 §4 in full.)*

**Minted in the D2-03 arc (2026-09-02/03):**
- **A reproduction hands the engine what the APP hands it** — an engine call with a friendlier representation of the same value (null for 'All') measures a different program.
- **Where a value has two representations, there is one predicate and every caller uses it** — a second copy is retired, never patched into agreement; the inline copy at `WhatIfTab:965` knew one of 'All's two forms and withheld every leaf-scoped event from every broader view.
- **A walk observation is cleared by a walk or a mounted reproduction through the app path, never by an engine call handed the event.**
- **A walk observation is exported before it is reported.**
- **A spec that can only be green on a fixture that hides the defect is not written — its absence is the finding.** Every synthetic fixture whose forecast is proportional to its history hides the coverage divergence; the discriminating fixture asserts its two ratios differ before anything runs.
- **A caption that cannot be wrong cannot be evidence** — `marketEvents.length` printed "1 applied" beside +0.00 and was quoted as corroboration.
- **`null` and `0` are two answers** — "cannot answer" and "measured zero" never share a number; `forecastCoverage` set the contract, `eventProRataShare` still violates it.
- **Blast radius zero across the suite means nothing catches it going in wrong** — a follow-up brings its own fixture.
- **INCONCLUSIVE is a distinct state; read the states, not the ratio; capture gate output to a file.**
- **One assertion per source check.**
- **A record beats a re-derivation** — the expander reads `zeroCoverageEventIds`, not the predicate again; the tooltip's three carriers are not repointed at a market-only record.
- **A scanner's deferral list is an exemption wired to nothing** — `I18N_PHASE2` passed a live literal as DEFERRED; the context-file block one screen away already re-matches its entries (reaffirms "an exemption must be wired to its premise").

## 5. Development history (condensed)

**Everything through the chart-grid and locale arcs: CLOSED** — v3.3.8 §5. Last gated state before this arc was `a766d0b`.

**The guide addendum, English (2026-09-02 10:05, `3c0dcb2`): RECONCILED 2026-09-03** — additive (the guide had never documented the Step-2 chart); line styles verified solid/dashed in source; translated tail byte-identical; no gate (docs only).

**The D2-02/D2-03/D2-04 arc (2026-09-02 → 03, CLOSED at `051a9b3`):** *1456* (`a4550bf`: D2-02 fixed at one cell; D2-03 NOT reproduced at the engine) → *1556* (`bd2cf63`: Jon's 01 Sep save was NOT the walk's; found the coverage/basis divergence — historical rows vs fitted forecast, 17.18% apart, aggregate 14.7% low; caption fixed to count at the view; refused to write the reconciliation spec green) → *1634* (`63cc27f`: on the 02 Sep save, the event was ABSOLUTE (Jon's recreation lost the mode) and reconciled 8000/8000; the percentage variant diverged; `forecastCoverage` weighting by the fitted forecast, `resolveFromStore` returns the leaves it had been discarding; the positive control caught two seam defects — `override-arpu` crashing on a non-optional `resolveForecast` no provider supplies, and the mix-card pin; trap 13 found aged out; exact walked +0.00 still unreproduced) → *Jon's walk on `63cc27f`* (W1/W3/W5/W6 FAIL: +0.00 and "0 applied" at All in the BROWSER for the absolute event the engine applied — the defect was in front of the engine) → *2044* (`0737ebf`: ONE inline copy of `eventScopeMatchesView` at `WhatIfTab:965` tested `!vprodL1`, so only null was 'All'; deleted, shared predicate called; mounted spec reads the rendered KPI; trap 128 reproduces the walk exactly; `:5534` hardcoded English literal found = D2-04) → *Jon's walk on `0737ebf`* (W0–W6 PASS; expander reads Basis 31.84K · 14.8% · In scope 1.5% · Applied +71.46 at All; export 03 Sep 08:01 verified by the advisor from the sheet; **D2-03 CLOSED**; D3-01 logged) → *0857* (`051a9b3`: coverage-0 events leave `appliedEventIds` for `zeroCoverageEventIds`; three readers found; D2-04 keyed as two strings; the scanner had listed the literal in its own deferral list; `eventProRataShare` conflation measured and briefed, deferred on Jon's instruction).

## 6. Current state and what's next — THE RESUME POINT

**Base for the next session: the Repo line of `reports/2026-09-03-0857-zero-coverage-applied.md` — `051a9b3`.** Report-only drift expected.

**FIRST ACTS OF THE NEXT ADVISOR CHAT (if rotated):** (1) confirm Jon's sign-off on 1005 and the DQ-after-UAT wording; (2) get REQ-D2-01's content from Jon; (3) check the UAT log for new findings — they go ahead of everything below except item 1.

**THE QUEUE (two-week UAT, findings first, DQ after):**
1. **`eventProRataShare` contract** — brief is 0857's own section: `null`/`0` split at `forecasting.ts:2853`, the fallback kept for `leaves` empty only; **must bring its own fixture** (an absolute event whose target matches no populated leaf, asserted at a containing view and the leaf — the suite is silent on it); trap: restore the all-or-nothing return → red. Small; Sonnet.
2. **Promotion ↔ Value card parity true-state (read-only)** — REQ-D2-01 + REQ-D3-01 in one inventory, both directions; the shape question is whether the padlock lives in the slider component or is bolted on by the Promotion card; count of slider implementations in the tab; whether lock state persists. Brief drafted in Dev 5's last turns; needs REQ-D2-01's text from Jon.
3. **Pricing per-scenario + blend consumers (Q3/Q4)** — re-derive from §3 Q3/Q4 wording; carries **D3-01** (ARPU Delta at All) as a measured check before and after, and **the guide §5 note** as a line item. Opus.
4. **Padlock build** (from item 2). Product question likely: persist lock state or not.
5. **Further UAT findings** as they land — ahead of everything below.
6. **After UAT:** churn hold/revert (Q1); guide translation pass (unblocked once 1005 is signed off — re-resolve every quoted key per locale from the current bundles, add the six subsections and three glossary entries); ARPU-companion own mode; dual-measure chart (chart-grid session 3); Scenario Compare (last blended consumer, second engine).
7. **DQ** — true-state (read-only; first act records the UAT re-scope AND the DQ-after-UAT decision in EXPECTED.md — still not recorded), then build. **After UAT.**

**Product decisions surfaced, awaiting Jon:** 1005 sign-off (recommended); the DQ-after-UAT wording; stored-aggregate weighting (after UAT); the mix card's catch-all refusal copy; Step 3/Compare localised month names; "Previsione Standard"; padlock persistence (after item 2).

**Standing UAT watches:** manual padlocks; R3 override surface; orphan/drop on real data; absence-path frequency on real data; Revenue-measure axis dominance; French widths and Step 3's table (unmeasured); the pricing absence state and the ramp editor not rendered in de/it; the `<Trans>` fragment backlog; `.detail` laundering; **stored aggregates under percentage events** (diverge — fix reaches derived views only); **absolute ghosts apply at full magnitude until item 1**; **`Applied_Event_IDs` and `hasEvent` export columns changed meaning for zero-coverage events** (compatibility line needed); **a real workbook may reach the `eventProRataShare` fallback where no spec does** (0857 measured the suite, not the app).

**An advisor must NOT draft fix sessions for** (closed on main): everything in v3.3.8's list, plus **D2-02 (`a4550bf`)**, **the caption (`bd2cf63`)**, **the coverage divergence (`63cc27f`)**, **the view filter (`0737ebf`)**, **zero-coverage record and D2-04 (`051a9b3`)**. Re-observation = new diagnosis.

## 7. Backlog

*(As at v3.3.8, plus:)* `I18N_PHASE2`/`TRANS_BACKLOG` staleness re-match in `scan-i18n` (the context-file block's check, applied to the two deferral lists); `ForecastContext.resolveForecast` typed non-optional while a mounted provider omits it (type or harness, one of them lies); the mounted harnesses that supply their own resolver take the historical fallback — the forecast-weighted path is exercised only by the new specs; a TERMBASE row for "view"; export compatibility annotation for the two changed columns; the row expander and tooltip established by source reading, not driven; Base-dominance stated qualitatively in the guide, unmeasured on Jon's data.

- **Fixtures:** as at v3.3.8; `test-data/Walks/` is gitignored at `63cc27f`; walk saves cited by sha1: 01 Sep 23:37 `f24ca5d2…` (absolute, NOT the walk's), 02 Sep 16:33 `1322c3e6…` (absolute, recreated), **03 Sep 08:01 `56f5e7e0…` (absolute + percentage — the D2-03 closing artefact)**. The edge fixture (12,112 rows) pairs with all three.

---

*Maintenance: at each session close, the advisor updates this document (history condensed into §5, state moved through §6, decisions promoted to §3/§4), commits it to `docs/` (superseded copy removed in the same commit), and Jon replaces the project-context copy (latest only — git holds the lineage).*
