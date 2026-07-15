import type { Calc } from '#calc/calc'
import { dimension } from '#calc/calc.internal'
import type { Precision } from '#calc/precision'
import type { Em, Px, Rem, Vh, Vmax, Vmin, Vw } from './units.ts'

/** @internal */
export const px = (value: number, precision?: Precision): Calc<never, 'length', Px> =>
  dimension(value, 'px', 'length', precision)

/** @internal */
export const rem = (value: number, precision?: Precision): Calc<never, 'length', Rem> =>
  dimension(value, 'rem', 'length', precision)

/** @internal */
export const em = (value: number, precision?: Precision): Calc<never, 'length', Em> =>
  dimension(value, 'em', 'length', precision)

/** @internal */
export const vw = (value: number, precision?: Precision): Calc<never, 'length', Vw> =>
  dimension(value, 'vw', 'length', precision)

/** @internal */
export const vh = (value: number, precision?: Precision): Calc<never, 'length', Vh> =>
  dimension(value, 'vh', 'length', precision)

/** @internal */
export const vmin = (value: number, precision?: Precision): Calc<never, 'length', Vmin> =>
  dimension(value, 'vmin', 'length', precision)

/** @internal */
export const vmax = (value: number, precision?: Precision): Calc<never, 'length', Vmax> =>
  dimension(value, 'vmax', 'length', precision)
