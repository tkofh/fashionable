import type { Calc } from '#calc/calc'
import { dimension } from '#calc/calc.internal'
import type { Precision } from '#calc/precision'
import type { Deg, Rad } from './units.ts'

/** @internal */
export const rad = (value: number, precision?: Precision): Calc<never, 'angle', Rad> =>
  dimension(value, 'rad', 'angle', precision)

/** @internal */
export const deg = (value: number, precision?: Precision): Calc<never, 'angle', Deg> =>
  dimension(value, 'deg', 'angle', precision)
