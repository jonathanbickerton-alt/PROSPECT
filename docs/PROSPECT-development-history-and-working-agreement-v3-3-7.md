# PROSPECT — Development History & Working Agreement

**Purpose of this document:** persistent context for the PROSPECT Claude project. Every advisor chat reads this before its first turn. Replace this file in project context whenever it is updated — a stale copy silently applied is worse than no copy. The document is ALSO committed to the repo (`docs/`); project context carries only the latest, git holds the lineage. **This document is a MAP. For settled decisions, EXPECTED.md verbatim is the terrain** — a condensation once dropped "barred class" from D5 and inverted its meaning, costing a wrong brief. When a decision's exact meaning is load-bearing, read EXPECTED.md, not §3. **A prior report's claim is a premise for the next brief, not a fact** — two briefs on 2026-09-02 inherited wrong premises from reports (a docs sample cited as an app census; a scanner label read as "user-facing"); both were caught by sessions reading source first.

**Last updated:** 2026-09-02 (v3.3.7). **UAT IS LIVE (opened 2026-09-01 on curated files; planned length NOT YET STATED — the queue below is ordered assuming a month; if shorter, DQ moves up).** Last gated state **`a766d0b`** — **guard-traps 121/121**, **51 specs**, mounted mix-card **235/235**, i18n-parity 194/194, lint and build clean. Since v3.3.6: the **chart-grid arc** (UAT Day-1 findings D1-01/D1-02) built and walked green at `42c55ac`; the **locale sweep** (`59731fa`) and **follow-up** (`a766d0b`) took the app from ~14% to fully translated in five locales with parity enforced in the gate; the user-guide English addendum ran at `3c0dcb2` (**report 1005 NOT YET RECONCILED by an advisor — first act of the next chat**). Jon answered six product questions on 2026-09-02 (§3). **This chat (Dev 4) is at capacity — five consecutive upload transport failures; ROTATE: the next advisor chat opens on this document.** Provenance: reports 1219, 1312, 1403, 2343 (chart grid), 1028, 1242 (locales), Jon's walks reconciled screenshot-by-screenshot; hashes from reports only.

---

## 1. What PROSPECT is

PROSPECT (Predictive Reporting Of Scenarios & Planned Execution for Commercial Trends) is a React/TypeScript subscriber forecasting application for Vodafone, built entirely through Claude Code — Jon directs, writes no application code himself. Rebuilt around real IBRO data (Inflow, Base, Retention, Outflow).

