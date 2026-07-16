---
'fashionable': minor
---

`<length-percentage>`: anchored mixing, the declared type, and the registration.

**New: `LengthPercentage`.** `data/lengthPercentage.ts` names the mixed dimension — `Calc<Vars, Unit.Length | Unit.Percentage, unknown>`, with `Unit.LengthPercentage` as the Result vocabulary — and `LengthPercentage.of` widens a length or percentage expression to it (identity at runtime, an anchor at the type level).

**Mixing is anchored, never ambient.** The algebra gained no new arms: `Unit.Family` distributes over the union, so an expression _led by_ a length-percentage value admits length and percentage operands through the existing same-family constraints — `Calc.subtract(LengthPercentage.of(Percentage.of(100)), Length.px(24))` builds `calc(100% - 24px)`, and the sum stays a `<length-percentage>`. An unanchored `px + %` sum remains a cross-family type error: mixing is only meaningful where the destination accepts a `<length-percentage>`, and the anchor is the assertion naming that destination.

**`Var.lengthPercentage` declares the channel.** The read lifts spanning both families (anchoring mixing at the read site), bindings accept either family or a mix, fallbacks are family-checked against the widened family, `PropertyRule.make` derives `syntax: '<length-percentage>'`, and `Declaration.make` writes accept both families. Derivation notes: `docs/vars.md` section 7.
