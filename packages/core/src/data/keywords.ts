/**
 * Value-position keywords. CSS reuses a small set of keywords inside
 * otherwise-typed value slots; the constants here give those slots a
 * branded value to accept — a position that takes one declares it in
 * its signature, so keyword acceptance is explicit per position rather
 * than ambient.
 *
 * Only `none` is modeled today; siblings arrive as consumers need them.
 *
 * @since 0.2.0
 */

import type { Pipeable } from '#util'
import type { NoneTypeId } from './keywords.internal.ts'
import * as internal from './keywords.internal.ts'

/**
 * The type of `none` alone. Naming it lets accepting positions spell
 * their signatures (`Input<R> | Keyword.None`) and overloads recognize
 * the keyword.
 *
 * @since 0.2.0
 */
export interface None extends Pipeable {
  readonly [NoneTypeId]: NoneTypeId
}

/**
 * The `none` keyword — CSS's missing-component value. Accepted where a
 * position declares it: color channels today (`oklch(0 0 none)`), other
 * slots as they arrive.
 *
 * @since 0.2.0
 */
export const none: None = internal.none

/**
 * Checks if a value is the `none` keyword.
 *
 * True only for `none` itself, which carries the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is `none`, `false` otherwise.
 * @since 0.2.0
 */
export const isNone: (u: unknown) => u is None = internal.isNone