- Three-step workflow via ForecastContext: Baseline Forecast → Market Events → Actuals Review; plus **Scenario Compare** (up to 4 session files; own parser feeding `computeScenarioForFilter` — **a SECOND ENGINE, blended-ARPU only, the last blended consumer**). Step 2/3 unlock derives from store contents. Top-nav: **Overall Forecast** (cohort table; no chart seam).
- Models: SES, Holt Linear, Damped Trend, true Holt-Winters. Scoring: symmetric absolute percentage deviation + band position.
- **Base volume is never fitted or stored per month** — reconstructed at read time from the seed rolled through flows; `seedBaseKnown` gates; unknown seed declines. **All four per-scenario ARPUs (inflow/outflow/retention/base) ARE fitted and banded on every forecast month**, each aggregated by its OWN volume (baseArpu by the derived running base). Base ARPU is real.
- Dimensions: Customer Segment + Product/Channel/Tariff L1/L2; 7-part keys. ScopeDims wildcards; a literal 'All' is a DATA VALUE (never translated — TERMBASE §5) and the wildcard in recorded scopes.
- **Event carriers — THREE** (`MarketEvent`, `YieldEvent` — `ibro` typed `'Inflow' | 'Retention'`, both branched by design —, `PricingEvent`). Pipeline order by kind: market → yield → pricing. Six seams real; the Note-sheet placeholder guard.
- **The Step-2 chart is a GRID (shipped `42c55ac`)**: MEASURE row (Volume / Revenue / ARPU, single-select) × SCENARIO pills (Inflow / Outflow / Retention / Base, multi-select, never none — non-empty at the DERIVATION on every path), baseline dashed / adjusted solid per cell. **Service revenue is the numerator of ARPU** at every grain; revenue = that scenario's ARPU × that scenario's volume in the same row; aggregate revenue = Σ leaf revenue. Base measures carry the T+1 lag (caption states it). Per-tab defaults (Volume/Promotion open on Volume; Value/Pricing open on ARPU; a tab remembers its own selection) — **Jon 2026-09-02: leave as is**. The blended ARPU line and "ARPU Outflow (Ref)" are RETIRED from the display; their `chartData` columns persist (export compatibility) — `ARPU (Adjusted)` remains the pricing card's `originalBaseArpu` feed UNTIL the Q3/Q4 session lands. chartData is 29 keys in pinned order; the chart export writes it wholesale (sixteen per-scenario columns after the original thirteen); the session export and Import Save/Compare readers are structurally untouched (`chartData` appears zero times in App.tsx).
- **The pricing card's three surfaces** stand as at v3.3.6 (Preview describes the draft, row = save-time record, chart = current truth; baselines event-scoped via `resolveEventScopeForecast`). **The Q3 build (queued, briefed) moves the baseline to PER-SCENARIO.**
- **Churn mode (R7)** as at v3.3.6, plus D5-revised group edit and Δ direction-of-effect. **Q1 (hold/revert per campaign) queued, not built.**
- **Locales:** six (`en de es fr it pt`), **now fully translated** (de 119→810 of 822 keys, etc.; +3,462 strings at `59731fa`; TERMBASE governs terminology; allowlist 52 entries / 184 pairs, each with a reason). **Marcel (de) and Alessandro (it) are the native reviewers — a UAT-week job, needs a channel.** Two known copy flags for them: "Base (Basis)" beside "Base (Angepasst)"; "Previsione Standard" capital S.
- Business users: Alessandro Russo and Marcel Wiegand — **core UAT users work in GERMAN and ITALIAN**. UAT opened 2026-09-01 on curated files (re-scoped, §3); DQ delivers before UAT closes as one announced drop.
- Roadmap: Cloud Run + BigQuery, AI Booster ML, four AI use cases; AISHA event schema.

## 2. Working agreement

