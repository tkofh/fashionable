---
"fashionable": minor
---

`RuleSet` gains `forSelector` and `forMediaQuery`: dual combinators that lift a block into a `StyleRule` or nested `@media` `MediaRule` — sugar for `StyleRule.make(selector, block)` / `MediaRule.make(query, block)` with the arguments flipped, so a block built up through `pipe` caps off as a rule without naming `StyleRule`/`MediaRule` at the call site. Both thread the block's reference names through unchanged.

```ts
RuleSet.make(Declaration.make('--depth', Calc.ref('depth'))).pipe(
  RuleSet.forSelector(Selector.root),
) // StyleRule<'depth'>
```
