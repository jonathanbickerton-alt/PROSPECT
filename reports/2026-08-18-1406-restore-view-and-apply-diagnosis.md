# Restore — the viewing bar, and a restored pricing event that does nothing

## FOR ADVISOR

```
Generated: 2026-08-18 14:06 +0100 (UTC 2026-08-18 13:06)
Verified against: 8cef2ea, branch main, tree clean (bar this report).
Repo: __PENDING__
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
BOTH OBSERVATIONS HAVE ONE ROOT CAUSE, AND IT IS NEITHER OF THE SUSPECTS.
  Jon's actual save file was on disk and read: every one of its 1,728 baseline
  rows carries Is_Active='No'. NOTHING was marked active at export.
A — ROOT CAUSE: the exporter marks active by comparing each STORE key to the
  live baseForecast's key (App.tsx:471). The store holds LEAVES; the active
  forecast was a DERIVED AGGREGATE, whose key is in no store row — so no row
  matched, and restore fell back to the FIRST store entry (:853) — SOHO /
  Mobile Voice / Medium Value / Direct / Field / RED M / SIM-only, EXACTLY the
  bar Jon saw, and confirmed as the file's first ForecastStore row.
  NEVER-WORKED. No view state is saved; the bar is set from the restored
  forecast's cohort via cohortToFilter, which is correct given a wrong pick.
B — NOT A DEFECT, and fully explained by A. The saved event is scoped
  Corporate / Mobile Voice / Direct; the restored cohort is SOHO. Segment
  mismatch, so the event correctly does not apply. A fresh event matches
  because it is made against whatever is loaded now.
THE HYPOTHESIS IS REFUTED, EXHAUSTIVELY: over all 46,656 combinations the
  shared predicate NEVER rejects what the retired seven accepted (0 cases); it
  is strictly MORE permissive (27,528). The residuals refactor cannot have
  caused this. c4e1f48 is exonerated.
FIFTH 'All' MARKER SITE — the aggregate-vs-leaf distinction again. Feeds DQ.
DECISIONS: 4 at close; the fix is one session (A alone; B needs nothing).
```

---

## Base check

`git rev-parse --short HEAD` → **`8cef2ea`**; the brief names `f6bd0b2`. One
commit apart, report-only. **Read-only: nothing changed, no gate run.**

**Jon's actual save file was available** —
`~/Downloads/PROSPECT Forecast Save — 17 Aug 2026 1211.xlsx` — and is read
throughout below. That turns most of this from inference into observation.

---

## Observation A — the viewing bar after restore

**Verdict: NEVER-WORKED. Not a regression, and not the view bar's fault.**

### The save carries no view state

There is no view-state sheet and no view fields in `Metadata` (which carries
`Active_Step`, the forecast period, and counts — nothing about the filter). So
restore cannot reproduce the bar; it must derive it.

### What sets the bar

`step2Filter` has **six** writers; exactly **two** are on the import path
([App.tsx:865](src/App.tsx:865) and [:928](src/App.tsx:928), the legacy branch),
and both are the same expression:

```js
setStep2Filter(cohortToFilter(bf.cohort));
```

So the bar is **the restored forecast's cohort**, translated by
`cohortToFilter` — which maps `'All' → null` on every dimension except segment,
correctly. The full seven-dim leaf Jon saw came from `bf.cohort` being a full
seven-dim leaf.

### Which forecast becomes `bf` — the actual defect

[App.tsx:853](src/App.tsx:853):

```js
const rawBf = activeBf ?? (restoredStore.values().next().value) ?? null;
```

`activeBf` is the row flagged `Is_Active='Yes'` ([:820](src/App.tsx:820)). **In
Jon's file, all 1,728 baseline rows carry `Is_Active='No'`** — measured, not
assumed. So `activeBf` is undefined and the fallback takes **the first entry in
the store**.

The file's first `ForecastStore` row is:

```
SOHO | Mobile Voice | Medium Value | Direct | Field / Regional Sales | RED M | SIM-only
```

— **exactly the slice Jon reported**. The mechanism is confirmed end to end.

### Why nothing was marked active

The exporter ([App.tsx:460-471](src/App.tsx:460)) iterates `forecastStore` and
writes:

```js
Is_Active: storeKey === activeForecastKey ? 'Yes' : 'No',
```

where `activeForecastKey` is built from the **live `baseForecast.cohort`**.

**The store holds leaves. The active forecast can be a DERIVED AGGREGATE** —
this codebase's whole aggregate architecture — and an aggregate's key is not a
store key. When the user is viewing an aggregate, `activeForecastKey` matches
nothing and **every row is written `'No'`**.

The file corroborates the reading: all 72 distinct cohorts carry concrete L2 and
tariff values, so there is no aggregate row in the store, and the pricing event
Jon made is scoped `Corporate / Mobile Voice / Direct` with `'All'` elsewhere —
the shape of exactly such an aggregate.

**So the save has no way to say "the user was looking at an aggregate", and
restore has no way to return them to it.**

### Smallest-scope fix

Record the active cohort **as a cohort, not as a flag on a store row** — one
`Active_Cohort_*` block in `Metadata` (or an `Is_Active` row that need not be a
store row), written from `baseForecast.cohort` whether or not it is a leaf, and
read on restore before the first-entry fallback. The fallback stays for files
that lack it.

