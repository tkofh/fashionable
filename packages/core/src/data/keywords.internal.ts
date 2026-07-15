import { Pipeable } from '#util'
import type { None } from './keywords.ts'

export const NoneTypeId = Symbol.for('fashionable/data/keywords/none')
export type NoneTypeId = typeof NoneTypeId

class NoneImpl extends Pipeable implements None {
  readonly [NoneTypeId]: NoneTypeId = NoneTypeId

  get [Symbol.toStringTag]() {
    return 'Keyword(none)'
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const none: None = new NoneImpl()

/** @internal */
export const isNone = (u: unknown): u is None =>
  typeof u === 'object' && u !== null && NoneTypeId in u
