# D5-10 second half — display, auto-clear and Compare

```
FOR ADVISOR
Generated: 2026-09-09 13:24 +0100 (UTC 2026-09-09 12:24)
Certifies: fb51506 (the tree every figure below was measured on)
Repo: committed fb51506, pushed (origin in sync)

BASE 7850298 + 2afc6f2 (reports/ ONLY; ZERO drift). Premise lines all held.
1 LABEL: ONE helper `tariffAllLabel`, asking tariffScopeFor — the SAME
  function the save asks, so the control cannot lie about the save. New
  `allLabel` prop on HierarchicalDropdown; 3 controls read it. SCOPE column:
  scopeOf gains a 3rd arg and APPENDS " (RED L, RED M)"; COMPARE'S PANEL GETS
  IT FREE, its rows coming via marketEventFromRow — the builder DOES see it.
2 AUTO-CLEAR: Volume and Pricing WERE structural copies; retired into ONE
  hook `useClearTariffOnDeselect`, THREE callers, Promotion the third.
3 COMPARE: NO STOP — its leaves carry tariffL1 (sh:62). scopeOf + 3 match
  sites parse via the ONE tariffScopeFromRow; the 4th is YIELD, unchanged.
4 SPEC 136 -> 146: Compare through the REAL engine, the label from the DOM;
  a NaN fixture bug caught by discriminate-first, not shipped green.
  TWO STAYED GREEN FIRST — 185 needed a Compare WEIGHTING case, 187 a DOM read.
  until the label was read from the DOM — the trap-183 lesson, twice more.
6 GATE: guard-traps 183/183 CAUGHT, 0 MISSED/INCONC/CRASHED, restored. suite
  61/61, event-toggle 146/146, view-apply 177/177, anchors 195/195, survival
  104/26 + 27/27 (RED on my own spec; GUARDED, not re-baselined), i18n 200/200
  (875 x 6, +1 key), ai-hold 13/13, tsc 0, lint and build clean.
ADDENDUM STOPPED at its item 1: the VALUE CARD HAS NO TARIFF CONTROL and its
  emitter writes NO tariff dim; two readings there. SITES stays 9; no trap 188.
```

## Base and record

`git log --oneline -1` read `2afc6f2` — `7850298` plus one reports-only fill
commit; `git diff 7850298 -- src/ scripts/ test-data/ package.json` empty.

Premise line numbers from report 1232 re-checked and held: `tariffScopeAdmits`
`fc:560`, `tariffScopeFromRow` `fc:593`, `tariffScopeFor` `fc:605`,
`targetTariffTree` `WIT:2003`, Compare's match sites `sh:223/369/431/495`, its
weighting `sh:131` and `sh:252`, `scopeOf` `sh:112`.

Appended to D5-10 (`cfcdd68`), dated, no new decision: which clauses landed in
which half, and that the first half's report named the gap while it stood.

## 1. Display

**One helper, asking the same question the save asks.**

```ts
const tariffAllLabel = useMemo(() => {
  const scope = tariffScopeFor('All', selectedTariffs, [...fullTariffTree.keys()]);
  return scope ? t('whatif_tariff_all_in_scope', { list: scope.join(', ') }) : undefined;
}, [selectedTariffs, fullTariffTree, t]);
```

It calls **`tariffScopeFor`**, not a copy of the strict-subset rule, so the
control says "All in scope (…)" exactly when a save would record that scope. A
label with its own copy of the rule would drift from the event the user then
saves — which is the same class of defect as the finding itself.

`undefined` means "no override", so the dropdown falls back to its own
`t('hierdrop_all')` and nothing changes when the selection is not a subset.

**Threaded by one new prop.** `HierarchicalDropdown` gains `allLabel?: string`,
used at both places it renders "All" — the collapsed button (`:197`) and the
list row (`:250`). The three Tariff controls pass `tariffAllLabel`; every other
caller is untouched and keeps `t('hierdrop_all')`.

**Six locales**, key `whatif_tariff_all_in_scope`, 874 → **875** per locale:

| | |
|---|---|
| en | All in scope ({{list}}) |
| de | Alle im Geltungsbereich ({{list}}) |
| es | Todos los del ámbito ({{list}}) |
| fr | Tous ceux du périmètre ({{list}}) |
| it | Tutti quelli nell'ambito ({{list}}) |
| pt | Todos os do âmbito ({{list}}) |

All six differ from English, so no ALLOW entry was needed and `i18n-parity`
stayed at 200/200.

**The SCOPE column.** `scopeOf(dims, t, tariffScope?)` in `forecasting.ts`
appends `" (RED L, RED M)"` to the text it already produced, at all three
callers (market `fc:1170`, yield `:1187`, pricing `:1202`). Appended rather
than substituted: the other dimensions still say what they said.

**Compare's panel gets it free, and the brief asked me to report if it did
not.** It does: Compare's rows come from `buildEventsSummaryRows` at
`fc:1247-1248`, whose market events are `marketEventFromRow(r, 'session')` —
the reader D5-10's first half already taught to parse `Tariff_Scope`. One
builder, one reader, both panels.

**Edit-restore** needs no new code: reopening a scoped event sets the draft's
`tariffL1` to `'All'` (it was never anything else — the scope lives beside it,
not in it), and the control renders the label from the current selection.

## 2. Auto-clear

**The two existing effects were structural copies** — same condition, same
patch, different draft and setter (`WIT:2014-2018` volume, `:2019-2023`
pricing). The Promotion draft had **none**, which is how it kept a deselected
tariff while its two siblings cleared theirs.

Adding a third copy would have made the next omission likelier, so the rule is
now one hook, `useClearTariffOnDeselect`, with **three callers**. Its deps stay
`[selectedTariffs]` alone, deliberately and as before: it fires when the
selection changes, not on every keystroke.

