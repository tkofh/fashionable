---
'fashionable': minor
---

Selector nesting: the complex-selector grammar, `&`, and nested style rules that render.

**The grammar widens.** A `Selector` is now a complex selector: compounds joined by `descendant`/`child`/`nextSibling`/`subsequentSibling`. The functional pseudo-classes take selector lists: `is`, `where`, and `has` are new, and `not` widens from one compound to a list. Lists canonical-sort (matching is order-independent; a list's specificity is its most specific argument's, zero for `:where`); combinator sequences never reorder. In the compound order, `&` slots just after type/universal (`div&`, never `&div`, per css-nesting-1) and the functional pseudos share the old negation slot, so no existing rendered selector changes.

**`Selector.nest` and `Selector<Requires>`.** The nesting selector is a first-class simple selector, carrying the `Parent` requirement in the new `Requires` parameter (union-accumulated, `never` default). Bare `Selector` admits only closed selectors, so `Selector.specificity` and `Stylesheet`'s pair-form appends reject an unresolved `&` at compile time. `Selector.under(child, parent)` substitutes the parent for each `&` (compound parents merge in place, complex parents wrap as `:is(parent)`, argument lists included) and discharges `Parent`; the resolved specificity is spec-exact, since a rule carries exactly one selector.

**Nested style rules render (breaking: the guard is gone).** A nested `StyleRule` now emits as an indented sub-block with `&` kept verbatim — native CSS nesting, the shape `@media` blocks already take — instead of every renderer throwing. Two invariants replace the guard: `StyleRule.make` requires every style rule reachable in its block through media transparency to reference `&` (the implicit descendant CSS would prepend is not modeled), and `Stylesheet.make`/`append` reject a top-level rule whose selector still needs a parent. `coalesce` is untouched, strict mode included: it still refuses blocks that nest style rules.

**The containers carry the channel.** `RuleSet`, `StyleRule`, and `MediaRule` gain a `Requires` parameter beside `Vars`: a bare declaration contributes `Parent`, a media rule passes its block's requirements through, and a style rule contributes only its selector's, discharging its block's. `RuleSet.MemberRequires` is the member-level extractor. Existing annotations keep their meaning: `StyleRule<Vars>` stays the closed top-level form, `RuleSet<Vars>`/`MediaRule<Vars>` default to the conservative top, and `RuleSet.empty` is now `RuleSet<never, never>`.

**Top-level `@media`.** `MediaRule<Vars, never>` (a media rule whose block holds only closed style rules) joins `Stylesheet.Node` and renders as its own section: the authored `@media { selector { ... } }` grouping, no longer deferred to a separate type. A bare declaration or an `&`-carrying rule keeps the media rule nested-only, rejected at the top level at compile time and, for callers the phantom cannot see, at runtime.
