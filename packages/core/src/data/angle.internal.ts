import type { Calc } from '#calc/calc'
import { dimension } from '#calc/calc.internal'
import type { Precision } from '#calc/precision'
import type * as Unit from './unit.ts'

/** @internal */
export const rad = (value: number, precision?: Precision): Calc<never, Unit.Rad, Unit.Rad> =>
  dimension(value, 'rad', 'angle', precision)

/** @internal */
export const deg = (value: number, precision?: Precision): Calc<never, Unit.Deg, Unit.Deg> =>
  dimension(value, 'deg', 'angle', precision)
