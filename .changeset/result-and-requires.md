---
'fashionable': minor
---

Re-partition `Calc`'s type parameters: `Calc<Vars, Kind, Leaves>` is now `Calc<Vars, Result, Requires>`.

**`Result` replaces `Kind` (breaking).** The second parameter carries the output's unit composition — `Unit.Px` for a pure pixel length, `Unit.Px | Unit.Vw` for a mixed sum, `Unit.None` for a `<number>`, `Unit.Rad` for `acos`/`atan2` — instead of the four kind strings. The dimension rules are unchanged and enforced by comparing `Unit.Family` projections (CSS's own type-checking altitude): cross-dimension addition is still a type error, `multiply` still passes the dimensioned side through, and same-dimension `divide` produces `Unit.None`. `Kind` survives as the prose and runtime vocabulary. New in units: `Unit.None`, `Unit.Any` (the domain top, replacing `Kind` in the widest positions), and `Unit.Family`.

**`Leaves` is renamed `Requires` (breaking in name only).** The third parameter is the requirements channel — what stands between the expression and a number, satisfied by the `units` and `idents` sections of `Calc.SolveOptions` — sharing the polarity convention with the selector layer's planned `Requires` (union-accumulated, `never` default, subset reading). Absolute units stay on the channel as pre-satisfied requirements; they are load-bearing for division cancellation (see `docs/result-calc.md`).

**Division splits into two honest levels.** The Result of same-dimension division is `Unit.None` unconditionally — the singleton machinery no longer decides the dimension, only whether the _requirement_ discharges (same-single-unit shapes, which folding guarantees; never idents).

**`bind` preserves `Result` and `Requires` (fix).** Previously `Calc.bind` accepted only number-kind, requirement-free expressions — binding a dimensioned or ident-carrying tree was a type error. It now takes any expression and preserves both facets: `Calc.bind(Calc.multiply(Calc.var('t'), Length.vw(1)), { t: 2 })` is a `Calc<never, Unit.Vw, Unit.Vw>`.

**Alias fix.** `Length<Vars>`/`Angle<Vars>`/`Percentage<Vars>` widen to `Calc<Vars, Unit.Length, unknown>` (and siblings), so ident-carrying dimensioned expressions like `Calc.multiply(Channel.L, Length.px(1))` are now assignable to their family alias.
