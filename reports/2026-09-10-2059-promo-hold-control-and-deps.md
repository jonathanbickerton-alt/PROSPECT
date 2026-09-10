# The promotion hold control, and the read-set rule enforced by the linter

```
FOR ADVISOR
Generated: 2026-09-10 21:59 +0100 (UTC 2026-09-10 20:59)
Certifies: a60e3a1 (the tree the gate ran against)

BASE 487e21b (code 477b171); HEAD 520735d. status --short EMPTY; diff
  477b171..HEAD -- src scripts test-data EMPTY. Both quoted in the body.
1 THE CONTROLS ARE NOT EXCLUSIVE — both <button type="button">, no
  radio/name/role. Mounted: after Hold the ramp control, its panel AND its
  "3" all survive (45/45). STOP on the fix half per 1.2; card unchanged.
2 WHAT READS AS A RADIO IS THE GLYPH: a rounded-full ring + white dot,
  twice, in one row. Volume same; CHURN uses real checkboxes. JON'S CALL.
3 LABELS DO NOT CHANGE WITH HOLD on any card: "Subscriber Volume (+/-)"
  states the hold-OFF reading while the help says TARGET. Both at once.
4 THERE IS NO ESLINT IN THIS REPO — lint is `tsc --noEmit`, no config, no
  dependency; the rule is not off/warn/error, it does not exist. TEN inert
  eslint-disable-line comments suppress it. Installed --no-save; measured
  34 (WhatIfTab 17, App 12, FvA 4, Compare 1) — >25, so 2.2's branch two.
5 ALL THREE POSITIVE CONTROLS RED, incl. B8's own promoHold: the rule
  WOULD have caught it before the walk did. §4.
6 CORRECTION: I began writing churnHold up as a live B8 twin. It is NOT —
  churnFold carries it transitively; 40/40 before and after. Listed anyway.
7 A VACUOUS GREEN CAUGHT: a scripted patch broke parsing; 0 meant 0 read. §6.
SHED: item 1's fix half (STOP, as briefed); item 2.2/2.3 entirely.
guard-traps 214/214 CAUGHT; full suite 67/67 GREEN (no spec added).
Repo: committed 7e95170, pushed (origin in sync); code at a60e3a1.
```

## 0. The base check

```
$ git status --short
                              (empty)
$ git diff 477b171 HEAD --stat -- src scripts test-data
                              (empty)
```

## 1. The two controls — measured

Both are plain buttons with independent togglers:

```tsx
<button type="button" onClick={() => setPromoSpreadEnabled(v => !v)} …>
  <span className="w-3.5 h-3.5 rounded-full border-2 …">
    {promoSpreadEnabled && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
  </span>{t('whatif_ramp_volume_over_multiple_months')}</button>

<button type="button" data-testid="promo-hold-toggle" aria-pressed={promoHold}
        onClick={() => setPromoHold(v => !v)} …>
  <span className="w-3.5 h-3.5 rounded-full border-2 …">
    {promoHold && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
  </span>{t('whatif_hold_after_ramp_label')}</button>
```

**No `type="radio"`, no `name=`, no `role="radio"`, no shared state.**

### Driven mounted — three assertions, not one

Added to `spec:promo-hold-mounted` case 1, which now clicks Ramp then Hold:

```
(1) EXCLUSIVITY: the ramp control is still present after Hold
(1) EXCLUSIVITY: the ramp DURATION input is still in the DOM
(1) EXCLUSIVITY: the ramp months value survived the Hold click   [3]
```

All green, **45/45**. "The toggle is still lit" would have been the weak
version; the panel still being mounted with its value intact is the strong one.

**So they are not exclusive, and per 1.2 I STOP on the fix half.** Nothing was
changed on the card.

## 2. What reads as a radio group — the styling, for Jon

The glyph is a **radio dot**: a `rounded-full border-2` ring containing a
`rounded-full bg-white` centre when selected. Two of them, side by side, in one
`flex flex-wrap items-center gap-2` row. That is the visual vocabulary of a
radio group, and nothing in the styling says "these are independent".

**The app has two idioms for the same kind of control:**

| card | ramp/spread control | hold control |
|---|---|---|
| **Volume** | `<button>` + round dot | `<button>` + round dot |
| **Promotion** | `<button>` + round dot | `<button>` + round dot |
| **churn** | `<input type="checkbox">` | `<input type="checkbox">` |

