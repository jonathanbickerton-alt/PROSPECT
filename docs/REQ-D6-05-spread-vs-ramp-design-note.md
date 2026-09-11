# REQ-D6-05 Spread vs Ramp — design note (not code)

From the 2026-09-11 inventory (`reports/2026-09-11-0928-spread-vs-ramp-inventory.md`).

**Mode control, per card.** One `Spread | Ramp` segmented control replaces the
spread/ramp checkbox on Volume and Promotion; churn keeps its ramp checkbox (it is
already a ramp). Duration, the per-month grid and Hold render beneath the chosen
mode. Hold moves **inside Ramp** ("Ramp then hold"); Spread shows no Hold. A
"permanent monthly figure" is Ramp + duration 1 + Hold, so Ramp duration's
minimum becomes **1** (today both cards clamp to 2 and reach 1 only by turning the
switch off).

**State.** Add `spreadMode: 'spread' | 'ramp'` and `promoSpreadMode`. Ramp gets a
typed per-month array (`rampStated`, `promoRampStated`) alongside, not in place
of, `customDist` / `promoCustomDist`. `holdAfterRamp` / `promoHold` keep their
names and only take effect in Ramp. Default: Spread for absolute, Ramp for %.

**Emission and restore.** Spread = `spreadShape` hold-OFF arm, unchanged; Ramp =
the typed values, then the held tail when Hold is on. Held rows reopen as Ramp
(plateau path, unchanged); unheld rows are ambiguous from rows alone — see Q1.

**Label keys (new, six locales).** `whatif_amount_total_spread` "total, split
across the spread"; `whatif_amount_target_held` "target reached, then held";
`whatif_mode_spread`, `whatif_mode_ramp`. Retire the `Change to {}` allowlist
entry when the percentage label is replaced.

**Byte-identical.** Spread + absolute + Even/Custom % emits exactly today's
Hold-OFF rows. Held campaigns emit exactly today's held rows. Churn unchanged.

**Questions for Jon — each is where the decisions are underdetermined.**

1. An unheld Ramp and a Spread can store identical rows (1,000 / 2,000 / 3,000
   is a Ramp to 3,000 and a Spread of 6,000). Should Market_Events gain a `Shape`
   column ('Spread' / 'Ramp') appended last, so reopen restores the mode the user
   chose — or should unheld rows always reopen as Spread, accepting that a ramp
   reopens showing its total?
2. Decision 5 says the Promotion spread should accept typed absolute values
   "matching the Volume card", but the Volume card has no typed values on a
   spread — only Custom % shares. Is the intent a third distribution option on
   BOTH cards' Spread (typed values that must sum to the total), or is decision 5
   satisfied by Ramp's typed values (decision 3) and should be withdrawn?
3. Decision 1 says Spread shares "must sum to 100%". Today both cards WARN and
   normalise on Add. Should Add be BLOCKED until they sum to 100, or does the
   warn-and-normalise behaviour stay?
4. In Ramp, the target box and the last typed month can disagree (churn allows
   it today). Which wins — does editing month N rewrite the target, does the
   target rewrite month N, or is Add blocked until they match?
5. Churn discards hand-edited per-month values when the target or months change.
   Should Ramp on Volume and Promotion do the same, or keep edits and only
   prefill new months?
6. "Each month's figure ≤ the next" — enforced how: blocked Add, clamped input,
   or a warning? And for Outflow, where absolute rows are stored negative, is it
   the magnitude that must not decrease?
7. Is a percentage SPREAD allowed at all (a total per-cent divided over months),
   or does a percentage amount force Ramp? Today the Volume card hides the spread
   for an unheld percentage while the Promotion card allows it.
8. Should the dilution arm ramp? Costed in inventory §5: cheap in the engine,
   costly in persistence, restore, the non-linear definition and parity with the
   Pricing card's dilution.