## 3. Compare — no STOP

The brief's STOP was "if Compare's weighting cannot reach the leaf's tariff".
**It can**: `scenarioHelper.ts:62` builds each `ProRataLeaf` with
`tariffL1: String(r.Tariff_L1 ?? 'All').trim()`, and `leafWithinScope` already
carried D5-10's branch. So the weighting needed nothing but the field on the
scope object.

| site | change |
|---|---|
| `scopeOf` `sh:112-122` | `tariffScope: tariffScopeFromRow(e.Tariff_Scope)` — feeds `eventProRataShare` `sh:136` and `eventCoverage` `sh:258` |
| match site `sh:233` | market events |
| match site `sh:443` | market events |
| match site `sh:507` | pricing events |
| match site `sh:374` | **yield — unchanged**, correctly |

The yield site is left alone for the same reason the What-If yield sites are:
a yield event never carries a scope, so the branch would be dead. That is the
addendum's subject, and §Addendum below says why it stopped.

Everything goes through the **one** `tariffScopeFromRow` and the **one**
`tariffScopeAdmits`; no second copy of either.

## 4. Spec

`spec:event-toggle` **136 → 146**. The SCOPE cell (appended, untouched, and the
two cells asserted to differ); Compare's engine driven through the real
`computeScenarioForFilter` at RED S and RED M; the control's label read from
the rendered DOM at a strict subset and at a full selection.

**One fixture bug the discriminate-first rule caught.** My first Compare check
read `out[0].retention`, which does not exist — the field is
`adjustedRetention`. That gave `NaN`, and `NaN !== NaN` would have made a naive
equality check *pass*. The "the fixture discriminates" check failed instead and
named the value, so the wrong field was found in one run rather than shipped as
a vacuous green.

**The mount gained two opt-in props** — `tariffTree` and `selectedTariffs`,
defaulting to the empty world, so every existing mounted check is unchanged.

## 5. Traps

**185** Compare's `scopeOf` drops the column; **186** one emitter skips
`tariffScopeFor` and the site pin must go red; **187** the label helper always
returns plain "All".

**Two of the three stayed GREEN when first planted, and both gaps were real:**

- **185** — the match sites still refused RED S without `scopeOf`'s field, so
  nothing failed. The trap only bites where the **weighting** matters, so a
  RED M case was added: with the scope, the share is `200/600`; without it,
  `200/1200`. Planted, the spec now reports `scoped 283.33 vs unscoped 283.33`.
- **187** — the label is a *rendering*, and only a rendering can see it. The
  DOM check was added; planted, the spec reports the missing in-scope label.

That is the same lesson as trap 183 in the first half, twice more: a trap
nothing can catch is not a guard, and planting it is the only way to find out.

Pre-plant md5s `6522e072a8` (scenarioHelper) and `dce3932a8e` (WhatIfTab), one
site each, restored and verified.

## 6. Gate

Serial, guard-traps to a FILE, one instance.

```
guard-traps        183/183 CAUGHT   0 MISSED / 0 INCONCLUSIVE / 0 CRASHED
suite              61/61 green
event-toggle       146/146  (136 -> 146)
view-apply-mounted 177/177
spec:trap-anchors  195/195  (183 traps, 190 anchors); next free id 188
spec:survival      104 dereferences across 26 files; 27/27 checks
spec:ai-hold       13/13
spec:i18n-parity   200/200; 875 keys per locale (+1, all six)
tsc 0              lint clean        build clean
```

**`spec:survival` went red on my own spec additions and was fixed, not
re-baselined.** The new checks added nine first-row dereferences (104 → 113).
The failure message says "recount, do not adjust to fit", so the dereferences
were **guarded** with `?.` instead — genuinely safer, and the count returned to
104 without touching the pin.

## Addendum — the Value card

**Stopped at the addendum's own item 1.**

- **The Value card renders no Tariff control.** `targetTariffTree` is used at
  exactly three sites: `WhatIfTab.tsx:5469` (Volume), `:6817` (Pricing),
  `:7535` (Promotion).
- **The yield emitter writes no tariff dimension at all.**
  `handleAddYieldEvent` (`:2911`) builds `segment`, `product`, `channelL1`,
  `channelL2` and stops. It does not write `'All'` — it writes nothing, which
  the predicate reads as unnarrowed through its `!dim` arm. Same effect,
  different fact, and worth stating precisely.

**Why this is a decision and not just missing work.** A `YieldEvent` already
relates to tariffs, but as a **mix axis**: `tariffMix` redistributes value
*across* tariffs. So "in scope" has two readings for a yield event that it does
not have for the other three cards — restrict which tariffs the event applies
to at all, or restrict which tariffs the mix redistributes across. They are
different behaviours and only one can be built.

Recorded in EXPECTED.md as Jon's clarification plus the measurement and the
reserved question. **No `tariffScopeFor` call was placed on the yield path**,
`TARIFF_SCOPE_SITES` stays at **9**, and trap 188 was not written.

## Limits

- **No mounted card-save spec, still.** The brief's item 4 wanted the real
  Volume, Pricing and Promotion add paths and one edit path driven end to end
  with a three-tariff store. That is **not written**: the nine sites remain
  pinned by marker text, and what is proven is the rule, both predicates, both
  engines, the round trip, the SCOPE cell and the label — not that a click on
  Add reaches `tariffScopeFor` with the right arguments. It is now the only
  item of D5-10 with no observational cover.
- **Yield is untouched in both engines**, by the addendum's stop.
- **`EventToggle` still carries two cross-carrier facts** under a name that
  describes one.
- **The label is asserted by substring**, accepting either the rendered English
  or the raw key, so a locale-loading change could weaken it without failing.
