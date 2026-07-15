---
'fashionable': minor
---

`Color` moved into the `data` module, joining the dimension constructors as the value-layer data types beyond bare expressions. The `fashionable/color` subpath is gone.

Migration: `import { Color } from 'fashionable/color'` becomes `import { Color } from 'fashionable/data'`. The API is unchanged.
