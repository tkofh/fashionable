---
"fashionable": minor
---

`FontFaceRule` gains the `unicode-range` descriptor. Entries are single codepoints or inclusive `[start, end]` ranges (the `Weight` pattern), validated in `[0x0, 0x10FFFF]`: `FontFaceRule.make({ ..., unicodeRange: [0x400, [0x500, 0x5ff]] })` renders `unicode-range: U+400, U+500-5FF;` after `src`. The descriptor is a set union, so entries canonicalize at construction — sorted by start then end, exact duplicates dropped — and construction order never affects equality. The wildcard spelling (`U+4??`) is range sugar and is not modeled.
