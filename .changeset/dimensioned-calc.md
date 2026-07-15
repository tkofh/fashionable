---
'fashionable': minor
---

`Calc` now models `<length>`, `<angle>`, and `<percentage>`, not just `<number>`, and tracks each expression's dimension and units at the type level. A new `fashionable/data` module supplies the constructors — `Length.px`/`rem`/`em`/`vw`/`vh`/`vmin`/`vmax`, `Angle.rad`, and `Percentage.of` — and every math combinator threads the dimension through.

```ts
import { Calc } from 'fashionable/calc'
import { Length } from 'fashionable/data'

const ratio = Calc.divide(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160))
// Calc.Calc<never, 'number', Unit.Vw | Unit.Px> — a <length> over a <length> is a <number>
Calc.serialize(ratio) // 'calc((100vw - 320px) / 160px)'
```

The dimensional rules follow CSS and are enforced in the types: `add`/`subtract`/`min`/`max`/`clamp` require a shared kind, `multiply` scales a dimension by a number, and `divide` of two like dimensions is a number. Illegal combinations are compile errors — `Calc.add(Length.px(10), 5)` (a length plus a number) and `Calc.multiply(Length.px(10), Length.px(10))` (two lengths) both fail to typecheck, rather than emitting invalid CSS. `<percentage>` is its own kind under these same rules — `Percentage.of(40)` serializes as `40%`, percentages fold and scale together (`Calc.add(Percentage.of(20), Percentage.of(5))` is `25%`), and a percentage over a percentage is a number — but, unlike a length or angle, it serializes and does not `solve`.

**Solving through a unit context.** A closed number-or-angle tree still solves directly; a tree carrying viewport- or font-relative units lowers them through a context, so one tree serves verification and serialization at once:

```ts
Calc.solve(ratio, {}, { vw: 1280 / 100 }) // 6 — the ratio at a 1280px viewport
```

Absolute lengths (`px`) and angles (radians) solve with no context; a relative unit requires a ratio, typed by the expression's units so the context can neither miss nor mismatch a key.

**New `tan` and `atan2`.** `atan2(y, x)` returns an `<angle>` from two same-kind operands, and `tan(atan2(a, b))` divides two dimensions to a `<number>` — the portable form of a `<length>` ratio, since Firefox does not yet support `<length> / <length>` in `calc()`. The two forms are interchangeable (same kind, same units, same solved value).

**Dimensioned values at the seams.** `Declaration.make('--gap', Length.px(8))` now works without string assembly, and a `@property` `<length>`/`<angle>`/`<percentage>` initial value accepts a closed dimensioned `Calc`, restricted to computationally-independent absolute units per the spec (so `Length.px(8)` registers, `Length.vw(8)` is rejected).

**`add`/`min`/`max` are now single variadic signatures** — reference inference no longer caps at four operands.

### Breaking: `acos` returns an `<angle>`, and trig takes angles

`sin`/`cos`/`tan` accept a plain number (radians) or an `<angle>`, and `acos` returns an `<angle>`. This replaces the previous behavior where a plain number was implicitly given a `rad` unit beside an `acos` result. Supply the angle explicitly:

```ts
import { Angle } from 'fashionable/data'

// before: Calc.subtract(Calc.divide(Calc.acos(u), 3), 2.0943951)
// after:
Calc.subtract(Calc.divide(Calc.acos(u), 3), Angle.rad(2.0943951))
```

The serialized output is unchanged (`… / 3 - 2.0944rad`); only the authoring is now explicit, and `<angle> - <number>` is a type error.
