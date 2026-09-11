# Pre-release tidy — percentage display at 2dp; duration-1 label aligned

## FOR ADVISOR

```
Generated: 2026-09-11 15:28 +0100 (UTC 2026-09-11 14:28)
Certifies: 296618c   (REQ-D6-05 clauses 17-18: % at 2dp; duration-1 label)
Repo: committed 296618c, pushed (origin in sync)
BASE fb412a0; status --short EMPTY; diff to HEAD EMPTY. Both quoted.
1 CLAUSES 17-18 RECORDED, EXPECTED.md alone (39989ec), before any code.
2 MEASURED: a stored % printed four ways - the raw double (summary, Compare,
  promo table), 1dp (fmtDelta, retention warning), 2dp or whole, no unit.
3 ONE RULE: eventVolumeLabel rounds to 2dp, zeros trimmed (+3.33%, +10%).
  The stored value is untouched: 3.333333333333334 round-trips identical.
4 fmtDelta RETIRED into eventVolumeLabel; retention warning, both previews
  and both held-tail lines repointed. No surface keeps its own toFixed.
5 MOUNTED: summary "Inflow +3.33%", no long form anywhere in the tab,
  save/reload identity. spread-ramp-volume 95/95.
6 ITEM 2: absolute Ramp at duration 1 reads "Target volume — one month" on
  both cards; one _one key in six locales, 910 keys per locale.
7 RED FIRST: suite survey 69/71 - arpu-companion pinned fmtDelta; trap
  234's anchor occurred twice. Both re-aimed only after the red.
8 TRAPS 235, 236 RED by hand; 125 re-aimed (it planted fmtDelta), RED.
9 QUESTION: pricing percentages still print as typed or at 1dp - clause 17
  read as the VOLUME %. Extend it to pricing?
10 LIMIT: the % prints with "." in every locale (pre-existing, unchanged).
SHED: nothing. Items 0, 1 and 2 done.
guard-traps 232/232 caught; full suite 71/71 green.
```

## 0. Base

BASE is `fb412a0`, the 1206 report's `Repo:` and `Certifies:` hash. HEAD at
session start carried only the filled 1206 report (`e6f2578`) on top of it.

```
$ git status --short
(empty)

$ git diff fb412a0 HEAD --stat -- src scripts test-data
(empty)
```

Both empty, as the brief requires. The skeleton `a37c3bf` was the session's
**first repo action**, committed before this check was run.

## 1. Item 0 — clauses 17 and 18 recorded

Appended under REQ-D6-05 in `test-data/EXPECTED.md`, committed **alone** at
`39989ec` (4 insertions, one file), before any code. Clause 18 settles the
question the 1206 report put to Jon: the absolute Ramp at duration 1 now reads
"— one month", as the percentage does.

## 2. Item 1 — percentage display at 2dp

### 1.1 Measure — the formatter each surface uses (on `fb412a0`)

| surface | formatter for a stored % | form it printed |
|---|---|---|
| Events summary, ADJUSTS column (`EventsSummaryTable.tsx:239` shows `r.adjusts`) | `buildEventsSummaryRows` `forecasting.ts:1225` → `volumeEventSummary` `:950` / `promoEventSummary` `:967` → **`eventVolumeLabel` `forecasting.ts:929`** | the raw double — **`+3.3333333333333334%`**, Jon's defect |
| Scenario Compare's per-file events panels (`ScenarioCompareTab.tsx:725`) | the same `EventsSummaryTable` over the same rows | the raw double |
| Promotion card's promotions table (`WhatIfTab.tsx:9944`) | `eventVolumeLabel` | the raw double |
| Volume events table — Inflow / Retention / Outflow Δ (`WhatIfTab.tsx:7981`, `:7989`, `:8000`) | **`fmtDelta` `WhatIfTab.tsx:7814–7816`** — its own `toFixed(1)`: **the bypass**, the recorded remaining duplication | `+3.3%` — 1dp |
| Retention clamp warning (`WhatIfTab.tsx:8119`) | its own `` `${event.subscriberVolume.toFixed(1)}%` `` — a **second bypass** the brief did not name | `3.3%` — 1dp |
| Draft preview grid, Volume (`WhatIfTab.tsx:7506`, `:7512`) | its own `Math.round(raw * 100) / 100`, then `toLocaleString`, **no unit** | `+3.33` |
| Draft preview grid, Promotion (`WhatIfTab.tsx:9290`, `:9295`) | the same, no unit | `+3.33` |
| Held-tail line, Volume (`WhatIfTab.tsx:7566`) | `toLocaleString`, **no unit** | `+10` |
| Held-tail line, Promotion (`WhatIfTab.tsx:9347`) | `toLocaleString` + a local `'%'` | `+10%` |
| Chart tooltip (`renderTooltip`, `WhatIfTab.tsx:3519`) | **none** — it lists each event's name and comment, never a volume (`:3563–3576`) | — |