The churn card is the odd one out and is also the one that cannot be misread.

**This is Jon's call and I have not pre-empted it.** The obvious options are
(a) make all six checkboxes, (b) make the two button-pairs square-ticked rather
than round-dotted, (c) leave it. I have not built any of them.

## 3. Wording — measure only

**No label changes when Hold is on.** Measured across all three cards: no
amount label, and no caption beside one, is conditional on `holdAfterRamp`,
`promoHold` or `churnHold`. The only hold-conditional text anywhere is the help
line itself.

| card | amount label (Hold off **and** on) |
|---|---|
| **Volume**, absolute | `Subscriber Volume (+/−)` |
| **Volume**, percentage | `Change to {scenario}` |
| **Promotion**, absolute | `Acquisition Volume` / `Retained Volume` |
| **Promotion**, percentage | `Volume change (% of the forecast)` |
| **churn** | `Reduce by (points)`, grid column `Cumulative pts` |

The hold help line, the only place the reading is stated:

> **Hold after ramp** — *"The amount you enter is the TARGET. The ramp builds
> up to it, then every later month holds it."*

**So the labelling says "total" and the help says "target", simultaneously.**
`Subscriber Volume (+/−)` and `Reduce by (points)` both describe the hold-OFF
reading; under Hold the same box means a level reached. That is the substance
for a wording brief, and I have changed nothing.

## 4. exhaustive-deps — there is no linter

**`npm run lint` is `tsc --noEmit`.** There is no `eslint.config.*`, no
`.eslintrc*`, and no `eslint` dependency in `package.json` or `node_modules`.
So the rule is not off, not warn and not error: **it does not exist here.**

**And ten `eslint-disable-line react-hooks/exhaustive-deps` comments sit in
`src/`** — 7 in `App.tsx`, 3 in `WhatIfTab.tsx` — suppressing a rule that has
never run. The codebase believes it has this check.

I installed `eslint@9`, `eslint-plugin-react-hooks@5` and `typescript-eslint`
**with `--no-save`**, so `package.json` is untouched, and ran the rule at
`error` over `src/`.

### The positive controls — all three red

**Control 1 — the churn fold's deps replaced with `[setNewEvent]`** (the
historical shape):

```
4106:6  error  React Hook useMemo has missing dependencies:
  'churnScopeResolution?.forecast', 'churnScopeSeries', 'churnStatedWithHold',
  and 'newEvent.date'
```

**Control 2 — `handleEditStart` back to `[setNewEvent]`**:

```
4604:6  error  React Hook useCallback has missing dependencies:
  'clearChurnDraft', 'marketEvents', and 't'
```

`marketEvents` is exactly the read whose omission made the ramp-member decline
never fire in the app. *(The file's violation count stays 17 here rather than
rising, because this site is already among the 17 for a different missing dep —
what changes is the message.)*

**Control 3 — B8's own defect, `promoHold` removed** (trap 217's mutation):

```
4040:6  error  React Hook useCallback has missing dependencies:
  'fullTariffTree', 'promoDilutionBlockReason', 'promoHold',
  'promoMixBlocksSave', and 'selectedTariffs'
```

**The rule names `promoHold`. It would have caught B8 before the walk did.**

Each control was planted against a scratchpad backup and restored to
`33d026ac85ab60b6e53541d77713c9bf`.

### The count

| file | violations |
|---|---|
| `src/components/WhatIfTab.tsx` | **17** |
| `src/App.tsx` | **12** |
| `src/components/ForecastVsActualsTab.tsx` | **4** |
| `src/components/ScenarioCompareTab.tsx` | **1** |
| **TOTAL** | **34** |

**34 > 25**, so 2.2's second branch applies.

## 5. A correction I am making before it reaches you as a finding

I saw `churnHold` named at three sites — `handleAddMarketEvent`,
`handleSaveCampaign`, `handleSaveEdit` — and wrote it up as **a live B8 twin on
the churn carrier**. Then I checked, and **it is not live.**

`churnFold` **is** in all three lists, and its identity changes whenever
`churnHold` does:

```
churnHold  ->  churnStatedWithHold  ->  churnFold
```

