---
'fashionable': minor
---

`Color.srgb(red, green, blue)` models the `color()` function's srgb colorspace: `Color.srgb(0.18, 0.34, 0.78)` serializes as `color(srgb 0.18 0.34 0.78)`. Channels are `Calc` expressions exactly as on `oklch` — references, arithmetic (wrapped in `calc()` per channel), `bind`, and `refs` all behave identically. Different color functions never compare equal, even where they would name the same point in color space.
