/**
 * The `<length-percentage>` expression type: a `Calc` whose Result spans
 * both the length and percentage families, the shape of mixed expressions
 * like `calc(100% - 24px)`.
 *
 * Mixing is anchored, never ambient: a length plus a percentage is only
 * meaningful where the destination accepts a `<length-percentage>`, so the
 * algebra admits a length or percentage operand *beside a
 * length-percentage expression* — a read of a `Var.lengthPercentage`
 * variable, or a value widened through `of` — while a bare `px + %` sum
 * stays a type error. The anchor is the assertion about the destination.
 *
 * @since 0.4.0
 */

import type { Calc } from '#calc/calc'
import type { Var } from '#var'
import * as internal from './lengthPercentage.internal.ts'
import type * as Unit from './unit.ts'

/**
 * A `<length-percentage>` expression: a `Calc` whose Result spans the
 * length and percentage families. Every plain length and every percentage
 * is assignable to it; anchoring an operation on one admits operands from
 * both families, and the sum stays a `<length-percentage>`.
 *
 * Declared as an interface rather than a type alias so the name survives
 * inference — the shape a `Var.lengthPercentage` handle's `Type` slot
 * displays.
 *
 * @since 0.4.0
 */
// point: structurally identical to its base, nominal-looking in hovers
export interface LengthPercentage<out Vars extends Var.Any = Var.Any> extends Calc<
  Vars,
  Unit.LengthPercentage,
  unknown
> {}

type VarsOf<A> = A extends Calc<infer V, Unit.Any, unknown> ? V : never
type RequiresOf<A> = A extends Calc<Var.Any, Unit.Any, infer Q> ? Q : never

/**
 * Widens a length or percentage expression to a `<length-percentage>` —
 * the identity at runtime, an anchor at the type level. Widening is what
 * unlocks mixing: the combinators key their operand family on the first
 * argument, so `Calc.subtract(LengthPercentage.of(Percentage.of(100)),
 * Length.px(24))` builds `calc(100% - 24px)` where the unwidened spelling
 * is a cross-family type error.
 *
 * A `<length-percentage>` read (`Calc.var(Var.lengthPercentage('inset'))`)
 * is already this wide; `of` serves values built from concrete units.
 *
 * @param value - A length, percentage, or already-mixed expression.
 * @returns The same expression, typed as a `<length-percentage>`.
 * @example
 * ```ts
 * const inset = LengthPercentage.of(Percentage.of(100))
 * Calc.serialize(Calc.subtract(inset, Length.px(24))) // 'calc(100% - 24px)'
 * ```
 * @since 0.4.0
 */
export const of: <A extends Calc<Var.Any, Unit.LengthPercentage, unknown>>(
  value: A,
) => Calc<VarsOf<A>, Unit.LengthPercentage, RequiresOf<A>> = internal.of
