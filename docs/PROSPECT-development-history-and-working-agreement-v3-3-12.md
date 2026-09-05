# PROSPECT — Development History & Working Agreement

**Purpose of this document:** persistent context for the PROSPECT Claude project. Every advisor chat reads this before its first turn. Replace this file in project context whenever it is updated — a stale copy silently applied is worse than no copy. The document is ALSO committed to the repo (`docs/`); project context carries only the latest, git holds the lineage. **This document is a MAP. For settled decisions, EXPECTED.md verbatim is the terrain.** **A prior report's claim is a premise for the next brief, not a fact; a guide's claim is the same class; a report's "not reproduced" is not evidence of absence; an observation from two different saves is two observations** (D5-02 was withdrawn: the advisor compared a save without the yield event to one with it). **Every decision this document relies on is written here in full or cited by its EXPECTED.md HEADING.**

**Last updated:** 2026-09-05 (v3.3.12 — folds the promotion percentage (both halves), promo Dilution, D5-01, the D5-02 withdrawal, the yield-pool verification, KPI precision, and the committed suite runner. Chat: Dev 5; uploads intact throughout.) **UAT IS LIVE — opened 2026-09-01, ~two weeks, closing around mid-September; core users work in GERMAN and ITALIAN; native review inside UAT via the users' findings.** Last gated state **`e5f1e79`** — **guard-traps 153/153 (0 CRASHED / MISSED / INCONCLUSIVE)**, **suite 59/59 via `npm run suite`**, view-apply-mounted 108, event-roundtrip 117, events-summary 49, trap-anchors 164/164, i18n-parity 194/194, lint and build clean. Provenance: reports 1526, 2003, 2138 (2026-09-04), 0747, 1602 (2026-09-05); Jon's walk of `945d648` reconciled against screenshots; hashes from reports only.

---

## 1. What PROSPECT is

PROSPECT (Predictive Reporting Of Scenarios & Planned Execution for Commercial Trends) is a React/TypeScript subscriber forecasting application for Vodafone, built entirely through Claude Code — Jon directs, writes no application code himself. Rebuilt around real IBRO data (Inflow, Base, Retention, Outflow).

