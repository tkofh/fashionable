import type { Pipeable } from '#util'
import type { MediaQueryTypeId } from './mediaQuery.internal.ts'
import * as internal from './mediaQuery.internal.ts'

/**
 * A media query: a canonically ordered, deduplicated and-set of media
 * features.
 *
 * Feature constructors (`minWidth`, `prefersColorScheme`) return
 * one-feature queries; `and` merges. Conjunction is commutative and
 * idempotent, so construction sorts features canonically and drops exact
 * duplicates — structurally equal queries compare equal however they
 * were built. Distinct features always all render, even when one
 * subsumes another (`minWidth(768)` and `minWidth(1024)`): simplification
 * changes no meaning but is not this type's job.
 *
 * `or` and `not` become new node kinds when a consumer needs them.
 *
 * @since 0.1.0
 */
export interface MediaQuery extends Pipeable {
  readonly [MediaQueryTypeId]: MediaQueryTypeId
}

/**
 * Options for `render` — and the base of the library's render-options
 * family: every other module's `RenderOptions` extends this interface
 * (directly or through `Declaration.RenderOptions` and
 * `RuleSet.RenderOptions`), so an options object built for a bigger
 * renderer is accepted by every smaller one. A key means the same thing
 * wherever it appears; renderers ignore inherited keys that don't apply
 * to them.
 *
 * @since 0.1.0
 */
export interface RenderOptions {
  /**
   * The width-feature spelling: classic prefix syntax
   * (`(min-width: 768px)`, the default) or modern range syntax
   * (`(width >= 768px)`). Text only — the model is semantic and the two
   * spellings mean the same thing.
   */
  readonly mediaSyntax?: 'prefix' | 'range'
}

/**
 * Checks if a value is a `MediaQuery`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `MediaQuery`, `false` otherwise.
 * @since 0.1.0
 */
export const isMediaQuery: (u: unknown) => u is MediaQuery = internal.isMediaQuery

/**
 * Creates a viewport-width lower bound.
 *
 * @param px - The threshold in CSS pixels. Must be a non-negative finite number.
 * @returns A one-feature `MediaQuery`.
 * @throws `Error` when `px` is negative or not finite.
 * @example
 * ```ts
 * MediaQuery.render(MediaQuery.minWidth(768)) // '(min-width: 768px)'
 * MediaQuery.render(MediaQuery.minWidth(768), { mediaSyntax: 'range' }) // '(width >= 768px)'
 * ```
 * @since 0.1.0
 */
export const minWidth: (px: number) => MediaQuery = internal.minWidth

/**
 * Creates a `prefers-color-scheme` condition.
 *
 * @param scheme - The scheme to match, `'dark'` or `'light'`.
 * @returns A one-feature `MediaQuery`.
 * @since 0.1.0
 */
export const prefersColorScheme: (scheme: 'dark' | 'light') => MediaQuery =
  internal.prefersColorScheme

export const and: {
  /**
   * Returns a function that conjoins `that` with its argument.
   *
   * @param that - The query to merge in.
   * @returns A function producing the conjunction.
   * @since 0.1.0
   */
  (that: MediaQuery): (self: MediaQuery) => MediaQuery
  /**
   * Conjoins two queries: the result matches where both match. Features
   * re-sort into canonical order and exact duplicates collapse, so `and`
   * is commutative and idempotent.
   *
   * @param self - The first query.
   * @param that - The second query.
   * @returns The conjunction.
   * @example
   * ```ts
   * MediaQuery.minWidth(1280).pipe(
   *   MediaQuery.and(MediaQuery.prefersColorScheme('dark')),
   *   MediaQuery.render,
   * ) // '(min-width: 1280px) and (prefers-color-scheme: dark)'
   * ```
   * @since 0.1.0
   */
  (self: MediaQuery, that: MediaQuery): MediaQuery
} = internal.and

/**
 * Renders the query as CSS text: features in canonical order, joined
 * with ` and `. The `mediaSyntax` option picks the width-feature
 * spelling (default `'prefix'`).
 *
 * @param query - The query to render.
 * @param options - Optional syntax selection.
 * @returns Deterministic CSS text, without the `@media ` prefix.
 * @since 0.1.0
 */
export const render: (query: MediaQuery, options?: RenderOptions) => string = internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The query to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: MediaQuery): (self: MediaQuery) => boolean
  /**
   * Structural equality over canonically ordered features: two queries
   * built from the same conditions compare equal regardless of
   * construction order.
   *
   * @param self - The first query.
   * @param that - The second query.
   * @returns `true` if the queries are structurally equal.
   * @since 0.1.0
   */
  (self: MediaQuery, that: MediaQuery): boolean
} = internal.equals
