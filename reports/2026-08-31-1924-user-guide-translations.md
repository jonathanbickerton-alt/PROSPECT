# User guide — five translations brought to parity with the frozen English

## FOR ADVISOR

```
Generated: 2026-08-31 19:24 +0100 (UTC 2026-08-31 18:24)
Certifies: de975a7 (report filled one commit later)
Repo: committed de975a7, pushed (origin in sync)
SKELETON FIRST. BASE: HEAD 34024e8 vs 1847's 4297026 — one, REPORT-ONLY.
ALL FIVE LANGUAGES DONE — nothing shed. de, es, fr, it, pt each at 8 sections,
  TOC 1–8, glossary parity, balanced markup, rendered and picker-checked.
THE ENGLISH IS BYTE-IDENTICAL, PROVED: sha1 d564f78b… before and after,
  asserted at entry AND exit of every one of the nine edit scripts.
THE HEADLINE FINDING IS AN APP i18n GAP, NOT A GUIDE PROBLEM: of the 76 locale
  keys the guide quotes, ZERO are missing but FIFTY are byte-identical to
  English in all five locales. The app does not translate them — spread
  controls, tab names, pricing targets, One-Off/Recurring, Preview/Baseline
  ARPU, most compare_*, export/import, the bulk-complete modal, skip reasons.
  Only 26 genuinely translate (the churn family, dilution notes, pricing modes,
  three compare strings, import_save). Recorded, NOT fixed — no source changes.
SO THE GUIDES QUOTE THOSE STRINGS IN ENGLISH, because that is what a German or
  Portuguese user sees. Each translated block gains a note saying so, mirroring
  how the English already handles Subs / % and the window sizes.
ONE PARITY DEFECT CAUGHT LATE, in four languages: the Custom Promotion tail
  still said "ramp and decay" — it sits AFTER the splice point, so the step-2
  rewrite did not reach it. Found by a stale-string sweep, fixed in es/fr/it/pt
  (de was written by hand and already correct).
NO ENGLISH DEFECT SURFACED. The English master needed no correction.
NO GATE RUN — documentation only, no source file touched. Last gated state
  remains 4a1d110.
```

---

## Base check

`HEAD` **`34024e8`**; the 1847 report's Repo line names **`4297026`**. One commit
apart, `--stat` confirms **report-only** (its own Repo-line fill). **No source
drift**, so the brief's STOP condition did not fire.

## The frozen English — SHA before/after

```
BEFORE (at session start):  d564f78b32aa31abbc9904909c1b8aa3fa654017   55,296 chars
AFTER  (at session end):    d564f78b32aa31abbc9904909c1b8aa3fa654017   55,296 chars
```

The block runs from `<div class="doc" data-lang="en"` to the start of
`data-lang="de"`. **Every edit script asserts that hash on entry and again on
exit**, so a stray edit fails the script rather than reaching the file — the
1847 pattern, inverted.

Nine scripts ran: German (structure, then glossary), Spanish (structure ×2),
the generic updater for French, Italian and Portuguese, and the promotion-tail
correction. All nine passed both assertions.

## Per-language status

| Lang | Sections | TOC | Glossary | Δ chars | Status |
|---|---|---|---|---|---|
| **en** | 8 | 1–8 | 50 | — | **frozen master, untouched** |
| **de** | 8 | 1–8 | 50 | 34,136 → 61,260 | complete |
| **es** | 8 | 1–8 | 50 | 33,362 → 58,845 | complete |
| **fr** | 8 | 1–8 | 50 | 35,006 → 61,768 | complete |
| **it** | 8 | 1–8 | 51 | 34,424 → 60,415 | complete |
| **pt** | 8 | 1–8 | 49 | 34,032 → 57,501 | complete |

**Nothing was shed.** The glossary counts differ because the source blocks did:
Italian started with 40 terms and Portuguese with 38, against 39 elsewhere. Each
had one Decay entry removed and 12 added, so 40−1+12 = 51 and 38−1+12 = 49 are
the arithmetic, not an omission.

Each language received: the four-tab restructure with the pipeline-order note;
the corrected spread section replacing ramp-and-decay; the forced-sign outflow
note; churn mode in full (readout, formula, absence-with-a-reason, points,
single vs ramp, the editable cumulative trajectory, what gets created, the edit
routes, the Δ direction-of-effect); the Value/yield card; the Pricing card in
full; retention dilution; editable ARPU; the events summary; a new Scenario
Compare section; the expanded save section; the generation-complete modal; and
the twelve glossary additions with Decay removed and Ramp rewritten.

## Locale keys resolved — and the finding

All 76 keys the guide quotes were resolved in all six locale files at the base
commit.

**No key is missing from any locale.** But **50 of the 76 are byte-identical to
the English string in every one of de/es/fr/it/pt** — the app renders them in
English whatever language is selected.

| | keys missing | identical to English |
|---|---|---|
| de | 0 | 50 |
| es | 0 | 50 |
| fr | 0 | 52 |
| it | 0 | 50 |
| pt | 0 | 50 |

**Genuinely translated (26)** — the churn family (`whatif_churn_current`,
`_breakdown`, `_target`, `_ramp`, `_months`, `_points`, `_derived`,
`_default_campaign`, `_member_no_edit`, `_mode`, `_block_no_forecast`, the four
`_absent_*`), the dilution notes, `whatif_pricing_mode_direct`/`_dilution`,
`whatif_pricing_block_no_forecast`, `compare_chart_too_short`,
`compare_events_scope_not_in_baseline`, `compare_events_per_file`,
`import_save`.

