---
'fashionable': minor
---

Re-partition `Calc`'s type parameters: `Calc<Vars, Kind, Leaves>` is now `Calc<Vars, Result, Requires>`.

**`Result` replaces `Kind` (breaking).** The second parameter now carries the output's unit composition instead of the four kind strings: `Unit.Px` for a pure pixel length, `Unit.Px | Unit.Vw` for a mixed sum, `Unit.None` for a `<number>`, `Unit.Rad` for `acos`/`atan2`. The dimension rules are unchanged: cross-dimension addition is still a type error, `multiply` still passes the dimensioned side through, and same-dimension `divide` produces `Unit.None` unconditionally. `Kind` itself survives as the four-string vocabulary. New in `Unit`: `Unit.None`, `Unit.Any` (the top, replacing `Kind` in the widest positions), and `Unit.Family`.

**`Leaves` is renamed `Requires` (breaking in name only).** The third parameter is the requirements channel — what stands between the expression and a number, satisfied by the `units` and `idents` sections of `Calc.SolveOptions` — union-accumulated with a `never` default. Absolute units stay on the channel as pre-satisfied requirements that never demand a solve section. Same-single-unit division discharges the unit's requirement; ident requirements never discharge.

**`bind` preserves `Result` and `Requires` (fix).** Previously `Calc.bind` accepted only number-kind, requirement-free expressions: binding a dimensioned or ident-carrying tree was a type error. It now takes any expression and preserves both facets — `Calc.bind(Calc.multiply(Calc.var('t'), Length.vw(1)), { t: 2 })` is a `Calc<never, Unit.Vw, Unit.Vw>`.

**Alias fix.** `Length<Vars>`, `Angle<Vars>`, and `Percentage<Vars>` now widen to `Calc<Vars, Unit.Length, unknown>` (and siblings), so ident-carrying dimensioned expressions like `Calc.multiply(Channel.L, Length.px(1))` are assignable to their family alias.
