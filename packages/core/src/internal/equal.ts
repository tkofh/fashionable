/**
 * A minimal structural equality and hashing protocol, modeled on Effect-TS's
 * Equal and Hash modules but reduced to what this library needs: value types
 * implement the two symbol methods on their Impl classes, and `equals` uses
 * the hash as a fast-path reject before dispatching to the symbol method.
 *
 * The protocol is internal. Each public namespace exposes a typed `equals`
 * that delegates here.
 */

export const EqualTypeId: unique symbol = Symbol.for('fashionable/Equal')
export type EqualTypeId = typeof EqualTypeId

export const HashTypeId: unique symbol = Symbol.for('fashionable/Hash')
export type HashTypeId = typeof HashTypeId

/** @internal */
export interface Equal {
  [EqualTypeId](that: unknown): boolean
  [HashTypeId](): number
}

/** @internal */
export const isEqual = (u: unknown): u is Equal =>
  typeof u === 'object' && u !== null && EqualTypeId in u

/** @internal */
export const equals = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true
  }
  if (isEqual(a) && isEqual(b)) {
    if (a[HashTypeId]() !== b[HashTypeId]()) {
      return false
    }
    return a[EqualTypeId](b)
  }
  return false
}

/** @internal */
export const hash = (u: unknown): number => {
  switch (typeof u) {
    case 'number':
      return hashNumber(u)
    case 'string':
      return hashString(u)
    case 'boolean':
      return u ? 1231 : 1237
    case 'undefined':
      return 0x9e3779b9 | 0
    case 'object':
      if (u === null) {
        return 0x85ebca6b | 0
      }
      if (isEqual(u)) {
        return u[HashTypeId]()
      }
      return 0
    default:
      return 0
  }
}

/**
 * Combines two hashes into one, order-sensitively (boost hash_combine).
 *
 * @internal
 */
export const combine = (a: number, b: number): number =>
  (a ^ (b + 0x9e3779b9 + (a << 6) + (a >>> 2))) | 0

/**
 * FNV-1a over UTF-16 code units.
 *
 * @internal
 */
export const hashString = (s: string): number => {
  let h = 0x811c9dc5 | 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h | 0
}

const numberBits = new DataView(new ArrayBuffer(8))

/**
 * Hashes a number by its float64 bit pattern. Negative zero is normalized
 * to positive zero first so values that compare equal hash equally.
 *
 * @internal
 */
export const hashNumber = (n: number): number => {
  numberBits.setFloat64(0, n === 0 ? 0 : n)
  return combine(numberBits.getInt32(0), numberBits.getInt32(4))
}

/** @internal */
export const hashArray = (values: ReadonlyArray<unknown>): number => {
  let h = 0x811c9dc5 | 0
  for (const value of values) {
    h = combine(h, hash(value))
  }
  return h
}