**Untranslated (50)** — every spread control; the four tab names; the three
pricing targets; `whatif_one_off`/`_recurring` and both duration sentences;
`whatif_preview_impact`/`_baseline_arpu`; `whatif_target`; the three Add
buttons; `whatif_edit_event`/`_edit_campaign_event`/`_save_changes`;
`whatif_roll_forward…`/`_roll_fwd`; `whatif_events_this_month`;
`whatif_subscriber_volume`; most of `compare_*`; `common_export_session`,
`common_export_to_excel`, `common_import_actuals`; all five
`bulk_complete_*`; and `skip_reason_insufficient_history`.

French has **two extra**: `whatif_dilution_current` and `whatif_dilution_target`
are also identical to English there, though translated in the other four.

**This is an application gap, recorded and not fixed** — the brief forbids
source changes, and closing it is a locale-sweep session of its own.

### What it meant for the translations

The brief requires every quoted string to come verbatim from that language's
locale file. Applied faithfully, most quoted strings therefore stay **English**
in the translated guides, because that is what the user sees on screen.

Each translated block gains one note saying so — for example the German:

> *Teile der Anwendung sind noch nicht übersetzt. Bedienelemente, deren
> Beschriftung in dieser Anleitung englisch wiedergegeben ist … erscheinen auch
> in der deutschen Oberfläche englisch.*

This mirrors how the English master already handles **Subs / %** and **All Time
/ 6M / 12M / 18M / 24M**, which are hardcoded literals rather than locale keys
and so render in English everywhere. Inventing translations the app will never
show would have made the guide wrong in a way the reader could not detect.

## English defects surfaced

**None.** The English master was not corrected and no claim in it was found to
be wrong while translating. The one thing translating did surface was a defect
in the *translations*, below.

## The parity defect the sweep caught

After all five languages were applied, a stale-string sweep found that the
**Custom Promotion tail still said "ramp and decay"** in Spanish, French and
Italian — and would have in Portuguese too.

The cause is structural and worth recording: the per-language script replaces
Step 2 **up to the final `<h3>`**, which is the Custom Promotion heading, and
splices the original tail back. That tail contains one sentence about the
promotion's volume that the English master had corrected. It sat past the splice
point, so the rewrite never reached it.

German escaped because its Step 2 was written out by hand further down, through
the promotion section.

Fixed in all four, matched by **regex with a tolerant apostrophe class** rather
than a typed sentence — the first attempt used typed text and silently failed to
match French, which uses straight apostrophes where the others use curly ones.
That is the same species of failure the brief's own SHA discipline guards
against: an edit that does nothing and reports success. The script now reports
and skips rather than guessing when a pattern does not match exactly once.

## Render check

Driven in the browser, switching the picker through all six languages:

```
lang  shown  html[lang]  sections  TOC        compare §  glossary  console
en    en     en          8         12345678   yes        50        no errors
de    de     de          8         12345678   yes        50        no errors
es    es     es          8         12345678   yes        50        no errors
fr    fr     fr          8         12345678   yes        50        no errors
it    it     it          8         12345678   yes        51        no errors
pt    pt     pt          8         12345678   yes        49        no errors
```

The last three TOC entries read correctly per language — *Szenarienvergleich /
Ihre Arbeit sichern / Glossar*, *Comparación de escenarios / Guardar su trabajo
/ Glosario*, *Comparaison de scénarios / Enregistrer votre travail /
Glossaire*, *Confronto di scenari / Salvare il lavoro / Glossario*,
*Comparação de cenários / Guardar o seu trabalho / Glossário*.

Markup balance was checked per block: `<section>`, `<div>` and `<aside>` open
and close evenly in all six.

## Gate

**No gate was run, and no source file changed** — the commit is one HTML
document and this report.

```
guard-traps:             NOT RUN
specs:                   NOT RUN
lint (tsc --noEmit):     NOT RUN — nothing it could check changed
build:                   NOT RUN
render check (browser):  PASS — six languages, no console errors
```

**This report certifies no test state.** The last gated state remains
**`4a1d110`**.

## Limits of this check

**The translations are mine, not a native reviewer's.** They follow each
block's existing register — formal *Sie*, *usted*, *vous*, *voi*, and European
Portuguese — and reuse the terminology already present in the untouched
sections. They have not been read by a native speaker, and the business users
named in the working agreement are the right reviewers for the German.

**Terminology was matched to each block's existing choices, not standardised
across languages.** German says *Abwanderung* for churn because its locale
strings do; Italian says *abbandono*; Portuguese *rotatividade*. That is
deliberate — the guide should read like the app the reader is using.

**Only the sentence-level claims were verified against code**, and they were
verified once, in English, during the 1847 session. This session translated a
frozen master rather than re-deriving its claims; if a claim is wrong in
English it is now wrong in six languages.

**The stale-string sweep covered the ramp/decay family only.** It was aimed at
the one correction most likely to survive a splice. A different stale claim
sitting past a splice point would not have been caught by it — the structural
lesson is recorded above, but the sweep was not exhaustive.
