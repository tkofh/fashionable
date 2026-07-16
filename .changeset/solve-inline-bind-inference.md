---
'fashionable': patch
---

`Calc.solve` no longer rejects a data-first `Calc.bind(...)` call written inline in its expression argument. The curried data-last `bind` overload is a generic function returning a function, so TypeScript's higher-order inference deferred every `bind` call in an argument position; paired with `solve`'s conditional `SolveOptions` sibling parameter, that deferral fixed `solve`'s type parameters at their constraints and raised a spurious `SolveOptions<Var.Any, unknown>` assignability error pointing at the options argument. The data-last overload's return is now wrapped in an always-true conditional (`[B] extends [unknown] ? ... : never`), which keeps it out of the deferral predicate so the inline call infers in the first pass. Resolved types at use sites are unchanged, and `Calc.solve(Calc.bind(expr, bindings), options)` now type-checks without the hoist or `pipe` workaround. The derivation is recorded in `docs/solve-inference.md`.
