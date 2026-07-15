/**
 * The `<percentage>` constructor. A percentage-kind expression composes with the
 * `Calc` combinators like any other dimension — `Calc.add` of two percentages is
 * a percentage, scaling one by a number stays a percentage, and one percentage
 * over another cancels to a `<number>` — while adding a bare number to a
 * percentage is a type error, so a raw `50` never slips into a percentage slot
 * as `50%` by accident.
 *
 * There is one unit (`%`), so the module is a single `of` constructor rather
 * than a family. A percentage binds and serializes but does not `solve`: its
 * only consumer today is `Color.mix`, which serializes rather than solves, so
 * the `%` leaf carries no `solve`-context ratio. (Nothing in the model needs to
 * know what a `50%` is a percentage *of* — that would only ever be a context
 * ratio supplied at `solve`, the same leaf lowering a viewport unit uses.)
 *
 * @since 0.2.0
 */

import type { Calc } from '#calc/calc'
import type { Precision } from '#calc/precision'
import * as internal from './percentage.internal.ts'
import type { Percent } from './units.ts'

/**
 * A percentage — a number rendered with a trailing `%`. `Percentage.of(40)`
 * serializes as `40%`. The value passes through unrounded; the optional
 * `Precision` pins serialization exactly as `Calc.of` does.
 *
 * @param value - The percentage magnitude (`40` for `40%`, not `0.4`).
 * @param precision - Optional serialization precision.
 * @returns A `<percentage>` expression.
 * @example
 * ```ts
 * Calc.serialize(Percentage.of(40)) // '40%'
 * Calc.serialize(Calc.add(Percentage.of(20), Percentage.of(5))) // '25%'
 * ```
 * @since 0.2.0
 */
export const of: (value: number, precision?: Precision) => Calc<never, 'percentage', Percent> =
  internal.of
