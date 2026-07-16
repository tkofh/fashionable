import type { Calc } from '#calc/calc'
import { dimension } from '#calc/calc.internal'
import type { Precision } from '#calc/precision'
import type * as Unit from './unit.ts'

/** @internal */
export const px = (value: number, precision?: Precision): Calc<never, Unit.Px, Unit.Px> =>
  dimension(value, 'px', 'length', precision)

/** @internal */
export const rem = (value: number, precision?: Precision): Calc<never, Unit.Rem, Unit.Rem> =>
  dimension(value, 'rem', 'length', precision)

/** @internal */
export const em = (value: number, precision?: Precision): Calc<never, Unit.Em, Unit.Em> =>
  dimension(value, 'em', 'length', precision)

/** @internal */
export const vw = (value: number, precision?: Precision): Calc<never, Unit.Vw, Unit.Vw> =>
  dimension(value, 'vw', 'length', precision)

/** @internal */
export const vh = (value: number, precision?: Precision): Calc<never, Unit.Vh, Unit.Vh> =>
  dimension(value, 'vh', 'length', precision)

/** @internal */
export const vmin = (value: number, precision?: Precision): Calc<never, Unit.Vmin, Unit.Vmin> =>
  dimension(value, 'vmin', 'length', precision)

/** @internal */
export const vmax = (value: number, precision?: Precision): Calc<never, Unit.Vmax, Unit.Vmax> =>
  dimension(value, 'vmax', 'length', precision)
