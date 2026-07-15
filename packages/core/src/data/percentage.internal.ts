import type { Calc } from '#calc/calc'
import { dimension } from '#calc/calc.internal'
import type { Precision } from '#calc/precision'
import type { Percent } from './units.ts'

/** @internal */
export const of = (value: number, precision?: Precision): Calc<never, 'percentage', Percent> =>
  dimension(value, '%', 'percentage', precision)
