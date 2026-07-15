---
"fashionable": minor
---

Barrel modules now expose each type through its namespace instead of as a bare re-export. `Calc`, `MediaQuery`, `Stylesheet`, and the rest are namespaces only — reach their types as `Calc.Calc<Refs>`, `MediaQuery.MediaQuery`, `Stylesheet.Stylesheet<Refs>`, and so on.

Migration: qualify explicit type annotations — `const x: Calc<'a'>` becomes `const x: Calc.Calc<'a'>`. Value calls (`Calc.of`, `MediaQuery.minWidth`), inferred types, and IDE hovers are unaffected; a hover still shows the short `Calc<'a'>` form.

Declaration files now ship as `.d.mts`, bundled by tsdown; the separate `tsc` declaration build is gone.