- **Two-tier structure:** the advisor drafts prompts and pushes back on wrong premises; Claude Code writes the code. Nearly every turn ends in a pastable prompt. **Sessions are SEQUENTIAL** — a brief drafted while a session runs is pasted after that session's report is reconciled; its base line resolves to that report's Repo line.
- **TRANSPORT NOTE:** report uploads recurringly arrive EMPTY (five consecutive on 2026-09-01/02). Workaround: read `/mnt/user-data/uploads/<name>` directly. Persistent recurrence = rotate the advisor chat.
- **Reports**: `reports/<yyyy-mm-dd-HHMM>-<topic>.md`, ≤25-line FOR ADVISOR block, mandatory Repo line. **Report rule (FINAL):** every session produces one; skeleton first; a dead session's skeleton is the diagnostic.
- **Close ritual / stability rule / brief conventions / base-drift convention** as at v3.3.6. **Measured stop-conditions are outcomes** — six on record now (5a14872; 293485f; 0906; 1200's refused Fix 1; 1242's refuted item 1; 2343's re-aimed trap).
- **Jon's walks are screenshot-gated at step zero**; observations reconciled against screenshots before verdicts; **a walk with open observations holds the arc open**. **The step that reveals a defect is not necessarily the step that causes it** (W6a: the tab, not the add). **A wrong comparison is not a FAIL** (W3: actuals at 2026-06 vs forecast at 2026-08 — same-named-quantity, same month, two routes is the test).
- **Agentic QA:** three-stage gate; EXPECTED.md = what was DECIDED, never what is true of the build. Instruments: typecheck; traps; guard-traps (**121 at `a766d0b`** — cite COUNT never id range; ids run to 124, 97 retired); the mounted mix-card harness (235; **prop-stability rule**); **spec:i18n-parity** (exact-count allowlist with reasons; no stale exemption); **spec:i18n-scan (`scan-i18n --check`, in the gate; the mixConstraint `.detail` exclusion is CONDITIONAL on nothing reading it)**; spec:month-format; spec:forecast-type-split; spec:mix-refusal-copy (all eight reasons, union read from source). **Exact counts, never `>=`** — trap 77's floor FAILED in practice (2026-09-01); a sweep re-aimed the two source-site floors; eleven legitimate runtime floors listed with reasons. **New controls get testids; selectors never match by text** (three label/prefix collisions in one arc). **Plant a trap by hand and confirm red before trusting it** (found a defect in the fix it was guarding, 2343).
- **Repo skills**, **the user guide as a tracked artefact** (SHA-pinned frozen blocks; quotes what the user sees), **usage (~87% Opus)**, **session-close ritual** — as at v3.3.6.
- **UAT observation log** (Jon keeps it; the advisor triages): a re-observation of anything on the closed list is a NEW diagnosis, not a reopening. Entries so far: **D1-01 / D1-02 CLOSED (`42c55ac`)**; **D2-01 CLOSED (`59731fa`)**.

## 3. Settled decisions — do not reopen

*(EXPECTED.md verbatim governs. Everything in v3.3.6 §3 stands — bottom-up; one definition of missing; carriers; R4/R5; Compare arc; R7 D1–D6; D5-revised; Δ-display option (a); pricing baseline scope `7b456a1`; tooltip labels; UAT re-scope.)*

**Chart-grid decisions (Jon, 2026-09-01, recorded in EXPECTED.md at `006a15f`):** service revenue = the ARPU numerator at every grain; the scenario × measure grid; Base has all three measures with its lag labelled; blended ARPU retired from the DISPLAY, `ARPU (Adjusted)` column unchanged; an "all scenarios" ARPU, if ever built, is Σrevenue/Σvolume over the four from leaves — no other definition; Step 2 only (Compare and Overall Forecast separate scopes); export additive; yield on non-Retention: existing behaviour (by design — both type members branched). **Per-tab defaults stand (Jon, 2026-09-02).** **The three-denominator finding** (leaf blend flows+base; aggregate blend flows-only; adjusted blend over base stock; **measured +25.52% on a diverging fixture, `006a15f`**) is **closed by obsolescence once Q3/Q4 land** — it feeds nothing displayed; not corrected.

**Jon's six answers (2026-09-02):**
- **Q1 held tail → option (c):** per-campaign choice, hold or revert; revert is the default and today's behaviour. **BUILD QUEUED.**
- **Q2 points → confirmed as built.** Closed.
- **Q3 pricing baseline → option (b):** the Pricing card's Baseline ARPU (Preview AND row) is the per-scenario figure for the subscribers the event applies to (Inflow → inflowArpu; Retention → retentionArpu; Both → Σrev/Σvol over the two; Base Only → baseArpu; Cohorts+Base → Σ over three), event-scoped. Stored rows verbatim; test events recreated. **BUILD BRIEFED (pricing-per-scenario), base `a766d0b`.**
- **Q4 blend consumers → per-scenario:** the ARPU Delta card shows four per-scenario deltas; the events summary's ARPU delta is per touched scenario. After Q3+Q4 the blended ARPU has NO UI consumer (Compare's own engine excepted); columns persist for compatibility. **Same session as Q3.**
- **Q5 pricing compounding → multiplicative, confirmed.** Off the watches.
- **Q6 languages → German and Italian are the core UAT languages.** Drove the locale sweep ahead of everything.
- **Dual-measure plotting** (two measures, left/right axes, third replaces the oldest) — product direction, **queued as chart-grid session 3**.

**Locale decisions (Jon, 2026-09-02, at `59731fa`/`a766d0b`):** every user-visible string renders in the selected language; a locale value identical to English is a defect unless on the allowlist, **each entry with a reason**; dimension VALUES are never translated (TERMBASE §5); **display/identifier split** (TERMBASE §11) — a persisted value stays the identifier byte-for-byte and a locale key renders it (`forecastType` done; `measureKey`/export headings done). Feature names `Yield` and `Pricing` allowlisted on guide-usage evidence — Marcel may overrule.

## 4. Standing rules (mirrored in EXPECTED.md / agent definitions)

*(The full inherited set stands — v3.3.6 §4 in full, including the pricing/close-arc and user-guide-arc mints.)*

