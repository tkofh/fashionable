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
import * as internal from './angle.internal.ts'
import type { Angle as AngleUnit, Deg, Rad } from './units.ts'

/**
 * An `<angle>` expression: a `Calc` of angle kind, in any angle unit. Names the
 * dimension without spelling `Calc<Refs, 'angle', Unit.Angle>` — `Angle.rad(2)`
 * produces one, and it composes with every `Calc` combinator (subtracting two
 * angles is an angle, scaling by a number stays an angle). `Refs` unions the
 * unbound reference names, as on `Calc`.
 *
 * The leaf is the widened `Unit.Angle`, so every specific angle expression is
 * assignable to it; a constructor narrows it (`Angle.rad` carries `Unit.Rad`).
 *
 * @since 0.2.0
 */
export type Angle<Refs extends string = string> = Calc<Refs, 'angle', AngleUnit>

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
export const rad: (value: number, precision?: Precision) => Calc<never, 'angle', Rad> = internal.rad

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
export const deg: (value: number, precision?: Precision) => Calc<never, 'angle', Deg> = internal.deg
