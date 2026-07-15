---
"fashionable": minor
---

Initial stylesheet and rendering layer.

- `fashionable/stylesheet` — `Stylesheet<Refs>`, the top-level container. `merge` is an order-preserving, structurally deduped monoid, `mergeAll` folds many sheets, and `coalesce` is an opt-in same-selector merge. `refs` reports the custom properties the sheet reads.
- Rendering — every renderable type carries its own `render`, and `Stylesheet.render` projects the whole sheet as flat or nested CSS. Both formats obey the same cascade, and output is deterministic.
