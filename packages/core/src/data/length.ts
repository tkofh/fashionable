/**
 * `<length>` constructors. Each builds a dimensioned `Calc` constant — a
 * `<length>`-kind expression carrying its unit brand — that composes through
 * the `Calc` combinators: `Calc.add(Length.px(16), Length.vw(2))` is a
 * `<length>`, `Calc.divide` of two lengths is a `<number>`, and adding a length
 * to a plain number is a type error.
 *
 * Values pass through unrounded; the optional `Precision` pins serialization
 * exactly as `Calc.of` does. The unit is applied structurally, so it survives
 * `vars`, structural equality, and folding — no string assembly.
 *
 * @since 0.2.0
 */

import type { Calc } from '#calc/calc'
import type { Precision } from '#calc/precision'
import * as internal from './length.internal.ts'
import type * as Unit from './unit.ts'

/**
 * A `<length>` expression: a `Calc` of length kind, in any length unit. Names
 * the dimension without spelling `Calc<Vars, Unit.Length, unknown>` —
 * `Length.px(16)` produces one, and it composes with every `Calc` combinator
 * (adding two lengths is a length, dividing one by another is a number). `Vars`
 * unions the unbound variable names, as on `Calc`.
 *
 * The result is the widened `Unit.Length` and the requirements stay open, so
 * a mixed-unit sum (`Calc.add(Length.px(16), Length.vw(2))`) and every
 * single-unit length are alike assignable to it.
 *
 * @since 0.2.0
 */
export type Length<Vars extends string = string> = Calc<Vars, Unit.Length, unknown>

/**
 * A length in `px` (absolute pixels).
 *
 * @param value - The pixel count.
 * @param precision - Optional serialization precision.
 * @returns A `px` length expression.
 * @example
 * ```ts
 * Calc.serialize(Length.px(16)) // '16px'
 * ```
 * @since 0.2.0
 */
export const px: (value: number, precision?: Precision) => Calc<never, Unit.Px, Unit.Px> =
  internal.px

/**
 * A length in `rem` (relative to the root font size).
 *
 * @param value - The multiple of the root font size.
 * @param precision - Optional serialization precision.
 * @returns A `rem` length expression.
 * @since 0.2.0
 */
export const rem: (value: number, precision?: Precision) => Calc<never, Unit.Rem, Unit.Rem> =
  internal.rem

/**
 * A length in `em` (relative to the element font size).
 *
 * @param value - The multiple of the element font size.
 * @param precision - Optional serialization precision.
 * @returns An `em` length expression.
 * @since 0.2.0
 */
export const em: (value: number, precision?: Precision) => Calc<never, Unit.Em, Unit.Em> =
  internal.em

/**
 * A length in `vw` (1% of the viewport width).
 *
 * @param value - The percentage of viewport width.
 * @param precision - Optional serialization precision.
 * @returns A `vw` length expression.
 * @since 0.2.0
 */
export const vw: (value: number, precision?: Precision) => Calc<never, Unit.Vw, Unit.Vw> =
  internal.vw

/**
 * A length in `vh` (1% of the viewport height).
 *
 * @param value - The percentage of viewport height.
 * @param precision - Optional serialization precision.
 * @returns A `vh` length expression.
 * @since 0.2.0
 */
export const vh: (value: number, precision?: Precision) => Calc<never, Unit.Vh, Unit.Vh> =
  internal.vh

/**
 * A length in `vmin` (1% of the smaller viewport axis).
 *
 * @param value - The percentage of the smaller viewport axis.
 * @param precision - Optional serialization precision.
 * @returns A `vmin` length expression.
 * @since 0.2.0
 */
export const vmin: (value: number, precision?: Precision) => Calc<never, Unit.Vmin, Unit.Vmin> =
  internal.vmin

/**
 * A length in `vmax` (1% of the larger viewport axis).
 *
 * @param value - The percentage of the larger viewport axis.
 * @param precision - Optional serialization precision.
 * @returns A `vmax` length expression.
 * @since 0.2.0
 */
export const vmax: (value: number, precision?: Precision) => Calc<never, Unit.Vmax, Unit.Vmax> =
  internal.vmax
