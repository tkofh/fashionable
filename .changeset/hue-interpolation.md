---
'fashionable': minor
---

`HueInterpolation` is the hue-traversal argument that follows a polar `ColorSpace` in `Color.mix`: `Color.mix(ColorSpace.oklch, HueInterpolation.longer, a, b)` renders `color-mix(in oklch longer hue, a, b)`. The four strategies mirror CSS — `shorter` and `longer` take the short or long arc between the two hues, `increasing` and `decreasing` force the direction of travel. A polar space may be given without one (the browser defaults to `shorter`), so these are the explicit override, and a strategy after a rectangular space is a type error, matching the grammar.

`HueInterpolation.interpolate(strategy, from, to, t)` is the JS side of that mix: it builds the hue at `t` (running `0` at `from` to `1` at `to`) along the chosen arc, each argument a number of degrees or a `Calc`. It's the CSS Color 4 hue fixup written branchlessly with `mod`, folding to a constant when every argument is a number and staying fully symbolic otherwise, and drops straight into a hue channel.

```ts
import { Calc } from 'fashionable/calc'
import { HueInterpolation } from 'fashionable/data'

const hue = HueInterpolation.interpolate(
  HueInterpolation.shorter,
  30,
  Calc.ref('to'),
  Calc.ref('t'),
)
Calc.serialize(hue) // 'calc(30 + (mod(var(--to) - 30 + 180, 360) - 180) * var(--t))'
Calc.serialize(HueInterpolation.interpolate(HueInterpolation.increasing, 20, 350, 0.5)) // '185'
```
