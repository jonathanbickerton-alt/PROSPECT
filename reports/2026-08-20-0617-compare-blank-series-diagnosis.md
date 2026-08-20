# Scenario Compare — the blank chart on Corporate / Mobile Voice / Direct

## FOR ADVISOR

```
Generated: 2026-08-20 06:17 +0100 (UTC 2026-08-20 05:17)
Verified against: 190ca45
Repo: committed dc4c9c9, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
READ-ONLY DIAGNOSIS — no source changed.
BASE: HEAD 190ca45 vs the brief's ac141ca — one commit, REPORT-ONLY.
THE BRIEF'S HYPOTHESIS IS REFUTED BY MEASUREMENT. There is NO matching gap:
  Corporate/Mobile Voice/Direct matches 360 baseline rows (Mobile Data: 24)
  and yields 24 months of finite data on ALL FOUR saves (ARPU 14.34 vs Jon's
  What-If 14.28) — chartData has 0 missing keys, 0 non-finite values.
THE ASYMMETRY IS INVERTED FROM THE ONE ASSUMED: Mobile Voice has 15 cohorts,
  Mobile Data has 1. Every narrowing filter I tested blanks Mobile DATA first.
THE EMPTY-STATE MESSAGE THE BRIEF ASKS FOR ALREADY EXISTS, so a blank WITH
  AXES proves chartData was NON-EMPTY — the defect is DOWNSTREAM of the data.
LEADING HYPOTHESIS, code-evidenced, NOT proven without a mount: the Brush.
  `startIndex={windowOffset}` is UNCLAMPED while endIndex IS clamped, and
  windowOffset is never reset on filter/data change, nor by the time-range
  buttons (they set windowSize only). offset > endIndex = a degenerate
  window: axes, no lines, immune to the range buttons. Matches every detail.
VOCABULARY RISK IS REAL BUT NOT THIS BUG: 0 unrenderable options across all
  four files. Populate reads EVENT sheets, chart matches BASELINE rows, and
  nothing guarantees they agree — they simply do here.
PANELS UNAFFECTED, as expected: buildPerFileEventPanels reads event arrays
  only and never touches baselineRows.
DECISION NEEDED: one observation from Jon settles it — see Decisions.
```

---

## Base check

`HEAD` **`190ca45`**; the brief names **`ac141ca`**. One commit apart,
**report-only** (the FOR ADVISOR fill of the events-panel report). Established
drift pattern, flagged and proceeded. Working tree clean at start, `origin` in
sync. Read-only throughout: no source file was modified.

## 1. The series path, traced

| stage | symbol | reads | matches on |
|---|---|---|---|
| filter → series | `computeScenarioForFilter` (`scenarioHelper.ts:6`) | `parsedSession.baselineRows` | `Segment`, `Product`, `Product_L2`, `Channel`, `Channel_L2`, `Tariff_L1`, `Tariff_L2` (`:17-27`) |
| series → chart rows | the `chartData` memo (`ScenarioCompareTab.tsx:234-270`) | the above | merges by month into `${fileName}_Base`, `_ARPU`, `_BaselineBase`, `_BaselineARPU` |
| chart rows → lines | `<Line dataKey=…>` (`:482-508`) | `chartData` | key equality |

**It is a private matcher.** `computeScenarioForFilter` filters the save's
`Baseline_Forecasts` **sheet rows** with a hand-rolled predicate. The What-If
side matches the **store** through `makeForecastKey` / `eventScopeMatchesView`.
Two different row sources and two different matchers — which is worth recording
as a standing risk, and is *not* the cause here.

The comparison is exact string equality, with a wildcard escape on the L2 and
tariff columns only (`r.Product_L2 !== 'All'`). `Product` and `Channel` have **no**
wildcard escape — an L1 must match literally.

## 2. What the real files actually contain

Read directly: **17 Aug 1211**, **18 Aug 1349**, **18 Aug 1351**, **18 Aug 2155**.
All four carry 1,728 `Baseline_Forecasts` rows.

```
Baseline Products : ["Mobile Voice","Mobile Data","IoT Connectivity","Fixed Connectivity"]
Baseline Channels : ["Direct","Indirect"]
Baseline Segments : ["SOHO","SME","Corporate","MNC","Large Enterprise"]
```

**The filter matches. It does not return zero.**

