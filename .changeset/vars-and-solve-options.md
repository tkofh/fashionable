---
'fashionable': minor
---

Name the dependency channels (variables, units, idents) and give `Calc.solve` an options object.

**Renames (breaking).** The custom-property channel is now spelled "variables" end to end: the `Refs` type parameter is `Vars` on `Calc`, `Color`, `Declaration`, `RuleSet`, `StyleRule`, `MediaRule`, and `Stylesheet`; `Calc.ref`/`Color.ref` are `Calc.var`/`Color.var`; every `refs()` accessor is `vars()`; `RuleSet.MemberRefs` is `MemberVars` and `Stylesheet.NodeRefs` is `NodeVars`. On the ident side, `Calc.channels` is `Calc.idents` (`Color.channels` keeps its domain name), and `Unit.ChannelLeaf` is replaced by the generic `Calc.Ident` brand, which `Channel.ChannelIdent` extends.

**`Calc.solve` takes an options object (breaking).** `solve(expr, bindings?, context?)` is now `solve(expr, options?)` with `{ bindings?, units?, idents? }`, each section required exactly when the expression's type demands it: `bindings` while variables are unbound, `units` while a relative unit or percentage is present, `idents` while a bare identifier is. Solve bindings must be closed values (`Input<never>`) — an open expression can never close under single-pass substitution and previously threw at runtime.

**Percentages solve.** The `%` leaf takes a required ratio in `units` — `basis / 100`, per-hundred exactly as `vw` takes `sampleWidth / 100`. Previously a percentage-carrying solve type-checked with an empty context and always threw.

**New: `Calc.units`.** Reports an expression's units at runtime, completing the report trio (`vars`/`units`/`idents`): one report per solve section.

**Fixes to the leaf algebra.** `pow`, `signedPow`, and `sign` no longer reject leaf-carrying operands, and they propagate leaves into the result type: `Calc.pow(Channel.L, 2.2)` gamma-adjusts a channel, and `sign` now accepts any dimension, matching CSS `sign()`. `divide` no longer drops a number-kind divisor's leaves (`Calc.solve(Calc.divide(2, Channel.L))` used to type-check as context-free and throw), and same-singleton cancellation never fires for ident leaves, which, unlike unit constants, never fold.