**Four surfaces printed a stored percentage four different ways**: the raw
double, 1dp, 2dp without a unit, and whole numbers without a unit. Only the
first is what Jon saw; the others would have been the next report.

### 1.2 Fix — in `eventVolumeLabel`, and every bypass repointed at it

**The one rule** (`forecasting.ts`, `eventVolumeLabel`): the percentage arm now
rounds for display — `Math.sign(v) * Math.round(Math.abs(v) * 100) / 100`,
symmetric about zero, left a Number so trailing zeros go: `+3.33%`, `+6.67%`,
`+10%`, `+2.5%`. A figure that rounds to zero reads `0%`, with no sign. **Only the
string is rounded**; nothing is written back to the event.

**`fmtDelta` was the bypass, and it is RETIRED into `eventVolumeLabel`.** Its
`toFixed(1)` percent branch — the recorded remaining duplication — is gone. The
three Volume events-table cells call `eventVolumeLabel` directly, passing
`fmtSigned`, the signed absolute half the rule deliberately leaves to callers.
No local helper formats a percentage any more.

**The other bypasses, repointed — none given its own `toFixed`:**
- the retention clamp warning: `eventVolumeLabel(event, n => formatNumber(n))`;
- both draft preview grids: the local `Math.round(raw * 100) / 100` is removed, and
  the cell goes through the rule, so a percentage row now carries its unit;
- both held-tail lines: through the rule, so the Volume line gains its missing `%`,
  and the Promotion line's local `'%'` is gone.

The absolute arms are unchanged at every one of those surfaces: the same signs,
rounding and `toLocaleString`/`formatNumber` as before, passed in as `fmtAbsolute`.

## 3. Item 2 — the absolute Ramp at duration 1

