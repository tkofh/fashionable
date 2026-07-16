---
'fashionable': minor
---

Typed variables: declared types on `Var` handles, checked end to end.

**New: typed `Var` constructors.** `Var.number`, `Var.length`, `Var.angle`, `Var.percentage`, and `Var.color` create reads declared to a value type, carried in the handle's `Type` slot as the data type itself — `Var.length('gap')` is a `Var<'gap', Length>`, `Var.color('accent')` a `Var<'accent', Color>`. The declaration exists at runtime too: it participates in structural equality, interning is per name-and-type pair, and `Var.fallback` preserves it. `Var.of` stays the undeclared constructor.

**New: `Numeric`.** `data/numeric.ts` names the `<number>` expression type (`Calc<Vars, Unit.None, unknown>`), completing the dimension vocabulary; `Length`, `Angle`, and `Percentage` are now interfaces rather than type aliases (structurally identical — a drop-in) so their names survive inference in hovers.

**Declared reads lift typed.** `Calc.var(Var.length('gap'))` is a length-family expression that composes through the ordinary dimension algebra — `calc(var(--gap) + 4px)` is now buildable — while undeclared reads lift as `<number>` exactly as before. `Calc.var` rejects color-declared reads and `Color.var` rejects calc-declared ones, with string-literal error messages (exclusion is a conditional guard on the lift parameter: the `Type` slot's `unknown` top makes it inexpressible as a constraint). Fallbacks are family-checked recursively: a length read's fallback must be length-family, and a nested read in the chain must be declared to the same family.

**Typed bindings (breaking where a declaration exists).** `Bindings` and `SolveOptions` type each name's value by its declared type — binding a bare number where a length is declared is a type error. `bind` accepts requirement-carrying values and threads their `Requires` into the result (`BindingRequires`), so `bind(expr, { gap: Length.vw(2) })` demands the `vw` ratio at the eventual solve; `solve` bindings themselves stay closed and pre-satisfied, since `SolveOptions` cannot demand ratios for units its own bindings introduce. The per-name check rides the data-first overloads (`PartialBindings`); data-last `bind` stays lenient.

**Registration and writes through handles.** `PropertyRule.make(handle, initial)` derives the syntax from a declared handle (`Var.length('gap')` registers `syntax: '<length>'`) with the initial value typed as under the derived syntax; an explicit syntax alongside a declared handle is consistency-checked against the canonical data types at runtime. `Declaration.make(handle, value)` writes the property (`--gap: ...`) with the value typed by the declared type; a read as the value serves the `--alias: var(--source)` pattern. Name-position handles must be fallback-free. Full derivation: `docs/vars.md` section 7.
