---
'fashionable': minor
---

`Keyword.none` (in `fashionable/data`) models CSS's missing-component keyword as a branded value, and color channels now accept it: `Color.oklch(0, 0, Keyword.none)` serializes as `oklch(0 0 none)` — the conventional achromatic hue. Positions that take the keyword declare it in their signatures (`Input<R> | Keyword.None`), so acceptance is explicit per slot; a `none` channel contributes no references and passes through `bind` untouched.