A new key, `whatif_amount_label_ramp_one` — "Target volume — one month" — in six
locales, each the stem of the existing `whatif_amount_label_ramp` with that locale's
"one month" (de "Zielvolumen — ein Monat", es "Volumen objetivo — un mes",
fr "Volume cible — un mois", it "Volume obiettivo — un mese", pt "Volume-alvo — um
mês"). It is the same shape as clause 15's `_pct_one`: each card's absolute Ramp
branch picks `_one` at duration ≤ 1 and the month form otherwise, and
`, then held` is still the one shared key. 909 → **910** keys per locale.

## 4. Red first, the re-aims, and traps 235 and 236

### The survey — the whole suite on the changed `src`, before any spec was touched

```
full suite on the changed src, specs untouched: 69/71 green
[FAILED ] spec:arpu-companion
[FAILED ] spec:trap-anchors
69/71 green
── arpu-companion
arpu-companion spec: 17 passed, 2 failed
  FAIL ROW: the three VOLUME cells still use the percentage-aware formatter  [0 — inflow, retention and outflow]
  FAIL ROW: fmtDelta still carries its percent branch for those cells
── trap-anchors
trap-anchors spec: 243 passed, 1 failed  (230 traps, 239 anchors)
  FAIL  trap 234 the Volume percentage label falls back to the month-less form in Ramp mode: anchor 1 occurs EXACTLY once in WhatIfTab.tsx  [2 occurrences — replace() takes the first, so the trap plants at the wrong one]
```

**Both reds were the predicted ones, and nothing else went red.** No existing
spec pinned the preview, held-tail or duration-1 label forms, so those changes
reddened nothing; their new assertions are the `(p)` and `(r)` cases.

**Re-aimed, only after that red:**
- **`arpu-companion` §3** pinned `fmtDelta` by name. It now requires the three
  volume cells to call `eventVolumeLabel(…, fmtSigned)` (count 3), requires
  `fmtDelta` to be gone and no `v.toFixed(1) + '%'` to remain, and forbids the
  ARPU cell from calling either volume formatter. The last check was green, and I
  widened it in the same edit.
- **Trap 234's anchor** is now two lines, adding its own `_pct_one` line. Alone, its first
  line is a substring of clause 18's new absolute-Ramp line.
- **Trap 125** was not red, but its mutation planted `fmtDelta(arpuDelta)`, a
  name that no longer exists: a compile error, which its own comment says it
  must not be. It now plants the shared volume rule on the ARPU cell.

### New cases, and the specs green

```
arpu-companion spec: 19 passed, 0 failed
events-summary spec: 58 passed, 0 failed
spread-ramp-volume spec: 95 passed, 0 failed
spread-ramp-promo spec: 67 passed, 0 failed
trap-anchors spec: 246 passed, 0 failed  (232 traps, 241 anchors)

(p) stored: 3.333333333333334 / 6.666666666666668 / 10
```

### Every trap planted by hand, restored from a scratchpad backup, md5 verified

```
trap 235   spread-ramp-volume spec: 92 passed, 3 failed
  FAIL  (p) CLAUSE 17: the summary row for month 1 reads "Inflow +3.33%"  [VolumeVolumePct2dpInflow +3.333333333333334%Corporate2026-07 | VolumeVolumePct2dpInflow +6.666666666666668%Corporate2026-08 | VolumeVolumePct2dpInflow +10%Corporate2026-09]
  FAIL  (p) CLAUSE 17: month 2 reads "Inflow +6.67%"  [VolumeVolumePct2dpInflow +3.333333333333334%Corporate2026-07 | VolumeVolumePct2dpInflow +6.666666666666668%Corporate2026-08 | VolumeVolumePct2dpInflow +10%Corporate2026-09]
  FAIL  (p) CLAUSE 17: NO surface in the tab shows a long-form percentage  [+3.333333333333334% +6.666666666666668% +3.333333333333334%]
  pre-plant md5 78808312f42cc8c4f7cfaa2ac2157072, restored 78808312f42cc8c4f7cfaa2ac2157072

trap 236   spread-ramp-volume spec: 94 passed, 1 failed
  FAIL  (r) CLAUSE 18: an absolute Ramp at duration 1 reads "Target volume — one month"  [Target volume — reached at month 1]
  pre-plant md5 5e7409dd5b98be109c3524bde2e8a223, restored 5e7409dd5b98be109c3524bde2e8a223

trap 125   arpu-companion spec: 17 passed, 2 failed
  FAIL ROW: the ARPU cell uses it
  FAIL ROW: and never uses the volume formatter  [the volume rule keys off the VOLUME amount type — that is UAT-D2-02]
  pre-plant md5 5e7409dd5b98be109c3524bde2e8a223, restored 5e7409dd5b98be109c3524bde2e8a223

trap 234   spread-ramp-volume spec: 93 passed, 2 failed
  FAIL  (f2) CLAUSE 15: % 10 over 3 reads "Change to Inflow — reached at month 3"  [Change to Inflow — one month]
  FAIL  (f2) CLAUSE 15: Hold on adds ", then held"  [Change to Inflow — one month, then held]
  pre-plant md5 5e7409dd5b98be109c3524bde2e8a223, restored 5e7409dd5b98be109c3524bde2e8a223
```

## Gate

Run **serially** as one chain writing to files; captures in the scratchpad:
`gate-tidy.out`, the suite in `gate-tidy-suite.out`, guard-traps in `gate-tidy-gt.out`.

| check | figure |
|---|---|
| `npm run suite` | **71/71 green** |
| guard-traps (to a file, per-trap lines) | **232/232 caught**, 0 missed / inconclusive / crashed; unfiltered, no FATAL; 125, 234, 235, 236 each CAUGHT |
| `spec:trap-anchors` | **246/246** — 232 traps, 241 anchors; next free id 237 |
| `spec:i18n-parity` | **200/200** |
| keys per locale | **910** in each of de / en / es / fr / it / pt |
| `spec:i18n-scan` | **PASS** |
| `spec:survival` | **27/27** — 104 first-row dereferences across 26 files |
| `tsc --noEmit` | **clean**, exit 0, 0 errors |
| `npm run lint` | **clean**, exit 0 |
| `npm run build` | **built in 5.44s**; the >2000 kB chunk notice is pre-existing |

**guard-traps left the tree clean:** `WhatIfTab.tsx` md5 `5e7409dd…` and `forecasting.ts` md5 `78808312…` identical before and after the run.

### Exact counts the brief named

| pin | required | measured | instrument |
|---|---|---|---|
| `runIngest` sites | 3 | **3** (ingest 53/53) | `ingest-spec.tsx:254`, green |
| apply sites | 12 | **12** (event-toggle 156/156) | `event-toggle-spec.tsx:110`, green |
| display markers | 6 | **6** | `event-toggle-spec.tsx:399`, same file |
| ramp/hold checkboxes | 4 | **4** (hold-shape 61/61; direct count 4) | `hold-shape` clause-10 pin, green; clause 16 |
| last-column, Market / Yield / Pricing | 4 / 2 / 3 trailing | **4 / 2 / 3** | `event-toggle-spec.tsx` block from `:502`, green |
| `computeAdjustedForecast` sites | 6 | **6** (pricing-roundtrip 150/150; direct count 6) | `pricing-roundtrip-spec.ts:457`, green |

Also measured directly: `fmtDelta` occurs **1** time in `src` — the comment recording its retirement (`WhatIfTab.tsx:7820`); **0** definitions or calls. `subscriberVolume.toFixed` occurs **0** times.

## What was shed

**Nothing.** Item 0 was recorded and committed alone. Item 1 (never shed) is done: the
formatter, the fix, the bypasses repointed, the mounted cases and trap 235. Item 2
is done: the key, both cards, the mounted cases and trap 236.

## Limits

- **Pricing percentages were not touched.** Price-rise events print their stored
  percent as typed (`pricingEventSummary`, `forecasting.ts:898`; the promotion's
  pricing arm, `:979`) or at 1dp (`WhatIfTab.tsx:8841`). Clause 17 follows clause
  7, which is the VOLUME percentage, so I read it as that. Whether it extends to
  pricing is a question for Jon.
- **The decimal separator is "." in every locale.** `eventVolumeLabel` has always
  interpolated the number rather than calling `toLocaleString`, so de/fr/it/es/pt
  read "+3.33%", not "+3,33 %". This is pre-existing and unchanged.
- **The ramp value INPUTS** (`volume-ramp-value-{i}`, `promo-ramp-value-{i}`) still
  show `Math.round(v * 100) / 100`. They are an input's value, not a display label,
  and the rule appends a unit an `<input type="number">` cannot hold.
- **Two small wording changes came with repointing.** The retention clamp warning
  now signs a percentage ("+10%", where it read "10.0%"). A percentage that rounds
  to zero reads "0%" where the preview read "+0".
- **Mounted coverage of the summary is the Volume card's.** The Promotion card's
  summary sentence and its promotions table go through the same function, pinned
  at unit level in `events-summary`, but no mounted case drives a % promotion to the
  summary.
- **Binary rounding at exact halves**: a stored 1.005 is really 1.00499…, so it
  displays "+1%", not "+1.01%". This is inherent to doubles, and no ramp produces it.
- **Nothing was opened in a browser.** Every label is asserted in JSDOM, in
  English.
