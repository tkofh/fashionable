---
'fashionable': minor
---

`<length-percentage>`: anchored mixing, declared reads, and registration.

**New: `LengthPercentage`.** `fashionable/data` gains `LengthPercentage`, the mixed dimension: a `Calc` whose `Result` is `Unit.LengthPercentage` (`Unit.Length | Unit.Percentage`). `LengthPercentage.of` widens a length or percentage expression to it — identity at runtime, an anchor at the type level.

**Mixing is anchored, never ambient.** An expression led by a length-percentage value admits length and percentage operands through the existing same-family constraints: `Calc.subtract(LengthPercentage.of(Percentage.of(100)), Length.px(24))` builds `calc(100% - 24px)`, and the sum stays a `<length-percentage>`. An unanchored `px + %` sum remains a cross-family type error — mixing is only legal where a destination accepts a `<length-percentage>`, and the anchor names that destination.

**`Var.lengthPercentage` declares the channel.** The read lifts spanning both families, anchoring mixing at the read site; bindings accept either family or a mix; fallbacks are family-checked against the widened family; `PropertyRule.make` derives `syntax: '<length-percentage>'`; and `Declaration.make` writes accept both families.
