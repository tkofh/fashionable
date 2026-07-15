---
"fashionable": minor
---

`FontFaceRule.render` now honors the inherited `precision` render option for its weight and metric-override numbers, completing the render-options family's promise that a key means the same thing wherever it appears. Output without the option is unchanged (the default remains `Precision.decimals(5)`).
