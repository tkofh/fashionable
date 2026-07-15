---
'fashionable': minor
---

`Color.lightDark(light, dark)` models the scheme-conditional `light-dark()` function: `Color.lightDark(Color.srgb(0.85, 0.3, 0.4), Color.srgb(0.95, 0.5, 0.55))` serializes as `light-dark(color(srgb 0.85 0.3 0.4), color(srgb 0.95 0.5 0.55))`. Arms are whole colors of any form (mixing `oklch` and `srgb` is fine, nesting is legal), their references union into the result, and `bind` reaches through both. Arms are positional — the first slot is the light scheme — so `lightDark(a, b)` never equals `lightDark(b, a)`. The `color-scheme` contract that makes `light-dark()` resolve remains the consumer's to emit.
