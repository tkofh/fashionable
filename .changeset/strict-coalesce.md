---
'fashionable': minor
---

`Stylesheet.coalesce` accepts `{ strict: true }`: a pull throws when the coalesced rule's block would move backward across an intervening style rule whose selector ties the coalesced selector on specificity — the case where coalescing can change the cascade. The check is conservative (it cannot know whether tying selectors match the same element, so any tie refuses), turning the operation's documented order-sensitivity into a checkable build gate. Default behavior is unchanged.
