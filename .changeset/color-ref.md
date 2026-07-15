---
'fashionable': minor
---

`Color.ref(name)` reads a whole color from a custom property: `Color.ref('accent')` serializes as `var(--accent)`. The reference is the entire value — so it carries `name` as its one unbound reference, a dependency exactly as `Calc.ref` is, and has no channels. `bind` substitutes channel expressions, not whole colors, so it leaves a color reference in place for the browser to resolve from the cascade.