**The fallback should also say what it did.** Silently landing on an arbitrary
leaf is the same class as the refusals this arc has been fixing: the app made a
choice the user cannot see. A one-line note — "restored the first available
cohort; the saved session did not record which was active" — turns a mystery
into a fact.

---

## Observation B — the restored pricing event

**Verdict: NOT A DEFECT. Correct behaviour, fully explained by A.**

### The event, read from Jon's file

```
Name: 'test dilution'   Month: 2026-08   Duration: recurring
Segment: Corporate | Product: Mobile Voice | Product_L2: All
Channel_L1: Direct | Channel_L2: All | Tariff_L1: All | Tariff_L2: All
Input_Mode: percentage | Amount: 6.666666666666665 | Target: cohorts
Cohort_Scope: retention | Pricing_Mode: dilution | 25 -> 20
Original_Base_ARPU: 24.72     (no Priced_Vol / Total_Vol — pre-dates f6bd0b2)
```

The restored cohort is **SOHO**. The event is **Corporate**. `segment` does not
match, so `eventScopeMatchesView` returns false and the event **correctly** does
not apply. A freshly created event applies because it is authored against
whatever is loaded now.

**The absent `Priced_Vol`/`Total_Vol` also confirm the compat branch shipped
yesterday is working exactly as designed** — the row renders from the cohort
path, which is what Jon observed.

### The hypothesis, refuted exhaustively

The brief proposed that the residuals refactor (`c4e1f48`) changed `'All'`
handling. **It did not, and the refutation is complete rather than
argumentative.** Both predicates were run over every combination of
`{undefined, null, '', 'All', 'X', 'Y'}` on three event dims and three view dims
— 46,656 cases:

```
retired ACCEPTS but shared REJECTS (would break restore):     0
shared ACCEPTS but retired REJECTED (strictly more permissive): 27,528
```

**Zero cases** where the new predicate rejects what the old one accepted. The
shared predicate is a strict superset: it additionally treats an **absent** dim
and a literal `'All'` **view** as wildcards. `c4e1f48` is exonerated, and the
refactor could not have caused a restored event to stop applying.

### What Jon would need to see for the event to bite

Load the cohort the event was made against — **Corporate / Mobile Voice /
Direct** (an aggregate over the Corporate·Mobile Voice·Direct leaves). At that
scope the event matches on every dimension and applies from 2026-08 onward.

**The one-look discriminator:** if the viewing bar reads SOHO after import, the
event is correctly inert; switch to Corporate / Mobile Voice / Direct and it
should bite. If it still does not bite there, that is a new finding and this
diagnosis is incomplete.

### The tooltip

Same predicate, same conclusion — a restored event out of scope is correctly
absent from the tooltip's list. No separate defect.

---

## Cross-check — the fifth `'All'` marker site

**Yes, this is a fifth.** EXPECTED.md records four sites of the same
marker-meaning distinction — legacy import, the retirement rule, the mirror
control, and the generate-button predicate — and argues for a single
mapped-dimension source of truth queued to DQ "rather than a fifth private
answer".

This is that fifth: **`Is_Active` assumes the active forecast is a store leaf**,
and an aggregate's `'All'` dimensions make its key un-matchable against store
keys. The failure is not in reading `'All'` wrongly; it is in a lookup that only
admits leaves. **It belongs in DQ's single-source-of-truth scope** rather than
being patched privately here.

---

## Classification and grouping

| Item | Verdict | Introduced |
|---|---|---|
| A — bar lands on an arbitrary leaf | **DEFECT, never-worked** | not a regression; `Is_Active` has always been leaf-only |
| A2 — the fallback is silent | **DEFECT, never-worked** | same |
| B — restored event inert | **CORRECT behaviour** | consequence of A |
| Predicate hypothesis | **REFUTED** | `c4e1f48` exonerated |

**One session**: A and A2 together — record the active cohort, read it on
restore, and say when the fallback fires. B needs no code.

---

## Decisions needed from Jon

1. **Record the active cohort as a cohort** (Metadata block) rather than a flag
   on a store row — confirm, since it changes the save format additively.
2. **Should the fallback announce itself?** Recommended, on the
   communicate-don't-silently-handle principle.
3. **Is this a DQ item or a now item?** It is the fifth marker site, and DQ owns
   the single source of truth — but the user-visible symptom is live today.
4. **Confirm B needs nothing**, once the one-look check above is done.

---

## Limits of this check

Read-only: no source changed, nothing run, no gate. `Verified against:` names
the commit rather than certifying it. Every source claim is cited by file and
line at `8cef2ea`; every claim about the save is read from Jon's actual file.

**The aggregate explanation for `Is_Active='No'` is inference, not observation.**
What is *observed* is that no row was marked active and that the store contains
only full-dimension leaves. That the active forecast was specifically the
`Corporate / Mobile Voice / Direct` aggregate is inferred from the event's scope
matching that shape — strongly suggestive, not proven. The fix does not depend
on which aggregate it was, only on the fact that an aggregate cannot be marked.

**Nothing was mounted or executed.** The predicate comparison ran the two
implementations in isolation, transcribed from current source and from
`c4e1f48^` — it exercises the logic, not the app.
