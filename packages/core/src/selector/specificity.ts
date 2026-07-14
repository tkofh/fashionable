import type { Pipeable } from '../utils.ts'
import type { SpecificityTypeId } from './specificity.internal.ts'
import * as internal from './specificity.internal.ts'

/**
 * A selector specificity: the `(a, b, c)` triple the cascade compares
 * lexicographically — id count, then class/attribute/pseudo-class count,
 * then type/pseudo-element count.
 *
 * Computed from selectors via `Selector.specificity`; construct directly
 * with `make` when asserting expectations.
 *
 * @since 0.1.0
 */
export interface Specificity extends Pipeable {
  readonly [SpecificityTypeId]: SpecificityTypeId
  /**
   * The id-selector count.
   */
  readonly a: number
  /**
   * The class, attribute, and pseudo-class count.
   */
  readonly b: number
  /**
   * The type and pseudo-element count.
   */
  readonly c: number
}

/**
 * Checks if a value is a `Specificity`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `Specificity`, `false` otherwise.
 * @since 0.1.0
 */
export const isSpecificity: (u: unknown) => u is Specificity = internal.isSpecificity

/**
 * Creates a `Specificity` from its three components.
 *
 * @param a - The id-selector count. Must be a non-negative integer.
 * @param b - The class/attribute/pseudo-class count. Must be a non-negative integer.
 * @param c - The type/pseudo-element count. Must be a non-negative integer.
 * @returns A new `Specificity`.
 * @throws `Error` when any component is not a non-negative integer.
 * @since 0.1.0
 */
export const make: (a: number, b: number, c: number) => Specificity = internal.make

export const compare: {
  /**
   * Returns a function that compares its argument against `that`.
   *
   * @param that - The specificity to compare against.
   * @returns A function returning the cascade ordering of its argument relative to `that`.
   * @since 0.1.0
   */
  (that: Specificity): (self: Specificity) => -1 | 0 | 1
  /**
   * Compares two specificities the way the cascade does: lexicographically
   * by `a`, then `b`, then `c`.
   *
   * @param self - The first specificity.
   * @param that - The second specificity.
   * @returns `-1` if `self` is less specific, `1` if more, `0` if equal.
   * @example
   * ```ts
   * Specificity.compare(Specificity.make(1, 0, 0), Specificity.make(0, 9, 9)) // 1
   * ```
   * @since 0.1.0
   */
  (self: Specificity, that: Specificity): -1 | 0 | 1
} = internal.compare

export const equals: {
  /**
   * Returns a function that checks equality against `that`.
   *
   * @param that - The specificity to compare against.
   * @returns A function testing its argument for equality with `that`.
   * @since 0.1.0
   */
  (that: Specificity): (self: Specificity) => boolean
  /**
   * Component-wise equality of two specificities.
   *
   * @param self - The first specificity.
   * @param that - The second specificity.
   * @returns `true` if all three components match.
   * @since 0.1.0
   */
  (self: Specificity, that: Specificity): boolean
} = internal.equals
