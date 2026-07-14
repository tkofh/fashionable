import type { FormatSpec } from '#internal/format'
import { invariant, Pipeable } from '#util'
import type { Precision } from './precision.ts'

export const PrecisionTypeId = Symbol.for('fashionable/calc/precision')
export type PrecisionTypeId = typeof PrecisionTypeId

class PrecisionImpl extends Pipeable implements Precision {
  readonly [PrecisionTypeId]: PrecisionTypeId = PrecisionTypeId

  readonly mode: 'decimals' | 'significant'
  readonly digits: number

  constructor(mode: 'decimals' | 'significant', digits: number) {
    super()
    this.mode = mode
    this.digits = digits
  }

  get [Symbol.toStringTag]() {
    return `Precision.${this.mode}(${this.digits})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isPrecision = (u: unknown): u is Precision =>
  typeof u === 'object' && u !== null && PrecisionTypeId in u

/** @internal */
export const decimals = (digits: number): Precision => {
  invariant(
    Number.isInteger(digits) && digits >= 0 && digits <= 100,
    `decimals digits must be an integer in [0, 100], got ${digits}`,
  )
  return new PrecisionImpl('decimals', digits)
}

/** @internal */
export const significant = (digits: number): Precision => {
  invariant(
    Number.isInteger(digits) && digits >= 1 && digits <= 100,
    `significant digits must be an integer in [1, 100], got ${digits}`,
  )
  return new PrecisionImpl('significant', digits)
}

/** @internal */
export const toSpec = (precision: Precision): FormatSpec => ({
  mode: precision.mode,
  digits: precision.digits,
})
