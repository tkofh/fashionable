# fashionable

Structural stylesheet modeling and calc expression evaluation for TypeScript (npm: `fashionable`).

An Effect-style API for building CSS in code: a faithful structural model of the CSS language — rules, selectors, media queries, at-rules, nesting — unified with a `calc()` value-expression language that can be solved against bindings or serialized to CSS text. Immutable values, structural equality, deterministic output, zero runtime dependencies. No template literals anywhere.

## Values

A `Calc` is a `calc()` expression you can solve to a number or serialize to CSS — the same tree, two projections.

```ts
import { Calc, Precision } from 'fashionable/calc'

const fluid = Calc.clamp(14, Calc.add(14, Calc.multiply(Calc.ref('vw'), 0.01)), 20)

Calc.serialize(fluid) // 'clamp(14, 14 + var(--vw) * 0.01, 20)'
Calc.solve(fluid, { vw: 800 }) // 20 — the thing you verified is the thing you shipped
Calc.of(0.8377580409572781, Precision.significant(10)) // per-constant precision
```

## Stylesheets

Build a stylesheet from typed parts — selectors, declarations, rules, nested media — then render it flat or nested from the one model.

```ts
import { Calc } from 'fashionable/calc'
import { Declaration } from 'fashionable/declaration'
import { MediaQuery } from 'fashionable/query'
import { MediaRule, RuleSet, StyleRule } from 'fashionable/rule'
import { Selector } from 'fashionable/selector'
import { Stylesheet } from 'fashionable/stylesheet'

const card = StyleRule.make(
  Selector.class('card'),
  RuleSet.make(
    Declaration.make('padding', '1rem'),
    Declaration.make('gap', Calc.multiply(Calc.ref('space'), 2)),
    MediaRule.make(
      MediaQuery.minWidth(768),
      RuleSet.make(Declaration.make('gap', Calc.multiply(Calc.ref('space'), 3))),
    ),
  ),
)

const sheet = Stylesheet.make(card) // Stylesheet<'space'>

Stylesheet.render(sheet, { format: 'flat', indent: '  ' }) // media hoisted to top-level blocks
Stylesheet.render(sheet, { format: 'nested', indent: '  ' }) // @media nested in the rule
```

Both formats describe the same cascade. Flat hoists the `@media` to its own top-level block:

```css
.card {
  padding: 1rem;
  gap: calc(var(--space) * 2);
}

@media (min-width: 768px) {
  .card {
    gap: calc(var(--space) * 3);
  }
}
```

Nested keeps it inside the rule:

```css
.card {
  padding: 1rem;
  gap: calc(var(--space) * 2);
  @media (min-width: 768px) {
    gap: calc(var(--space) * 3);
  }
}
```

## Refs

Every value and container is generic over `Refs`, the CSS custom properties it reads but has not bound. `Calc.ref('space')` is a `Calc<'space'>`. Combining expressions unions their `Refs`, and `bind` subtracts the names it binds. A closed expression — fully bound or constant — is a `Calc<never>`, which is what `solve` accepts with no bindings.

The parameter threads up through the model, so `Declaration<Refs>`, `RuleSet<Refs>`, `StyleRule<Refs>`, and `Stylesheet<Refs>` carry the union of the refs they contain. The `Stylesheet<'space'>` above is the compiler reporting that the sheet reads `var(--space)` and nothing else. `Stylesheet.refs` returns the same set at runtime. Unbound refs serialize as `var(--name)` — the reference channel is the custom-property channel.

## Modules

| Subpath                   | Contents                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fashionable/calc`        | `Calc<Refs>` number expressions — `of`, `ref`, arithmetic, `pow`/`signedPow`, `min`/`max`/`clamp`, `lerp`, trig (`sin`/`cos`/`acos`), `bind`/`solve`/`serialize`, `Precision`                                     |
| `fashionable/color`       | `Color<Refs>` — `oklch()` over calc expressions                                                                                                                                                                   |
| `fashionable/selector`    | `Selector` compound selectors — typed parts incl. `attribute` and `not`, canonical ordering, computed `Specificity`                                                                                               |
| `fashionable/query`       | `MediaQuery` — canonical and-sets of `minWidth` / `prefersColorScheme`, prefix or range rendering; the future home of container and supports queries                                                              |
| `fashionable/declaration` | `Declaration<Refs>` — a property name and a value (literal text, `Calc`, or `Color`), `bind`, refs threading                                                                                                      |
| `fashionable/rule`        | `RuleSet<Refs>` ordered blocks, `StyleRule<Refs>`, nested `MediaRule<Refs>` — order preserved, never sorted                                                                                                       |
| `fashionable/font-face`   | `FontFaceRule` — multi-src, weight ranges, metric overrides                                                                                                                                                       |
| `fashionable/property`    | `PropertyRule` with `PropertySyntax` — a modeled syntax descriptor that types the initial value                                                                                                                   |
| `fashionable/stylesheet`  | `Stylesheet<Refs>` top level — `merge` (a lawful monoid: order-preserving, structurally deduped), `mergeAll`, opt-in `coalesce`, refs aggregation, and `render` (flat or nested format — same cascade either way) |
| `fashionable/utils`       | `pipe`, `flow`, `dual`, `Pipeable`, `invariant`                                                                                                                                                                   |

## License

MIT
