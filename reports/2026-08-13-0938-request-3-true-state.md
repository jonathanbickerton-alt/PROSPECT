# Request 3 — true state of the promotion card's value-mix arm

## FOR ADVISOR

```
Generated: 2026-08-13 09:38 +0100 (UTC 2026-08-13 08:38)
Verified against: 3a78c32, branch main, tree CLEAN (bar this report).
Repo: committed 786aa33, pushed (origin in sync)
SKELETON CREATED AS THIS SESSION'S FIRST ACTION, before any check ran.
THE DECISIVE FACT: the promo band row has THREE controls — a range input, a
  number input (both wired to handlePromoSliderChange, i.e. the SHARE) and a
  padlock. The Base ARPU cell is a read-only <span>. **There is no per-band
  ARPU input on the promotion card at HEAD**, and the Value card's tier input
  is NOT shared componentry — the two grids are separately hand-rolled.
SO JON'S SAVE/RELOAD OBSERVATION IS REAL CAPABILITY, MISIDENTIFIED. What
  survived is promoMix — the three band SHARES — round-tripping through
  Promo_Mix_JSON since 08194db. Three bands, three numbers returning, held ones
  styled: by eye, indistinguishable from an override round trip.
THE SAVE REFUSAL IS REAL AND UNLIFTABLE. promoMixBlocksSave gates on
  !conforms || blend === null, with the blend from blendTierMixOrNull — so an
  ARPU-less band DOES block the save, and with no input the user cannot supply
  a rate. The refusal has NO user-reachable remedy at HEAD. That is R3
  decision 3, and the mechanism to lift it already exists in the shared blend.
FOUR HOLDS, all budget, none technical, no partial R3 code anywhere.
RESIDUAL SCOPE IS THE WHOLE OF R3, plus one thing the design never named: the
  CLEAR-AFTER-RELOAD semantic — derived-today or rate-at-save — which needs
  Jon's call. Provenance also needs the R2 two-field shape (override map beside
  the effective snapshot) or it dies at save.
NOT-CHECKABLE: which surface Jon was on. The mechanism is given; confirming the
  identification is one question to him.
```

---

## Instruments

`git rev-parse`, `git log --oneline --grep`; `sed -n` over the promo band row in
`src/components/WhatIfTab.tsx` filtered for `input`/`type=`/`onChange`/`span`;
`grep -n` for `promoDraftBlendedArpu`, `promoMixBlocksSave`, `buildPromoEvents`'
stored fields. No spec or gate run — this session changed no source.

## 1. The hold chain

| commit / report | what it held, and why |
|---|---|
| `3c513d1` — *Record Request 2's reading, the comparator decision, and Request 3's design* | R3's four decisions recorded in EXPECTED.md so the build could be taken by a fresh session. **Held: the whole build.** Reason: the session's budget went on records rather than code |
| the R3 build brief naming base `62b3c66` | **Held before starting.** Reason: base did not exist, and the budget could not carry build + gate + close |
| the R3 build brief naming base `5710300` | **Held before starting** (`fa578ae`). Reason: base did not exist; the pre-authorised shed (persistence-only, the `a50cca9` shape) was itself a full session |
| `fa578ae` → `c6efd74` | The fourth hold, and the first to **name the pattern**: four consecutive holds is a sizing signal, not a judgment call repeated |

**Every hold was budget, none technical.** No R3 attempt was ever abandoned
part-way; nothing was reverted; there is no partial R3 code anywhere.

## 2. What renders, and the save path

### The promo band row — three controls, and the ARPU is not one of them

Reading the row markup directly, the grid renders per band:

| control | wired to |
|---|---|
| `type="range"` | `handlePromoSliderChange(tier, …)` — the **share** |
| `type="number"` | `handlePromoSliderChange(tier, …)` — the **share**, as a percentage |
| `data-testid="promo-mix-lock-…"` button | the padlock |
| Base ARPU | **a read-only `<span>`** |

**No per-band ARPU input exists.** And the Value card's tier input is *not*
shared componentry — the promo grid (`promoTierData.map`) and the Value grid
(`yieldTierData.map`) are separately hand-rolled, with different column
templates. R2's input cannot render here by inheritance.

### The save path stores shares, never band rates

`buildPromoEvents` derives `tierArpu` locally from `p.tierData` — the **derived**
figures — uses it once to compute `mixBlendedArpu` via `blendTierMixOrNull`, and
stores:

- `promoMix` — the **shares** (`{ ...p.draftMix }`);
- `promoMixAxis`;
- `arpu` / `revenue` — the resulting blended rate and its product.

**No per-band ARPU map is stored.** There is no field to carry one: the promo
event has no analogue of `tariffBaseArpuOverride`.

### Trace of an edited band value through save → reload

Since the only editable per-band value is the **share**:

1. **Edit** — the share moves, the mix rebalances via `rebalance`, the blend
   recomputes from the *derived* band ARPUs.
2. **Save** — `promoMix` is written to `Promo_Mix_JSON`; the derived band ARPUs
   are **not** written.
3. **Reload** — `readStoredEventModifiers` restores `promoMix`; the card
   re-derives band ARPUs from the cohort data at render time.
