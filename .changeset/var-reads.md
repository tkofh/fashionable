---
'fashionable': minor
---

Model `var()` reads as values: the `fashionable/var` module, fallbacks, and the `Vars` identity flip.

**New: `fashionable/var`.** A `Var` value is one custom-property read (a name plus an optional fallback), and the bare read (`Var.of('gap')`) doubles as the property's canonical handle. `Var.fallback` (dual) derives site-specific reads from the handle; `Var.name`, `Var.vars`, `Var.isVar`, and `Var.equals` round out the surface.

**The `Vars` phantom carries identities (breaking).** Every `Vars` parameter (`Calc`, `Color`, `Declaration`, `RuleSet`, `StyleRule`, `MediaRule`, `Stylesheet`) is now a union of `Var` identities instead of string names: `Calc.var('x')` is a `Calc<Var<'x'>>`, and a type annotation spelled `Calc<'x' | 'y'>` becomes `Calc<Var<'x'> | Var<'y'>>`. Names stay the value-level currency: binding records are still keyed by bare name (`Bindings` maps over `Var.Name<Vars>`), and every `vars()` report still returns a `ReadonlySet` of names. `Stylesheet.mergeAll` infers differently to suit the object-typed phantom; call sites are unaffected.

**Reads lift and fall back.** `Calc.var` and `Color.var` accept a `Var` read as well as the bare-name sugar, and `Declaration.make` accepts one as a whole declaration value — `font-family: var(--stack, sans-serif)` no longer needs literal text that drops the read from the dependency report. A fallback-carrying read renders `var(--name, fallback)`, with the fallback constrained per context: numeric at `Calc.var`; color-valued at `Color.var`, where text coerces through `named` and CSS-wide keywords are rejected; any declaration value, nested reads included, at the declaration level. The read and every read in its fallback chain land in `Vars`.

**Fallback semantics.** A fallback joins the `vars()` report (`var(--x, var(--y))` reads both names) but never the requirements channel, so `units()` and `idents()` exclude fallback contents. `bind` on the read's own name replaces the whole read and discards the fallback: author substitution wins over cascade defaulting. Binding a name that appears only inside a fallback substitutes there, and a fallback does not exempt its read's name from `solve` bindings.