so the handler was already being rebuilt. **Measured:
`spec:churn-hold-mounted` drives Hold LAST and was 40/40 before the change and
40/40 after.** B8's promotion twin was live precisely because *nothing* carried
`promoHold` into that list.

**I listed the dependency anyway**, with that reasoning at the line: a
transitive rescue is a coincidence of the current memo chain, not a guarantee.
Shorten the chain and the promotion defect reappears here.

That is the only `src/` change this session.

## 6. What I could not finish, and why

**A scripted patch corrupted the file and produced a vacuous green.** I wrote a
patcher to append each named dependency from the rule's own output. It skipped
four multi-line arrays, mangled line 3521, and eslint then reported
`Parsing error: Unterminated string literal` — after which it reported **0
violations**, because it had stopped parsing.

**The 0 was the vacuous-result trap, exactly.** I checked whether `churnHold`
had actually reached the three arrays rather than trusting the count, found it
had not, and restored from the scratchpad backup to
`33d026ac85ab60b6e53541d77713c9bf`.

**With the remaining budget I chose to shed scope rather than the record**, and
to hand-fix only the site with a real argument behind it.

## Gate

| check | figure |
|---|---|
| `npm run suite` | **67/67 green** |
| guard-traps | **214/214 caught** — 0 MISSED, 0 INCONCLUSIVE, 0 CRASHED |
| `spec:promo-hold-mounted` | **45 passed, 0 failed** |
| `spec:churn-hold-mounted` | **40 passed, 0 failed** |
| `spec:trap-anchors` | **226 passed, 0 failed** (214 traps, 221 anchors) |
| `spec:i18n-parity` | **200 passed, 0 failed** |
| `spec:survival` | **27 passed, 0 failed** — 104 dereferences across 26 files |
| `tsc --noEmit` / `lint` | clean |
| `npm run build` | built in 6.72s |

### Exact counts the brief named

| pin | required | measured |
|---|---|---|
| `runIngest` sites | 3 | **3** |
| last-column, Market / Yield / Pricing | 3 / 2 / 3 | **3 / 2 / 3** (`spec:event-toggle` 155/155) |
| apply sites | 12 | **12** |
| display markers | 6 | **6** |

## What was shed

**Item 1's fix half — correctly, by the brief's own instruction.** The controls
are not exclusive, so 1.2 says report the styling and STOP. Done; §2.

**Item 2.2 and 2.3 — the ESLint wiring, the remaining 31 violations, and trap
220 — are SHED to a follow-up.** Nothing is half-applied: `package.json` is
untouched (the install was `--no-save`), no config file was added, `npm run
lint` is unchanged, and the only `src/` edit is the three-site dependency
listing in §5.

**What the follow-up starts from, all measured here:**

- add `eslint`, `eslint-plugin-react-hooks`, `typescript-eslint` as
  devDependencies and an `eslint.config.mjs`; point `npm run lint` at both
  `tsc` and `eslint`;
- **34 violations to clear**: WhatIfTab 17, App 12, ForecastVsActualsTab 4,
  ScenarioCompareTab 1;
- **two structural blockers first**, both of which I proved reduce the count on
  their own: `fullTariffTree` is `tariffTree ?? new Map()` — a fresh map every
  render, which the rule names as *"could make the dependencies … change on
  every render"* — and `BLANK_EVENT` is a fresh object literal per render.
  Memoising both took WhatIfTab from **17 to 15** in the attempt above;
- **10 inert `eslint-disable-line` comments** to audit rather than inherit —
  each was written against a rule that never ran, so none has been justified by
  a real red;
- trap 220: the rule set back to warn/off, asserted by a planted missing dep
  surviving the gate.

## Limits

- **The ESLint install was `--no-save` and is not committed.** A follow-up must
  install it properly; nothing in the repo depends on it today.
- **The 34 figure is one rule at one severity** over `src/` only. `scripts/`
  was not linted.
- **§5's "not live" claim rests on the current memo chain** and on one mounted
  drive with Hold last. A different drive order, or a change to
  `churnStatedWithHold`, could make it live — which is why the dependency is
  listed rather than argued away.
- **Nothing was run against a browser.** §1's exclusivity is asserted in JSDOM;
  §2's styling claim is read from the class names, not from a screenshot.
- **No i18n keys changed**, and no user-facing copy changed.
