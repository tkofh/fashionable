---
'fashionable': minor
---

`Color.from(origin, space, channel1, channel2, channel3, alpha?)` models relative color syntax: `Color.from(Color.ref('accent'), ColorSpace.oklch, l, c, h)` renders `oklch(from var(--accent) l c h)`, and an `srgb` destination renders the `color(from … srgb r g b)` form. The browser converts `origin` into `space` and exposes its channels as the `Channel` keywords the space names — `Channel.L`/`C`/`H` for `oklch`, `Channel.R`/`G`/`B` for `srgb`, `Channel.Alpha` for both — so passing them straight through reproduces the origin, and arithmetic on them derives a related color.

The `space` scopes the channel arguments: a keyword the destination space does not name (`Channel.R` in an `oklch` slot) is a compile error. Each slot is a bare number, `Keyword.none`, or a `Calc` number expression, and serializes independently — wrapped in `calc()` when arithmetic, bare when a lone keyword. A supplied `alpha` renders after a slash; omitted, the origin's alpha carries through. The origin's own references union into the result; the channel keywords contribute none, since the browser resolves them from the origin. Like every `Color`, a relative color serializes but does not solve.

```ts
import { Calc } from 'fashionable/calc'
import { Channel, Color, ColorSpace } from 'fashionable/data'

const hover = Color.from(Color.ref('accent'), ColorSpace.oklch, Calc.multiply(Channel.L, 0.8), Channel.C, Channel.H)
Color.serialize(hover) // 'oklch(from var(--accent) calc(l * 0.8) c h)'

const faded = Color.from(Color.ref('brand'), ColorSpace.srgb, Channel.R, Channel.G, Channel.B, Calc.multiply(Channel.Alpha, 0.5))
Color.serialize(faded) // 'color(from var(--brand) srgb r g b / calc(alpha * 0.5))'
```
