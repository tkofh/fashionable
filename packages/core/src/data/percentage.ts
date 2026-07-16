/**
 * The `<percentage>` constructor. A percentage-kind expression composes with the
 * `Calc` combinators like any other dimension — `Calc.add` of two percentages is
 * a percentage, scaling one by a number stays a percentage, and one percentage
 * over another cancels to a `<number>` — while adding a bare number to a
 * percentage is a type error, so a raw `50` never slips into a percentage slot
 * as `50%` by accident.
 *
 * There is one unit (`%`), so the module is a single `of` constructor rather
 * than a family. A percentage solves like a relative length: nothing in the
 * model knows what a `50%` is a percentage *of*, so the `%` leaf takes a
 * required ratio in the `units` section of the solve options — `basis / 100`,
 * per-hundred exactly as `vw` takes `sampleWidth / 100`.
 *
 * @since 0.2.0
 */

import type { Calc } from '#calc/calc'
import type { Precision } from '#calc/precision'
import type { Var } from '#var'
import * as internal from './percentage.internal.ts'
import type * as Unit from './unit.ts'

/**
 * A `<percentage>` expression: a `Calc` of percentage kind. Names the dimension
 * without spelling `Calc<Vars, Unit.Percentage, unknown>` —
 * `Percentage.of(40)` produces one, and it composes with every `Calc`
 * combinator (adding two percentages is a percentage, one over another is a
 * number). `Vars` unions the unbound variable names, as on `Calc`.
 *
 * @since 0.2.0
 */
export interface Percentage<out Vars extends Var.Any = Var.Any> extends Calc<
  Vars,
  Unit.Percentage,
  unknown
> {}

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
 * Calc.solve(Percentage.of(50), { units: { '%': 320 / 100 } }) // 160
 * ```
 * @since 0.2.0
 */
export const of: (value: number, precision?: Precision) => Calc<never, Unit.Percent, Unit.Percent> =
  internal.of
