# The rival line formats its months

```
FOR ADVISOR
Generated: 2026-09-09 21:13 +0100 (UTC 2026-09-09 20:13)
Certifies: 1254aff
Repo: committed 1254aff, pushed (origin in sync)

BASE f252700 + 6201c2b (reports/ ONLY fill). 0 DOCS 6eee37d, verbatim.
1 TWO LINES, JSX :9027/:9029 via fmtMonth :2059 (the delta selector's own
  wrapper); memo keeps RAW keys; no new key/locale/engine; SPEC RED FIRST.
2 GATE serial: suite 61/61, guard-traps 194/194 CAUGHT (0 M/I/C; 198 resolves),
  evt 153, mounted 208, anchors 206, survival 27, i18n 200, ai-hold 13, clean.
```

## 0. Docs

`6eee37d` appended D5-13's closing paragraph verbatim — `CLOSED f252700; walked
by Jon 2026-09-09 on the 09 Sep 19:30 save at SOHO / Mobile Voice…` — alongside
this session's skeleton, and nothing else. Pushed before any code.

## 1. The change

**Two lines, both in the JSX** (`WhatIfTab.tsx:9027` and `:9029`):

```tsx
month: fmtMonth(yieldPreview.rival.month),
first: fmtMonth(yieldPreview.rival.firstWin) })}
```

`fmtMonth` is the existing memoised wrapper at `:2059`
(`monthLabel(m, i18n.language)`) — the same one the delta selector (`:5286`)
and the three KPI tooltips (`:5293`, `:5305`, `:5314`) already use. **No new
key, no locale file touched, no engine change.**

**Formatted at render, not in the memo — deliberately.** `yieldPreview` keeps
raw `YYYY-MM` keys because they are what the engine compares (`yieldWinnerAt`
looks up `arpuIdsByMonth` by key, and `firstWin` is *found* by walking the
series). Formatting inside the memo would put a locale in the middle of a month
comparison, and it is exactly the value trap 198 mutates. Its anchor —
`const winnerHere = yieldWinnerAt(wanted);` — is untouched and still resolves.

Rendered, in `en`:

```
Feb 2026: 'first saved' applies instead · this event applies from Mar 2026
```

## The assertion

**The mounted spec went red on the change before I edited it** — 206/208, both
D5-13 month checks failing on the formatted text. That is the check doing its
job, and it is worth recording that it was not silently updated ahead of the
build.

The two `includes(MONTHS[n])` checks are replaced by:

- one that pins **the whole rendered sentence**, written out as a literal
  rather than re-derived through `monthLabel`. An assertion built from the
  function it is checking passes whatever that function does, which is precisely
  how a formatter change becomes invisible;
- one that asserts **neither raw key** (`2026-02`, `2026-03`) reaches the
  sentence — the failure mode being fixed, pinned directly rather than implied.

The superseded-line check was widened in the same spirit: it now asserts the
line names no month **raw or formatted**.

Count unchanged at **208/208** — two checks replaced two, one replaced one.

## 2. Gate

Run **serially**; guard-traps to a file in the scratchpad, one instance.

| check | result |
|---|---|
| suite | **61/61 green** |
| guard-traps | **194/194 CAUGHT** — 0 MISSED, 0 INCONCLUSIVE, 0 CRASHED |
| trap 198 | **still resolves and still catches** — its anchor was untouched |
| event-toggle | 153/153 |
| view-apply-mounted | **208/208** (unchanged count; two checks replaced two) |
| trap-anchors | 206/206 — 194 traps, 201 anchors |
| survival | 27/27 |
| i18n-parity | 200/200 |
| ai-hold | 13/13 |
| tsc / lint / build | clean |

**No new trap, no pin moved, nothing re-aimed.**

## Limits

- **English only, asserted.** The other five locales carry the same
  `{{month}}`/`{{first}}` params and will format through the same call, but
  nothing mounts them; `i18n-parity` proves the keys exist, not that a German
  month renders correctly in this sentence.
- **`monthLabel` itself is unpinned by this session.** The literal
  `"Feb 2026"` pins what the sentence shows; whether `monthLabel` is right for
  every locale is `monthFormat`'s own question and is not re-checked here.
- **No new trap.** The brief asked for none, and the change is two call
  wrappers; trap 198 already guards the value being formatted, and the mounted
  assertion is what would catch a regression to raw keys.
