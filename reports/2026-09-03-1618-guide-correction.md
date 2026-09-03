# Guide correction — the 1005 §5 note; and the §16b alias check

## FOR ADVISOR

```
Generated: 2026-09-03 16:18 +0100 (UTC 2026-09-03 15:18)
Verified against: HEAD 89f68a9, branch main, tree CLEAN — NO source changed.
Repo: committed 89f68a9, pushed (origin in sync)
Last gated commit: 2ecdefb. No gate — docs only.
STOP FIRED AND IS REPORTED, NOT OBEYED: the test-data/ drift is commit
  0b72574, the previous session's audit entries, and the brief's own BASE line
  names that commit. src/, scripts/, package.json: ZERO drift.
ITEM 0 — §16b EXISTS and is SOMETHING ELSE, so :7148 is left untouched. Three
  things wear the label: EXPECTED:7893 "Known coverage gaps — cannot be
  measured on the current fixtures"; EXPECTED:2067, a record of an agent
  MIS-CITING a defect as §16b and calling it "out of bounds as a source for
  anything"; and v3.3.1–v3.3.6's "§16b per-cohort ancestry denominator".
CORRECTION TO 1601: it said "'ancestor' appears in no working-agreement
  version" — literally true, misleading: "ancestry" appears, in that shelved
  line. Verdict unchanged; the search was narrower than the sentence said.
§5 BEFORE: "...The Events summary's ARPU delta and the Pricing card's Baseline
  ARPU still read it." BOTH claims wrong, differently: the Pricing baseline no
  longer reads the blend (Q3), and the Events summary delta NEVER read it —
  EventSummaryRow carries no delta. REMOVED, not replaced: a per-scenario
  delta there would be a second false sentence in the same place.
§5 AFTER states the mapping read from pricingBaselineArpu at 2ecdefb, sums as
  revenue-over-volume NOT an average; 7 phrases keyed in the report.
TAIL: sha1 3949eb15… / 301,169 chars, IDENTICAL either side; the script refuses
  to write on mismatch and asserts the anchor precedes the tail. RENDER COUNTS
  unchanged in all six: en 8/44/25, the other five 8/38/22.
```

## Base check

