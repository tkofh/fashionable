---
'fashionable': minor
---

`Color.mix(method, color1, color2)` models the `color-mix()` function. The interpolation method is a colorspace (`Color.mix('oklch', a, b)` renders `color-mix(in oklch, a, b)`) or, for a polar space, an object pairing it with a hue strategy (`{ colorspace: 'oklch', hue: 'longer' }` renders `in oklch longer hue`); a hue strategy after a rectangular space is a type error, matching the grammar. Each arm is a bare `Color` or a `[color, weight]` tuple — the weight a bare number read as a percent (`20` is `20%`) or a `Percentage` for an annotated or computed one. Weights are optional and preserved verbatim: fashionable emits the authored form and leaves the spec's mixing normalization (omitted weights defaulting to `50%`, off-`100%` sums rescaling) to the browser. Arms and weights union their references, `bind` reaches through both, and — like every `Color` — a mix serializes but does not solve.

Adds `Percentage.of(value, precision?)` and a `<percentage>` `Calc` kind. A percentage serializes value-then-`%` (`Percentage.of(40)` is `40%`), folds and scales through the `Calc` combinators (`Calc.add(Percentage.of(20), Percentage.of(5))` is `25%`), and — its own kind, not a number — rejects `Calc.add(Percentage.of(20), 5)` at compile time.
