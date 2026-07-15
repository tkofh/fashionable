import type { Calc } from '#calc/calc'
import { dimension } from '#calc/calc.internal'
import type { Precision } from '#calc/precision'
import type * as Unit from './unit.ts'

/** @internal */
export const of = (value: number, precision?: Precision): Calc<never, Unit.Percent, Unit.Percent> =>
  dimension(value, '%', 'percentage', precision)
