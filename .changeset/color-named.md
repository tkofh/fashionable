---
'fashionable': minor
---

Named colors: `Color.named('rebeccapurple')` renders its name bare, and `Color.transparent` is the blessed constant for the conventional "no color" value. A named color is a whole-value node — no channels, no references, nothing to bind — and composes anywhere a `Color` goes, `light-dark(transparent, …)` included. Names are not checked against the specification's list, with one exception: the CSS-wide keywords (`inherit`, `initial`, …) are whole-declaration values, not colors, and are rejected.