4. **Display** — shares come back as saved; band ARPUs are whatever the data now
   derives. **Provenance is not lost, because none was ever stored** — the app
   has no concept of a user-stated band rate to lose.
5. **Clear** — clearing a *share* rebalances; there is no ARPU clear to reason
   about.

## 3. The save refusal

```
promoMixBlocksSave = promoMixEnabled && promoTierData.length > 0 &&
  (!promoMixConforms || promoDraftBlendedArpu === null)
```

and `promoDraftBlendedArpu` is `blendTierMixOrNull(promoDraftMix, promoTierArpu)`.

So the refusal is **real**: a band carrying share whose ARPU is unknown makes the
blend absent, and the save is blocked.

**But it cannot be lifted by the user.** An override would resolve it —
`blendTierMixOrNull` returns a number as soon as every share-carrying band has a
rate — and **there is no input through which to supply one**. The only escapes
are to zero that band's share or abandon the mix arm.

**This is R3 decision 3, and it is the sharpest unbuilt gap:** the mechanism that
would lift the refusal already exists in the shared blend; only the input and its
carrier are missing.

## 4. Per walk check

| Jon's observation | verdict |
|---|---|
| live range movement on a band edit | **REAL shared capability** — editing a *share* moves the reachable range through `achievableTargetRange`, shipped with the mix card |
| at-a-glance provenance | **REAL, but of the padlock, not of an ARPU override** — held bands are styled distinctly; no ARPU provenance exists to show |
| absence-resolution lifting the save refusal | **NOT observable at HEAD** — the refusal exists and cannot be lifted by any input. If this appeared to pass, what passed was a mix that already conformed with all bands priced |
| three band overrides survived save/reload | **REAL CAPABILITY, MISIDENTIFIED** — `promoMix`'s three **shares** round-trip through `Promo_Mix_JSON`. Three bands, three numbers returning, held ones styled: indistinguishable by eye from an override round trip |

**None of these is a snapshot illusion or a draft-state illusion in the
misleading sense** — nothing fabricates or discards silently. The pattern is
narrower and worth stating plainly: **the promo mix arm's shares behave exactly
as R3's overrides are specified to behave, so a walk of R3's script passes on
capability R3 does not include.**

## 5. Residual R3 scope

**The whole of R3 remains unbuilt.** Nothing is partially present.

1. **The per-band input** — four display states, source named, edited-vs-default
   distinct, clear-returns-to-default, stated zero distinct from unset, negative
   verbatim with zero sign transforms.
2. **The carrier** — a `promoBandArpuOverride`-shaped map on `MarketEvent`, its
   export column with the `''` absence carrier, and **both** market-event import
   routes through `readStoredEventModifiers` (extend, never fork).
3. **The effective band rate** — override-if-present by presence, feeding
   `achievableTargetRange`, `solveForTarget` and `blendedArpu`. The engine itself
   needs no change: `perMemberArpus` is already its input.
4. **Provenance round-trip** — the event must store *which* rates were stated, or
   a reloaded promotion cannot style overridden bands distinctly. R2 solved this
   by persisting the override map **alongside** the effective snapshot; R3 needs
   the same two-field shape or provenance dies at save.
5. **Clear-after-reload semantics — NOT in the recorded design, and it needs a
   decision.** On the Value card, clearing returns to the *derived* rate. On a
   reloaded promotion the stored blend was computed at save time; clearing a band
   could mean "return to today's derived rate" (the mix's blend then moves) or
   "return to the rate at save time" (which is not stored). **Jon's call.**
6. **Writer pins by count with a trap** — market events have **two** import
   routes, unlike the yield path's one.
7. **Absence-resolution wiring and its mounted transition** — absent → override →
   save enabled → reload → still resolving.

## Corrections for the advisor

1. **The v3.2 correction stands and sharpens.** R3 is unbuilt; additionally, a
   walk of R3's script *passes* on the mix arm's share behaviour, so walk-passed
   must not be read as R3-shipped anywhere in the document.
2. **"Shared componentry" is not the mechanism.** The promo and Value grids are
   separately hand-rolled. Any brief assuming R2's input renders on the promo
   card by inheritance is wrong.
3. **The save refusal is live on the promo arm today** and has no user-reachable
   remedy. That is worth recording as current behaviour, not only as R3 scope.

## Decisions for Jon

1. **Which surface were you on?** The mechanism for what you saw is the mix
   *shares* round-tripping. Confirming this is one question and it is the only
   NOT-CHECKABLE item here.
2. **Clear-after-reload on a promotion band** — derived-today or rate-at-save?
   R2's answer (derived) is the consistent one, but a promotion's stored blend
   makes the alternative arguable.
3. **The unliftable refusal** — ship R3 to close it, or add an interim escape?
   Recommend the former: the mechanism already exists in the shared blend.

## Limits of this check

Read-only; no source changed, no spec or gate run — `Verified against:` names the
commit rather than certifying one. Rendering claims are read from source markup,
not from a mounted render: **the promo card has no mounted spec** (that hold
stands from the R2 surface session), so "what renders" is established by reading
the JSX and its handlers, and is stated as such.
