---
'fashionable': minor
---

`RuleSet.isEmpty` and `Stylesheet.isEmpty` check structural emptiness (no members / no nodes). `Stylesheet.render` now also documents its empty-output guarantee: a sheet whose every node renders empty — `empty` itself, or style rules with empty blocks — renders the empty string, so composing a render into a larger file never needs to reach into `nodes`.
