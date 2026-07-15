/**
 * `<angle>` constructors. An angle-kind expression composes with the `Calc`
 * combinators like any other dimension — `Calc.subtract` of two angles is an
 * angle, scaling by a number stays an angle — and subtracting a plain number
 * from an angle is a type error, so the radian phase of a trig expression is
 * written `Angle.rad(...)` rather than a bare number.
 *
 * Only `rad` is modeled today; `deg`/`turn`/`grad` arrive as a consumer needs
 * them.
 *
 * @since 0.2.0
 */

import type { Calc } from '#calc/calc'
import type { Precision } from '#calc/precision'
import * as internal from './angle.internal.ts'
import type { Rad } from './units.ts'

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