```
Segment=Corporate Product=Mobile Voice Channel=Direct -> 360 rows   (15 cohorts)
Segment=Corporate Product=Mobile Data  Channel=Direct ->  24 rows   ( 1 cohort)
```

And the whole path produces good numbers, on every file:

```
1211  Corporate/Mobile Voice/Direct: 24 months  base[0]=80848  arpu[0]=14.34
1349  Corporate/Mobile Voice/Direct: 24 months  base[0]=80848  arpu[0]=14.34
1351  Corporate/Mobile Voice/Direct: 24 months  base[0]=80848  arpu[0]=14.34
2155  Corporate/Mobile Voice/Direct: 24 months  base[0]=80848  arpu[0]=14.34
```

**`arpu[0] = 14.34` against Jon's What-If figure of 14.28** — the same cohort,
the same order of magnitude, a difference consistent with the two sides'
different ARPU weighting. The Compare side is *not* failing to find this data.

Simulating the tab's `chartData` memo verbatim over all four files at once:

```
Corporate / Mobile Voice / Direct → chartData 24 rows
  across all 24 months × 4 files: 0 missing keys, 0 non-finite values
```

**Every key Recharts asks for is present and finite.**

## 3. The asymmetry — and it runs the other way

The brief asks why Mobile Data renders and Mobile Voice does not. **On the data,
the question inverts**: Mobile Voice is the robust one.

- Mobile Voice / Corporate / Direct — **15 cohorts, 360 rows**, tariffs
  `RED L, XL, ULTD, M, S`, five Channel_L2 values, three Product_L2 values.
- Mobile Data / Corporate / Direct — **1 cohort, 24 rows**, tariff `RED ULTD`
  only, Channel_L2 `Inside Sales` only, Product_L2 `High Value` only.

I tested every stale-narrowing hypothesis that could survive a product change.
Each one blanks **Mobile Data** and leaves Mobile Voice rendering:

```
tariff=RED L        Mobile Voice=24mo   Mobile Data=BLANK
prodL2=Low Value    Mobile Voice=24mo   Mobile Data=BLANK
chanL2=Digital Direct  Mobile Voice=24mo   Mobile Data=BLANK
```

No filter state I can construct reproduces the reported direction. The tariff
hypothesis dies outright for a second reason: the event-sourced `tariffTree` is
**empty** for these files, so the Tariff dropdown never renders.

## 4. Classification, and the two vocabularies

**Classification: neither never-worked nor introduced — the posited defect does
not exist.** The matching gap the brief hypothesises is absent from these files,
and the populate fix did not expose one. I could not classify a defect I could
not reproduce.

**The vocabulary question is still worth answering, because it is a real latent
risk.** The fixed populate sources options from the **event sheets**; the chart
matches against **baseline rows**. Nothing in the code guarantees these agree —
there is no shared vocabulary, no validation, and no contract. An event scoped to
a product with no baseline coverage *would* offer an option that can never render.

Measured across all four saves:

```
EVENT vocabulary: segments ["Corporate"]
                  products ["Mobile Data","Fixed Connectivity","Mobile Voice"]
                  channels ["Direct"]
UNRENDERABLE options (offered by events, absent from baseline): 0
```

**Zero.** The two vocabularies happen to agree completely here — which is
expected, since a user scopes an event by picking from the same data — so this
bug cannot be a vocabulary mismatch. The guarantee is still missing, and that is
worth closing on its own merits, but it is a **separate, currently-latent** item.

### The inference that relocates the defect

`chartData.length > 0` gates the chart (`ScenarioCompareTab.tsx:451`); otherwise
the tab shows `compare_no_data_for_selected_filters`.

**So the empty-state message the brief asks for already exists** — and that is
the most informative fact in this diagnosis. Jon reports a *blank chart*, not a
message. If `chartData` had been empty he would have seen the message. Therefore
**`chartData` was non-empty**, the matching found rows, and the defect lies
downstream of the data — exactly where the measurements above say it does.

## The leading hypothesis: the Brush window

```jsx
startIndex={windowOffset}
endIndex={windowSize === 'all' ? chartData.length - 1
                               : Math.min(chartData.length - 1, windowOffset + windowSize - 1)}
```

