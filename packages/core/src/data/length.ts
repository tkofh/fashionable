/**
 * `<length>` constructors. Each builds a dimensioned `Calc` constant — a
 * `<length>`-kind expression carrying its unit brand — that composes through
 * the `Calc` combinators: `Calc.add(Length.px(16), Length.vw(2))` is a
 * `<length>`, `Calc.divide` of two lengths is a `<number>`, and adding a length
 * to a plain number is a type error.
 *
 * Values pass through unrounded; the optional `Precision` pins serialization
 * exactly as `Calc.of` does. The unit is applied structurally, so it survives
 * `refs`, structural equality, and folding — no string assembly.
 *
 * @since 0.2.0
 */

import type { Calc } from '#calc/calc'
import type { Precision } from '#calc/precision'
import * as internal from './length.internal.ts'
import type { Em, Px, Rem, Vh, Vmax, Vmin, Vw } from './units.ts'

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
export const px: (value: number, precision?: Precision) => Calc<never, 'length', Px> = internal.px

/**
 * A length in `rem` (relative to the root font size).
 *
 * @param value - The multiple of the root font size.
 * @param precision - Optional serialization precision.
 * @returns A `rem` length expression.
 * @since 0.2.0
 */
export const rem: (value: number, precision?: Precision) => Calc<never, 'length', Rem> =
  internal.rem

/**
 * A length in `em` (relative to the element font size).
 *
 * @param value - The multiple of the element font size.
 * @param precision - Optional serialization precision.
 * @returns An `em` length expression.
 * @since 0.2.0
 */
export const em: (value: number, precision?: Precision) => Calc<never, 'length', Em> = internal.em

/**
 * A length in `vw` (1% of the viewport width).
 *
 * @param value - The percentage of viewport width.
 * @param precision - Optional serialization precision.
 * @returns A `vw` length expression.
 * @since 0.2.0
 */
export const vw: (value: number, precision?: Precision) => Calc<never, 'length', Vw> = internal.vw

/**
 * A length in `vh` (1% of the viewport height).
 *
 * @param value - The percentage of viewport height.
 * @param precision - Optional serialization precision.
 * @returns A `vh` length expression.
 * @since 0.2.0
 */
export const vh: (value: number, precision?: Precision) => Calc<never, 'length', Vh> = internal.vh

/**
 * A length in `vmin` (1% of the smaller viewport axis).
 *
 * @param value - The percentage of the smaller viewport axis.
 * @param precision - Optional serialization precision.
 * @returns A `vmin` length expression.
 * @since 0.2.0
 */
export const vmin: (value: number, precision?: Precision) => Calc<never, 'length', Vmin> =
  internal.vmin

/**
 * A length in `vmax` (1% of the larger viewport axis).
 *
 * @param value - The percentage of the larger viewport axis.
 * @param precision - Optional serialization precision.
 * @returns A `vmax` length expression.
 * @since 0.2.0
 */
export const vmax: (value: number, precision?: Precision) => Calc<never, 'length', Vmax> =
  internal.vmax
