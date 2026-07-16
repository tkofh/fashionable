---
'fashionable': minor
---

Typed variables: declared types on `Var` handles, checked end to end.

**New: typed `Var` constructors.** `Var.number`, `Var.length`, `Var.angle`, `Var.percentage`, and `Var.color` create reads declared to a value type, carried in the handle's `Type` slot: `Var.length('gap')` is a `Var<'gap', Length>`, `Var.color('accent')` a `Var<'accent', Color>`. The declaration participates in structural equality and `Var.fallback` preserves it. `Var.of` stays the undeclared constructor.

**New: `Numeric`.** `fashionable/data` gains `Numeric`, the `<number>` expression type (`Calc<Vars, Unit.None, unknown>`), completing the dimension vocabulary. `Length`, `Angle`, and `Percentage` are now interfaces rather than type aliases (structurally identical, a drop-in), so their names survive inference in hovers.

**Declared reads lift typed.** `Calc.var(Var.length('gap'))` is a length-family expression that composes through the ordinary dimension algebra (`calc(var(--gap) + 4px)` is now buildable), while undeclared reads lift as `<number>` exactly as before. `Calc.var` rejects color-declared reads and `Color.var` rejects calc-declared ones, each with a string-literal error message. Fallbacks are family-checked recursively: a length read's fallback must be length-family, and a nested read in the chain must be declared to the same family.

**Typed bindings (breaking where a declaration exists).** `Bindings` and `SolveOptions` type each name's value by its declared type: binding a bare number where a length is declared is a type error. `bind` accepts requirement-carrying values and threads their `Requires` into the result (`BindingRequires`), so `bind(expr, { gap: Length.vw(2) })` demands the `vw` ratio at the eventual solve. `solve` bindings themselves stay closed, since `SolveOptions` cannot demand ratios for units its own bindings introduce. The per-name check rides the data-first overloads (`PartialBindings`); data-last `bind` stays lenient.

**Registration and writes through handles.** `PropertyRule.make(handle, initial)` derives the registered syntax from a declared handle (`Var.length('gap')` registers `syntax: '<length>'`) and types the initial value under it; an explicit syntax alongside a declared handle is consistency-checked at runtime. `Declaration.make(handle, value)` writes the property (`--gap: ...`) with the value typed by the declaration, and a read as the value covers the `--alias: var(--source)` pattern. Name-position handles must be fallback-free.
