import * as Equal from '#internal/equal'
import { dual, invariant, Pipeable } from '#util'
import type { Specificity } from './specificity.ts'

export const SpecificityTypeId = Symbol.for('fashionable/selector/specificity')
export type SpecificityTypeId = typeof SpecificityTypeId

class SpecificityImpl extends Pipeable implements Specificity, Equal.Equal {
  readonly [SpecificityTypeId]: SpecificityTypeId = SpecificityTypeId

  readonly a: number
  readonly b: number
  readonly c: number

  constructor(a: number, b: number, c: number) {
    super()
    this.a = a
    this.b = b
    this.c = c
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return isSpecificity(that) && this.a === that.a && this.b === that.b && this.c === that.c
  }

  [Equal.HashTypeId](): number {
    let h = Equal.hashString('fashionable/selector/specificity')
    h = Equal.combine(h, this.a | 0)
    h = Equal.combine(h, this.b | 0)
    h = Equal.combine(h, this.c | 0)
    return h
  }

  get [Symbol.toStringTag]() {
    return `Specificity(${this.a}, ${this.b}, ${this.c})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isSpecificity = (u: unknown): u is Specificity =>
  typeof u === 'object' && u !== null && SpecificityTypeId in u

/** @internal */
export const make = (a: number, b: number, c: number): Specificity => {
  invariant(
    Number.isInteger(a) && a >= 0 && Number.isInteger(b) && b >= 0 && Number.isInteger(c) && c >= 0,
    `Specificity components must be non-negative integers, got (${a}, ${b}, ${c})`,
  )
  return new SpecificityImpl(a, b, c)
}

/** @internal */
export const zero: Specificity = make(0, 0, 0)

/** @internal */
export const sum = (specificities: ReadonlyArray<Specificity>): Specificity => {
  let a = 0
  let b = 0
  let c = 0
  for (const specificity of specificities) {
    a += specificity.a
    b += specificity.b
    c += specificity.c
  }
  return make(a, b, c)
}

/** @internal */
export const compare = dual<
  (that: Specificity) => (self: Specificity) => -1 | 0 | 1,
  (self: Specificity, that: Specificity) => -1 | 0 | 1
>(2, (self: Specificity, that: Specificity): -1 | 0 | 1 => {
  if (self.a !== that.a) {
    return self.a < that.a ? -1 : 1
  }
  if (self.b !== that.b) {
    return self.b < that.b ? -1 : 1
  }
  if (self.c !== that.c) {
    return self.c < that.c ? -1 : 1
  }
  return 0
})

/** @internal */
export const equals = dual<
  (that: Specificity) => (self: Specificity) => boolean,
  (self: Specificity, that: Specificity) => boolean
>(2, (self: Specificity, that: Specificity): boolean => Equal.equals(self, that))
