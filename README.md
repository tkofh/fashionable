# fashionable

Structural stylesheet modeling and calc expression evaluation for TypeScript (npm: `fashionable`).

An Effect-style API for building CSS in code: a faithful structural model of the CSS language — rules, selectors, media queries, at-rules, nesting — unified with a `calc()` value-expression language that can be solved against bindings or serialized to CSS text. Immutable values, structural equality, deterministic output, zero runtime dependencies. No template literals anywhere.

```ts
import { Calc, Precision } from 'fashionable/calc'

const fluid = Calc.clamp(14, Calc.add(14, Calc.multiply(Calc.ref('vw'), 0.01)), 20)

Calc.serialize(fluid) // 'clamp(14, 14 + var(--vw) * 0.01, 20)'
Calc.solve(fluid, { vw: 800 }) // 20 — the thing you verified is the thing you shipped
Calc.of(0.8377580409572781, Precision.significant(10)) // per-constant precision
```

## Status

Feature-complete for v1: the value layer (`fashionable/calc`, `fashionable/color`, `fashionable/utils`) and the full rule layer through rendering (`fashionable/selector`, `fashionable/query`, `fashionable/declaration`, `fashionable/rule`, `fashionable/font-face`, `fashionable/property`, `fashionable/stylesheet`) are implemented and tested, including end-to-end smoke fixtures shaped like both consumers' real output. The consumer migrations remain before a first release. See [docs/design.md](./docs/design.md) for the full design, module map, and sequencing.

fashionable absorbs [`@ok-apca/calc-tree`](https://github.com/tkofh/ok-apca) and is built to serve two consumers: ok-apca's computed `@property` color system and dtcg-resolver's design-token CSS generator.

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