- Three-step workflow via ForecastContext: Baseline Forecast → Market Events → Actuals Review; plus **Scenario Compare** (up to 4 session files; own parser feeding `computeScenarioForFilter` — a SECOND ENGINE with the only blended-ARPU computation left). Top-nav: **Overall Forecast**.
- Models: SES, Holt Linear, Damped Trend, true Holt-Winters. Scoring: symmetric absolute percentage deviation + band position.
- **Base volume is never fitted or stored per month** — reconstructed at read time from the seed rolled through flows. **All four per-scenario ARPUs are fitted and banded on every forecast month.**
- Dimensions: Customer Segment + Product/Channel/Tariff L1/L2; 7-part keys. 'All' is a DATA VALUE with TWO representations (`null`, the string `'All'`); ONE predicate `eventScopeMatchesView` (11 + 4 pinned callers; structural zero-occurrence check on the hand-rolled shape).
- **Event carriers — THREE** (`MarketEvent`, `YieldEvent`, `PricingEvent`); pipeline market → yield → pricing. **A promotion is a `MarketEvent`** built by `buildPromoEvents`; its price change is **baked into its own `arpu` at build time** and it never enters the pricing pass (Jon, 2026-09-05: stays baked; duration NOT built — a Recurring control would be a stored mode nothing reads; the spread is the promotion's multi-month mechanism).
- **How a market event reaches a view (as at `2ecdefb`, unchanged):** applicability by the shared predicate; weighting by `forecastCoverage` (percentage) / `eventProRataShare` (absolute) under the null/0 contract; coverage-0 → `zeroCoverageEventIds`.
- **Pools feed the ARPU of their own scenario (`2ecdefb`):** Inflow pool → Inflow ARPU; **re-banded Retention pool → Base at T+1 ONLY** (Retention ARPU is built by `scenarioPools`, which never reads `p_eventPools` — paid for three times, now in EXPECTED.md); the synthetic yield pool is built from the PREVIOUS month's inflow and feeds Base via the lag (**verified by hand `e5f1e79`**: Base ARPU Δ = Σ delivered size × (rate − baseArpu) / stock, at T+1, T+2 and All). ONE pool arithmetic since `d92fdaa` — the promoRebanded pool sized by `resolvedEventVolume(…, 'retention')` at `idx` (this was NOT done at `2ecdefb`, contrary to v3.3.11 §1).
- **Percentage promotions (`d92fdaa`, `945d648`):** `buildPromoEvents` takes `amountType`; for a percentage, `revenue` is 0 (a magnitude cannot survive) and `arpu` is baked (a rate survives) — the same rule `draftEventRate` already encoded; `percentageBasis: 'baseline'`; Inflow basis = the view's fitted inflow, Retention basis = the view's fitted retention for the month, both through the ordinary market-event path (a +10% promotion moves a view exactly as a +10% plain event — pinned). **The mix carries NO per-tier volumes** — it is a pricing device, one blended rate; the pool is sized from the resolved delta and priced at the mix blend. Round-trips through `Amount_Type` / `Percentage_Basis`; a promo row without `Amount_Type` loads as absolute. **The unit control on the promotion arm is a third inline copy** (three amount-mode controls, none shared; trap 122 is global(2) over the shared label expression). Volume % and price % are lexically separated (keys `whatif_promo_volume_pct_label/_help`).
- **Promo Dilution (`90e2162`):** `promoPricingMode` gains `'dilution'` riding the percentage arm through `dilutionAmountPct` (ONE function, 8 call sites); equality with the Pricing card pinned to 1e-9 three ways; columns `Promo_Dilution_Current_Pct/_Target_Pct` appended; no Target / Applies-to (decisions 4/5); applied once at build — cannot compound (unstated on screen). The promotion got its own block predicate rather than a third caller of `pricingDraftBlockReason`.
- **Display:** `eventVolumeLabel` owns the percentage form of a stored volume on three surfaces (`+10%`); absolute stays per-caller; the Volume tab's `fmtDelta` (`+10.0%`) is a remaining duplication. **The KPI ARPU Delta card subtracts UNROUNDED figures and rounds once** (`e5f1e79`); the 2dp `chartData` columns are untouched.
- **The mix controls** as at v3.3.11 §1 (`MixSliderRow`, `MixTargetPanel`, `MixPctBox`, locks persist, `rebalanceToTarget`, the wall, minimum change, exactly-determined).
- **The Step-2 chart, the four-delta KPI card, the per-scenario pricing baseline, R7, the ARPU companion** — as at v3.3.11.
- **Locales:** six, parity 194/194 (`I18N_PHASE2`/`TRANS_BACKLOG` never re-matched; `.ts`/`.tsx` asymmetry — backlog). No `strictNullChecks` (backlog).
- **The gate (as at `e5f1e79`):** `guard-traps` CAUGHT / MISSED / INCONCLUSIVE / CRASHED with its own controls; global-mutation class; `spec:trap-anchors`; **`npm run suite`** — serial, each spec captured to a file, GREEN / FAILED / CRASHED by report-line sentinel, guard-traps a separate step; **`spec:survival`** baselines first-row dereferences per file (91 over 24 files), exact both ways, comments stripped.
- Business users: Alessandro Russo and Marcel Wiegand. Roadmap: Cloud Run + BigQuery, AI Booster ML, four AI use cases; AISHA event schema.

## 2. Working agreement

*As at v3.3.11 §2 in full. Additions:*
- **The event list in a brief is read from the FILE, not from memory of the walk** (0747's brief omitted the save's fourth event and mis-stated the third's presence in the earlier save).
- **A reproduction fixture asserts it can discriminate before a result is read from it** — percentage on a basis of 100 (2003), constant inflow for a previous-month pool (1602), a table not in the DOM until its tab is clicked (0747), a target at exactly 20 for a rounding test (1602).
- **Guard-traps output goes to a FILE and per-trap lines are quoted** — never through `tail` (2003 relied on the exit code).
- **"Full suite" is `npm run suite`'s figure** from `e5f1e79`.
- **UAT observation log:** through D4-03 as at v3.3.11; **D5-01 CLOSED `6802cba`** (unit missing on the promotion table and summary); **D5-02 WITHDRAWN** (the sign of Base ARPU Δ at All is the yield event's −0.27, verified `e5f1e79`; the promotions contribute ~0.001); **D5-03 OPEN, to confirm** (edit-restore of a percentage promotion shows the unit control on Subs — Jon's 05 Sep screenshot; unconfirmed whether the toggle was touched); **D5-04 OPEN, measure** (a promotion is editable from the Volume card's events table as a plain market event — what save from there does to its arms is unmeasured). **REQ-D3-01 built and walked. Decision 6 (percentage promotion) BUILT `945d648`, walked `945d648`. Decision 3 (Dilution) BUILT `90e2162`.** REQ-D3-02 backlog. Re-observation = new diagnosis.

## 3. Settled decisions — do not reopen

*As at v3.3.11 §3 in full (cite by heading; the record audit of 2026-09-03; the never-re-propose list under its heading; "percentage on Custom Promotion" is DECLINED-UNTIL-THE-ORDER-IS-DONE and the order is now done — status recorded beside the 2026-08-02 entry as REOPENED 2026-09-03, BUILT 2026-09-04).*

**Jon, 2026-09-05:**
- **A promotion's price change stays baked into its ARPU (option a).** Duration on the promotion pricing arm is not built; revisit with REQ-D3-02 after UAT. Recorded beside decision 3.
- **The ARPU Delta card subtracts then rounds** — built `e5f1e79`.

## 4. Standing rules

*As at v3.3.11 §4 in full. Minted 2026-09-04/05:*
- **A magnitude cannot survive a percentage; a rate can** — revenue goes to 0, ARPU is baked (`draftEventRate` already said so).
- **A pool is observable only where it feeds** — assert a pool's size where it reaches the screen (the re-banded pool: Base at T+1), never where a sibling construction happens to agree.
- **A mechanism that exonerates the suspect is a finding, not a licence to build** (0747 built nothing under an item that said "fix").
- **A claim about "the same events" is checked against the file's event list** before it enters a brief.
- **A spec that prints no report line has said nothing** — the suite runner's CRASHED state.
- **Recount, don't carry** — a baseline count is measured at the commit it pins (91, not the earlier 87).

## 5. Development history (condensed)

**Everything through D4-03: CLOSED at `670c7c3`** — v3.3.11 §5.

**The promotion arc (2026-09-04 → 05, CLOSED at `e5f1e79`):** *1526* (`d92fdaa`: v3.3.11 committed `1c1f224`; step 2 was NOT done at `2ecdefb`; revenue 0 / arpu baked; +10% promotion = +10% plain event to the penny; the Retention half shipped without mounted coverage, stated) → *2003* (`945d648`: retention fixture 400/100 because 100 is non-discriminating; the re-banded pool observable at Base T+1 only — third session to pay; the mix has no per-tier volumes; round-trip 106; traps 150–152) → *Jon's walk of `945d648`* (percentage promotions apply at leaf and All by the leaf's delta — 8,000 + 71.46 + 48.28 in both tooltips; D5-01 seen; D4-02/D4-03 re-checked green; W4 confirmed via the ARPU chart on 05 Sep) → *2138* (`90e2162`: Dilution rides the percentage arm through the already-extracted `dilutionAmountPct`; duration structurally unbuildable; the Pricing spec caught a reuse) → *0747* (`6802cba`: D5-02 does NOT reproduce — configuration table, rate amplification linear, the sign is the yield event's; D5-01 built; 2dp-before-subtract found) → *1602* (`e5f1e79`: yield pool verified by hand at three views/two months on a varying-inflow fixture; subtract-then-round; `npm run suite` committed, 59/59; `spec:survival` 91/24; `applied-count` re-aimed for D3-04's read-set).

## 6. Current state and what's next — THE RESUME POINT

**Base for the next session: the Repo line of `reports/2026-09-05-1602-yield-base-arpu.md` — `e5f1e79`.** Report-only drift expected.

**FIRST ACTS OF THE NEXT ADVISOR CHAT (if rotated):** (1) D5-03/D5-04 below are the open items — confirm D5-03 with Jon; (2) check the UAT log; (3) confirm the queue.

**THE QUEUE (UAT closing mid-September; findings first; DQ after):**
1. **D5-03 / D5-04 (measure first):** edit-restore of a percentage promotion — does the unit control restore `amountType`? A promotion edited and saved from the Volume card's table — are its arms preserved, stripped, or should the pencil route to the Promotion card? Report, then fix the first if confirmed and record a decision for the second.
2. **Further UAT findings** — ahead of everything below.
3. **Small, pre-close if time allows:** trap 156/157 walk re-check; the dilution CONTROL driven (not just the builder); the promotion's dilution gating asserted.
4. **After UAT:** churn hold/revert (Q1); guide translation pass (six subsections, three glossary entries, the §5 correction, and the new promotion copy); ARPU-companion own mode; dual-measure chart; Compare — tariff-scoped fixture then the last blend; `strictNullChecks` count; REQ-D3-02 composite-event design note (which is where a promotion's price as a `PricingEvent` gets decided); tariff-axis mounted fixture; the three inline amount-mode controls; `fmtDelta` vs `eventVolumeLabel`; the promo arm's non-compounding stated on screen.
5. **DQ** — true-state (first act records the UAT re-scope and DQ-after-UAT in EXPECTED.md), then build. **After UAT.**

**Product decisions surfaced, awaiting Jon:** auto-lock-on-drag; stored-aggregate weighting (after UAT); the mix card's catch-all refusal copy; Step 3/Compare localised month names; "Previsione Standard"; whether promotions should be editable from the Volume table at all (D5-04).

**Standing UAT watches:** as at v3.3.11, plus: `arpu` baked at save while volume resolves per month (coherence unasserted); the promo Dilution control undriven and its gating unasserted; the promo arm cannot compound (unstated); the yield ratio verified at one mix and one fitted ARPU; `spec:survival` counts text not syntax; the suite sentinel is a pattern, not a contract.

**An advisor must NOT draft fix sessions for** (closed on main): everything in v3.3.11's list, plus **decision 6 (`d92fdaa`, `945d648`)**, **decision 3 (`90e2162`)**, **D5-01 (`6802cba`)**, **D5-02 (withdrawn; yield verified `e5f1e79`)**, **KPI precision (`e5f1e79`)**.

## 7. Backlog

*(As at v3.3.11, plus:)* three inline amount-mode controls; `fmtDelta` one-decimal vs `eventVolumeLabel`; the Value card's `rollForward` boolean vs the Pricing card's duration enum; the round-trip spec uses builder-shaped literals (a `.ts` spec cannot import the card); the promo Dilution control and gating; non-compounding copy; `spec:survival`'s regex comment stripper; the suite sentinel; the anchor extractor's method list.

- **Fixtures:** the discriminating two-leaf store (per-scenario bands, retention volume, varying inflow 200/300/400 on the yield case); a second store seeded retention 400/100 for percentage retention promotions; the trimmed fixture's three Product L2 tiers for mix checks. Walk saves by sha1: 03 Sep 08:01 `56f5e7e0…` (two market events, NO yield event); 04 Sep 09:55 (two market events + the yield event; sha1 unrecorded); **04 Sep 21:37** (four market events + yield; in Jon's `Downloads/`, not the repo; sha1 unrecorded).

---

*Maintenance: at each session close, the advisor updates this document, commits it to `docs/` (superseded copy removed in the same commit), and Jon replaces the project-context copy (latest only — git holds the lineage).*
