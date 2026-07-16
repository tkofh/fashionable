/**
 * `<angle>` constructors. An angle-kind expression composes with the `Calc`
 * combinators like any other dimension — `Calc.subtract` of two angles is an
 * angle, scaling by a number stays an angle — and subtracting a plain number
 * from an angle is a type error, so the radian phase of a trig expression is
 * written `Angle.rad(...)` rather than a bare number.
 *
 * `rad` and `deg` are modeled today; `turn`/`grad` arrive as a consumer needs
 * them.
 *
 * @since 0.2.0
 */

import type { Calc } from '#calc/calc'
import type { Precision } from '#calc/precision'
import type { Var } from '#var'
import * as internal from './angle.internal.ts'
import type * as Unit from './unit.ts'

/**
 * An `<angle>` expression: a `Calc` of angle kind, in any angle unit. Names the
 * dimension without spelling `Calc<Vars, Unit.Angle, unknown>` — `Angle.rad(2)`
 * produces one, and it composes with every `Calc` combinator (subtracting two
 * angles is an angle, scaling by a number stays an angle). `Vars` unions the
 * unbound variable names, as on `Calc`.
 *
 * The result is the widened `Unit.Angle`, so every specific angle expression
 * is assignable to it; a constructor narrows it (`Angle.rad` carries `Unit.Rad`). Declared as an
 * interface so the name survives inference — the shape a typed `Var`'s
 * `Type` slot displays.
 *
 * @since 0.2.0
 */
export interface Angle<out Vars extends Var.Any = Var.Any> extends Calc<
  Vars,
  Unit.Angle,
  unknown
> {}

/**
 * An angle in `rad` (radians). Radians are the numeric measure of an angle, so
 * a radian-only expression solves with no unit context.
 *
 * @param value - The angle in radians.
 * @param precision - Optional serialization precision.
 * @returns A `rad` angle expression.
 * @example
 * ```ts
 * Calc.serialize(Angle.rad(1.5708)) // '1.5708rad'
 * ```
 * @since 0.2.0
 */
export const rad: (value: number, precision?: Precision) => Calc<never, Unit.Rad, Unit.Rad> =
  internal.rad

/**
 * An angle in `deg` (degrees). Degrees lower to radians at solve (`180deg` is
 * `pi`), a fixed ratio, so a degree-only expression solves with no unit context.
 *
 * @param value - The angle in degrees.
 * @param precision - Optional serialization precision.
 * @returns A `deg` angle expression.
 * @example
 * ```ts
 * Calc.serialize(Angle.deg(45)) // '45deg'
 * ```
 * @since 0.2.0
 */
export const deg: (value: number, precision?: Precision) => Calc<never, Unit.Deg, Unit.Deg> =
  internal.deg
