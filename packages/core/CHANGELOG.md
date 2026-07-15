# fashionable

## 0.1.0

### Minor Changes

- 4dabd9a: Initial rule model, the structural CSS layer.
  - `fashionable/selector` — compound `Selector` values with canonical part ordering and computed `Specificity`. Typed part constructors including `attribute` and `not`.
  - `fashionable/query` — `MediaQuery`, canonical and-sets of `minWidth` and `prefersColorScheme`, rendered in prefix or range syntax.
  - `fashionable/declaration` — `Declaration<Refs>`, a property name paired with literal text, a `Calc`, or a `Color`.
  - `fashionable/rule` — `RuleSet<Refs>` holding `StyleRule` and nested `MediaRule`. Member order is preserved, never sorted.
  - `fashionable/font-face` — `FontFaceRule` with multi-source `src`, weight ranges, and metric overrides.
  - `fashionable/property` — `PropertyRule` with a modeled `PropertySyntax` that types the initial value.

- 4dabd9a: Initial stylesheet and rendering layer.
  - `fashionable/stylesheet` — `Stylesheet<Refs>`, the top-level container. `merge` is an order-preserving, structurally deduped monoid, `mergeAll` folds many sheets, and `coalesce` is an opt-in same-selector merge. `refs` reports the custom properties the sheet reads.
  - Rendering — every renderable type carries its own `render`, and `Stylesheet.render` projects the whole sheet as nested CSS, `@media` kept inside its rule. Output is deterministic.

- 4dabd9a: Initial value layer.
  - `fashionable/calc` — `Calc<Refs>`, an immutable CSS `calc()` expression tree with phantom-typed unbound references. Construct with `of`/`ref` and the math combinators: arithmetic, `pow`/`signedPow`, `min`/`max`/`clamp`, `lerp`, and trig (`sin`/`cos`/`acos`). `bind` partially evaluates, `solve` reduces a closed tree to a number, and `serialize` renders `calc()` text. Constants fold at construction, and `Precision` sets per-constant and per-call formatting.
  - `fashionable/color` — `Color<Refs>`, `oklch()` over calc-expression channels. Bindable and serializable, not solvable.
  - `fashionable/utils` — the `pipe`, `flow`, `dual`, `Pipeable`, and `invariant` combinators the API is built on.
