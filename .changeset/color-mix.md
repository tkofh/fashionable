---
'fashionable': minor
---

`Color.mix(space, color1, color2)` models the `color-mix()` function. The interpolation method is a `ColorSpace` (`Color.mix(ColorSpace.oklch, a, b)` renders `color-mix(in oklch, a, b)`); a polar space takes an optional `HueInterpolation` in a second position (`Color.mix(ColorSpace.oklch, HueInterpolation.longer, a, b)` renders `in oklch longer hue`), and a hue strategy after a rectangular space is a type error, matching the grammar. Each arm is a bare `Color` or a `[color, weight]` tuple — the weight a bare number read as a percent (`20` is `20%`) or a `Percentage` for an annotated or computed one. Weights are optional and preserved verbatim: fashionable emits the authored form and leaves the spec's mixing normalization (omitted weights defaulting to `50%`, off-`100%` sums rescaling) to the browser. Arms and weights union their references, `bind` reaches through both, and — like every `Color` — a mix serializes but does not solve.
