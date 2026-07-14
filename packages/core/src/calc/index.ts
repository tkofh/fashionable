import * as CalcNs from './calc.ts'
import * as PrecisionNs from './precision.ts'

export type Calc<Refs extends string = string> = CalcNs.Calc<Refs>
export type Precision = PrecisionNs.Precision

export { CalcNs as Calc }
export { PrecisionNs as Precision }
