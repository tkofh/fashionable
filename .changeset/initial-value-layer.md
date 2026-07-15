---
"fashionable": minor
---

Initial value layer.

- `fashionable/calc` — `Calc<Refs>`, an immutable CSS `calc()` expression tree with phantom-typed unbound references. Construct with `of`/`ref` and the math combinators: arithmetic, `pow`/`signedPow`, `min`/`max`/`clamp`, `lerp`, and trig (`sin`/`cos`/`acos`). `bind` partially evaluates, `solve` reduces a closed tree to a number, and `serialize` renders `calc()` text. Constants fold at construction, and `Precision` sets per-constant and per-call formatting.
- `fashionable/color` — `Color<Refs>`, `oklch()` over calc-expression channels. Bindable and serializable, not solvable.
- `fashionable/utils` — the `pipe`, `flow`, `dual`, `Pipeable`, and `invariant` combinators the API is built on.