HEAD `12546f0` (this session's skeleton) on `main`, tree clean at entry.
No source changed; last gated commit `2ecdefb`, no gate run.

### The STOP condition fired, and is reported rather than obeyed

`git diff --stat 2ecdefb..HEAD -- src/ scripts/ test-data/ package.json` is
NOT empty: `test-data/EXPECTED.md`, 97 insertions.

That drift is exactly one commit — `0b72574`, the record audit's four entries,
written and pushed by the immediately preceding session. `src/`, `scripts/` and
`package.json` have **zero** drift.

**The brief's own BASE line names `0b72574`**, which is the commit containing
this drift, while its STOP is scoped to `test-data/` from `2ecdefb`. The two
disagree with each other. Proceeding is the reading that makes them consistent:
the STOP exists to catch unexplained drift, and this is the previous session's
recorded work, fully accounted for. Flagged rather than absorbed silently.

## Item 0 — the §16b search

**§16b EXISTS, and it is NOT the filter-scoped fallback.** Three different
things wear the label across the corpus:

| where | what §16b is |
|---|---|
| `EXPECTED.md:7893` | `## 16b. Known coverage gaps — cannot be measured on the current fixtures` |
| `EXPECTED.md:2067-2071` | a record that an agent MIS-CITED a defect as §16b |
| working agreement v3.3.1–v3.3.6 | a backlog line: *"§16b per-cohort ancestry denominator SHELVED"* |

The mis-citation entry is worth quoting, because it is this same confusion
already on record:

> The agent cited the aggregate defect as **§16b**. It is not. §16b is *"Known
> coverage gaps — cannot be measured on the current fixtures"*, and it is
> **out of bounds as a source for anything** by standing rule. The entry it
> meant is in §16, at the line it correctly quoted alongside the wrong section
> number.

**Per the brief, the UNRECOVERABLE entry at `:7148` is left exactly as it
stands** — §16b exists but is something else, so no cross-reference was added.

### A correction to my own previous report

The 1601 report states that *"the string 'ancestor' appears in no
working-agreement version at all."* That is literally true and materially
misleading. **"ancestry" appears** — in the shelved §16b backlog line above,
"per-cohort ancestry denominator". My search was for the exact string
`ancestor`, and `ancestry` does not contain it.

A reader hunting the nearest-populated-**ancestor** item would want to know that
the nearest term in the corpus is a shelved denominator item, not a rejected
proposal. The verdict does not change — that line is a backlog entry about an
accuracy denominator, not a rejection — but the search was narrower than the
sentence implied, and the sentence should have said so.

Recorded here rather than by amending the entry, because the brief said to leave
the entry as it stands.

## Item 1 — the guide

English block only (lines 119–393). The `de` block begins at line 394.

### The §5 note BEFORE, verbatim

> **Where the blended figure is still used** — The blended ARPU is retired from
> the chart, not from the application. The Events summary&rsquo;s ARPU delta and
> the Pricing card&rsquo;s Baseline ARPU still read it. Those are recorded as
> pending decisions rather than oversights, and this guide describes them as
> they are built.

**Both of its claims are now wrong, and in different ways.** The Pricing card's
Baseline ARPU no longer reads the blend (Q3, `20799e3`). The Events summary's
ARPU delta never read it, because **it does not exist** — `EventSummaryRow`
carries `id, pass, card, name, unnamed, adjusts, scope, when, month` and no
delta of any kind.

### The §5 note AFTER, verbatim

> **Where the blended figure went** — The blended ARPU is retired from the chart
> and from every display in the application. The Pricing card&rsquo;s
> **Baseline ARPU** — in **Preview Impact** and on the saved row — is the
> per-scenario figure for the subscribers the event applies to. **Cohorts Only**
> reads Inflow ARPU or Retention ARPU according to the **Applies to** selection,
> and **Both** combines the two as total revenue over total volume rather than
> as an average of the two rates; **Base Only** reads Base ARPU;
> **Cohorts + Base** combines all three the same way. Where a scenario has no
> fitted ARPU the figure is shown as absent rather than as zero. The blended
> column remains in the exported workbook so that files already in circulation
> keep their shape, but nothing on screen reads it.

**The Events summary claim is removed, not replaced.** Writing "the Events
summary shows a per-scenario delta" would have been a second false sentence in
the same place.

### Corrected from source, not from the previous guide

The mapping is read from `pricingBaselineArpu` (`forecasting.ts`) at `2ecdefb`,
not from the working agreement's summary of it:

| control | reads |
|---|---|
| Cohorts Only + Applies to Inflow | Inflow ARPU |
| Cohorts Only + Applies to Retention | Retention ARPU |
| Cohorts Only + Applies to Both | Σ revenue / Σ volume over the two |
| Base Only | Base ARPU |
| Cohorts + Base | Σ over the three |

"Rather than as an average of the two rates" is in the guide because the
function is explicit that sums are revenue over volume and never a mean — the
error a reader would otherwise make unaided.

### Every user-visible phrase, with its key

Read from `src/locales/en/translation.json` at `2ecdefb`:

| phrase | key |
|---|---|
| Baseline ARPU | `whatif_baseline_arpu` |
| Preview Impact | `whatif_preview_impact` |
| Cohorts Only | `whatif_cohorts_only` |
| Cohorts + Base | `whatif_cohorts_base` |
| Base Only | `whatif_base_only` |
| Applies to | `whatif_applies_to` |
| Both | `whatif_both` |

**Inflow, Retention and Base are identifiers, not display strings** — the app
renders the scenario pills as `{kpi}`, unkeyed — so they are written raw and are
not quoted as UI labels.

## Item 2 — the translated tail and the render check

The edit script hashes everything from `<div class="doc" data-lang="de" hidden>`
onward, at entry and at exit, and **refuses to write** if the two disagree. It
also asserts the note being replaced sits BEFORE that boundary, so an anchor
that ever matched inside a translated block would fail rather than edit it.

```
translated tail BEFORE: sha1 3949eb152b1349afc29af44b33c4cd493d94d380  chars 301169
translated tail AFTER : sha1 3949eb152b1349afc29af44b33c4cd493d94d380  chars 301169
```

Identical. Six-language render check, before and after:

| lang | h2 | h3 | aside |
|---|---|---|---|
| en | 8 | 44 | 25 |
| de / es / fr / it / pt | 8 | 38 | 22 |

Unchanged in every language. The English block legitimately carries six more
`h3` and three more `aside` than the others — that is the 1005 addendum, which
has not been translated.

## Limits of this check

- **The guide is not rendered.** Section counts and the tail hash are structural;
  nothing opened the file in a browser, so layout and the language switcher are
  unverified.
- **The English/translated divergence is now larger.** The addendum was already
  untranslated; this correction adds to what a translation pass must carry, and
  the counts above quantify the gap rather than closing it.
- **Item 0 searched for the literal strings `16b` and `§16`.** A reference by
  another name would not have been found — which is precisely the failure the
  "ancestor"/"ancestry" correction above records.
- No gate: no source changed.