**`endIndex` is clamped to the data length. `startIndex` is not.** And
`windowOffset` (`:48`) is component state that is **never reset** — not when the
filter changes, not when `chartData` changes length, and not by the time-range
buttons, which call `setWindowSize(size)` alone (`:389`).

Once `windowOffset` exceeds the current data length — trivially reachable by
dragging the brush right under one filter and then changing filters —
`startIndex > endIndex` and the rendered window is degenerate: **axes, no lines**.

This matches every detail of the observation: blank rather than a message; both
Base and ARPU (one Brush serves both views); all four files (the window is
global); and **unaffected by the time-range buttons**, because those change only
the size and the stale offset survives.

**Stated as a hypothesis, not a finding.** It is a real, unambiguous defect in
the code either way — an unclamped index paired with never-reset state — but
confirming it *is Jon's blank* needs a mount, and this session is read-only.

## 5. The adjacent surface — the events panels

**Unaffected, as expected, and for a structural reason.**
`buildPerFileEventPanels` (`forecasting.ts`) reads `s.marketEvents`,
`s.yieldEvents` and `s.pricingEvents` and **never touches `baselineRows`**. It
shares no code with `computeScenarioForFilter`. Whatever is wrong with the chart
cannot reach the panels, and a panel will correctly list a pricing event scoped
to Mobile Voice whether or not the chart draws a line for it.

Worth noting as a UX consequence: with the panels shipped, a user in this state
sees a panel confirming the events exist beside a chart showing nothing — which
makes the blank *more* conspicuous, not less.

## Smallest-scope fix proposal

Three items, independent, smallest first. **None applied.**

**(a) Clamp the brush window — the chart fix.** `startIndex` must be clamped the
way `endIndex` already is, and `windowOffset` reset when `chartData` changes
length. Belongs to the Brush, not to the matching. This is the only one that
plausibly addresses the reported symptom.

**(b) The populate/render contract — the latent one.** Either restrict options to
values that can render, or keep offering them and say so. **My recommendation is
the second**, and the two-meanings-of-null rule is why: an event scoped to a
product with no baseline coverage is a *real event the user created*, and hiding
it from the filter would make "not offered" mean both "no such event" and "an
event you cannot chart". Better to offer it and let the existing no-data message
explain — which requires (c) to be honest.

**(c) Sharpen the empty state.** The message exists but says only that no data
matched. Where the selection came from the events vocabulary and finds no
baseline rows, it should say *that* — the events exist, the baseline does not
cover them — rather than leaving the user to guess. Small copy change, one new
key, six locales.

**Explicitly NOT proposed: any change to `computeScenarioForFilter`'s matching.**
It is measurably correct for this case, and changing it would be fixing something
that is not broken.

## Decisions for Jon

1. **One observation settles the diagnosis.** With the four files loaded and the
   blank on screen: is the **brush handle at the far right / collapsed**, and does
   dragging it back to the left restore the lines? Yes → hypothesis confirmed,
   fix (a) is the whole bug. No → I need the browser console output, because the
   data path is exonerated and the next candidate is a render-time throw.
2. **Fix (a) alone, or (a)+(c) together?** (a) is a genuine defect regardless of
   whether it is Jon's blank, so it can proceed either way.
3. **Is (b) worth doing now, or does it belong to DQ?** DQ already owns
   single-source-of-truth for the `'All'` marker sites; the two-vocabulary
   contract is the same species of problem and may be cheaper folded in there.
4. **The Compare/What-If matcher split** — two row sources, two predicates, no
   shared rule — is not on any backlog. Record it as a known divergence, or
   schedule it?

## Limits of this diagnosis

**Nothing was mounted, and this is the binding limit.** Every measurement above
drives the real functions over the real files under Node. The Brush hypothesis
is a **code reading plus an inference**, and it is the one claim here that a
mount would settle in a minute.

**I could not reproduce the reported symptom.** That is the honest headline. It
is possible the running app differs from `190ca45` — a stale bundle, or state
accumulated across the session that these inputs do not capture. I have not
assumed Jon misread anything: the observation is specific and repeated across
four files, and the code contains a defect that would produce exactly it.

**The 18 Aug 1349 save was read** despite not being named in the brief's parenthetical
list of Downloads files; all four behave identically.

**`Is_Active` is `'No'` on every matching row**, consistent with the earlier
finding on record. The series path does not read that column, so it is not
implicated — noted only so the next reader does not re-derive it.