**Minted in the chart-grid arc (2026-09-01):**
- **A recorded decision is not evidence the code implements it** (reaffirmed); **a spec's claim is about the code as RUN**.
- **Retiring a value from a vocabulary is a sweep, not an edit** — every literal that names it (defaults, stored selections, restores, fixtures) is a site; trap 120's source check guards the class.
- **A guard must read the quantity it protects** (`selectedKpis.length` guarding a chart that drew `selectedScenarios`).
- **A floor cannot see a removal once anything has been added** — trap 77 MISSED in practice; exact counts only for source-site evidence.
- **A trap that plants an unobservable change is not a trap** ("what would this actually redden?" — trap 120's first aim).
- **Plant by hand before believing** — a green run did not find the pills/chart disagreement; the negative control did.
- **The configuration where a defect is invisible is the one everybody loads** (reaffirmed for scoping); **the step that reveals is not the step that causes**.

**Minted in the locale arc (2026-09-02):**
- **A sample of what a document quotes is not a census of the app** (50/76 → 703/822).
- **A tool that diagnoses its own defect in a comment and fixes it in one block has left it standing in the next** ("PRESENCE IS NOT TRANSLATION").
- **A strictness check needs an exemption route with reasons, or it pressures you to make the product worse to stay green** ("Volume dei dati").
- **An exemption must be wired to its premise** — the `.detail` exclusion lapses the moment one is rendered; `LOCALE_DEFERRED` sat a year because it couldn't.
- **Enforcement that only runs under a flag nobody passes is documentation** — `--check` is in the gate now.
- **Render in the language; a source check cannot see a second render path** (Step 3's hand-drawn legend) and **a formatted date is invisible to a parity check**.
- **A scanner's label is not evidence; read the module** (the seventeen diagnostic strings).
- **Exact counts pin REMOVAL where removal is the dangerous direction** (the identifier's 20/10/7).

## 5. Development history (condensed)

**Everything through the R7 + pricing arc and the user-guide arc: CLOSED** — v3.3.6 §5 (repo `docs/` lineage). Last gated state before 2026-09-01 was `4a1d110`.

**The chart-grid arc (2026-09-01, UAT Day 1–2, CLOSED at `42c55ac`):** *1219 true-state* (`8d00543`, read-only: all four per-scenario ARPUs already fitted; adjusted collapses to one blend over base stock; three denominators under two lines; Compare a second engine; the pricing coupling flagged) → *1312 engine* (`006a15f`: item 0 measured the split at +25.52%; `scenarioArpu.ts` pure, four quantities ALONGSIDE the blend, after pass F, read-only — the pin holds by construction; the 1219 yield claim corrected; **trap 77's `>=` MISSED and was re-aimed**; traps 113) → *1403 control/columns/export* (`d63175b`: sixteen columns key-order-pinned at 29; the two-row control; five keys six locales; readers structurally unaffected + old-file round trip; the `>=` sweep 13→2 re-aimed; traps 116; mount 208) → *Jon's walk* (Blocks green; W3 misread — actual vs forecast; W6a the empty chart; W8 the bulk gap) → *2343 selection fix* (`42c55ac`: the per-tab default `['ARPU']`, never the add; the guard read the wrong quantity; fix at the derivation; trap 120 re-aimed after a vacuous first aim; the negative control found the pills/chart disagreement; the "Volume" label collision → tab testids; traps 117; mount 235) → *re-check* (R1 per-tab default = design; R2 Step 2 = Step 3 at Oct 2026 to the penny; R3 new keys render). **ARC CLOSED.**

**The user-guide addendum, English (2026-09-02 ~10:05, `3c0dcb2`): RAN, REPORT NOT YET RECONCILED** — Jon to upload `reports/2026-09-02-1005-*.md` to the next chat; sign-off pending; the translation pass is briefed on it.

**The locale arc (2026-09-02):** *1028 sweep* (`59731fa`: census 703/822 per locale — the app ~14% translated; scan-i18n's presence-not-translation defect diagnosed in its own comment; all five locales +3,462; exact allowlist 52/184 with reasons and staleness checks; three invented differences caught; hardcoded labels keyed; UAT-D2-01 larger than briefed — `<Line>` without `name` plus hardcoded "Forecast"/"Actual"; the de/it walk found seven literals incl. Step 3's hand-drawn legend and a dropdown disagreeing with itself; `measureDisplay()` keeps export headings English; traps 119) → *1242 follow-up* (`a766d0b`: the seventeen mixConstraint strings are DIAGNOSTIC — premise refuted, five real tooltip reasons found and keyed; `--check` gated with a conditional exclusion; TERMBASE §11's open question answered at four stale sites, identifier pinned 20/10/7, old-save round trip; Step-2 month formatter locale-aware (Step 3/Compare already `yyyy-MM`); de layout measured, fr and Step 3 shed; traps 121; 51 specs).

## 6. Current state and what's next — THE RESUME POINT

**Base for the next session: the Repo line of `reports/2026-09-02-1242-locale-followup.md` — `a766d0b`** (or of the pricing-per-scenario report if it has landed). Report-only drift expected.

**FIRST ACTS OF THE NEXT ADVISOR CHAT:** (1) reconcile the **1005 guide-addendum EN report** and get Jon's sign-off; (2) get **UAT's planned length** and re-order the queue against it; (3) confirm the **native-review channel** for Marcel (de) and Alessandro (it) exists.

**THE QUEUE (ordered assuming a month of UAT):**
1. **Pricing per-scenario + blend consumers (Q3/Q4)** — BRIEFED, paste-ready in the Dev 4 chat's last turns; if not in this document's companion, re-derive from §3's Q3/Q4 wording. Walk: one pricing event per Applies-to on a narrow slice, Preview vs the chart's per-scenario ARPU on screen, the KPI card, a re-created test event.
2. **Guide translation pass** — addendum translations + **re-resolve every quoted key per locale from the current bundles** (the 1924 quotes are now stale: those strings are translated) + rewrite the "parts not yet translated" note to the true residue. Gated on the 1005 sign-off.
3. **Churn hold/revert (Q1)** — per-campaign control; hold emits member rows through horizon end at the final cumulative target, folded per month; group edit seeds/re-states the flag; revert default; existing campaigns unchanged.
4. **DQ** — true-state read-only brief as at v3.3.6 §6 (its first act records the UAT re-scope in EXPECTED.md — still not recorded). Inheritance list unchanged. **Must deliver before UAT closes.**
5. **Chart-grid session 3** — dual-measure plotting (left/right axes; third replaces oldest); optionally revenue columns in the Step-2 table (Jon: "chart is enough currently").
6. **Scenario Compare** — the last blended-ARPU consumer, second engine; its own arc.

**Product decisions surfaced, awaiting Jon:** the mix card's catch-all refusal copy is wrong for `no-members`/`arpu-unknown` (six-locale copy change); whether Step 3/Compare axes should show localised month names; "Previsione Standard" capitalisation (Alessandro).

**Standing UAT watches:** manual padlocks; R3 override surface; orphan/drop on real data; **absence-path frequency on real data**; **Revenue-measure axis dominance** (Base compresses flows; observation, not built); layout at French widths and Step 3's table (unmeasured); the pricing absence state and the ramp editor not rendered in de/it; the `<Trans>` fragment backlog (TERMBASE §12); `.detail` laundering through a renamed binding would evade the scan's premise check. Resolved and off the watches: pricing compounding (Q5), points (Q2), Δ-sign.

**An advisor must NOT draft fix sessions for** (closed on main): everything in v3.3.6's list, plus **the chart-grid set (`006a15f`/`d63175b`/`42c55ac`)**, **UAT-D2-01 and the locale sets (`59731fa`/`a766d0b`)**. Re-observation = new diagnosis.

**Open Alessandro items:** none of the original six remain — all answered by Jon 2026-09-02. Native review (de/it) and the three copy decisions above are the live asks.

## 7. Backlog

*(As at v3.3.6, plus:)* the mislabelled `derive-aggregate` check ("not a single model" asserting `>= 1`); trap 77's anchor now unique (extended, not moved); the `<Trans>` conversion of sentence fragments (`whatif_retention_volume` family; `bulk_don_t`); the `.detail` premise-check hardening; French/Step-3 layout measurement; Step 3 mounted refusal states (engine and mapping driven, pixels not); a group-edit round trip on a CHANGED trajectory (not separately mounted); **the ARPU/summary blended columns' compatibility annotation** in the export (Q3/Q4 session item 4).

- **Fixtures:** as at v3.3.6; the 2026-08-21 mixed-semantics walk save remains DISQUALIFIED; the trimmed fixture (12,432, 74 leaves) was the locale walks' subject.

---

*Maintenance: at each session close, the advisor updates this document (history condensed into §5, state moved through §6, decisions promoted to §3/§4), commits it to `docs/` (superseded copy removed in the same commit), and Jon replaces the project-context copy (latest only — git holds the lineage).*
