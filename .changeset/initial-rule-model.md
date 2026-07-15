---
"fashionable": minor
---

Initial rule model, the structural CSS layer.

- `fashionable/selector` — compound `Selector` values with canonical part ordering and computed `Specificity`. Typed part constructors including `attribute` and `not`.
- `fashionable/query` — `MediaQuery`, canonical and-sets of `minWidth` and `prefersColorScheme`, rendered in prefix or range syntax.
- `fashionable/declaration` — `Declaration<Refs>`, a property name paired with literal text, a `Calc`, or a `Color`.
- `fashionable/rule` — `RuleSet<Refs>` holding `StyleRule` and nested `MediaRule`. Member order is preserved, never sorted.
- `fashionable/font-face` — `FontFaceRule` with multi-source `src`, weight ranges, and metric overrides.
- `fashionable/property` — `PropertyRule` with a modeled `PropertySyntax` that types the initial value.
