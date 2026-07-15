import type { Pipeable } from '#util'
import type { MediaQueryFeatures, MediaQueryTypeId } from './mediaQuery.internal.ts'
import * as internal from './mediaQuery.internal.ts'

declare const MinWidthId: unique symbol
declare const MaxWidthId: unique symbol
declare const PrefersColorSchemeId: unique symbol

/**
 * A media query: a canonically ordered, deduplicated and-set of media
 * features.
 *
 * Feature constructors (`minWidth`, `maxWidth`, `prefersColorScheme`)
 * return one-feature queries; `and` merges. Conjunction is commutative
 * and idempotent, so construction sorts features canonically and drops
 * exact duplicates — structurally equal queries compare equal however
 * they were built. The canonical order is stable public API: `min-width`
 * features first (ascending by threshold), then `max-width` (ascending),
 * then `prefers-color-scheme` (schemes alphabetically). Distinct features
 * always all render, even when one subsumes another (`minWidth(768)` and
 * `minWidth(1024)`): simplification changes no meaning but is not this
 * type's job.
 *
 * `Features` records, as intersected type-level brands, which feature
 * kinds are known to be present. It defaults to `unknown` — no claims.
 * Constructors brand their result (`minWidth` returns
 * `MediaQuery<MinWidth>`), `and` keeps both sides' brands, the `has*`
 * guards recover a brand from a plain query at runtime, and the `get*`
 * accessors key their return type on it to drop `undefined`. Brands are
 * type-level only: a query is identical at runtime whatever its type
 * knows.
 *
 * `or` and `not` become new node kinds when a consumer needs them.
 *
 * @since 0.1.0
 */
export interface MediaQuery<out Features = unknown> extends Pipeable {
  readonly [MediaQueryTypeId]: MediaQueryTypeId
  readonly [MediaQueryFeatures]?: Features
}

/**
 * The brand of a query known to carry a `min-width` feature. `minWidth`
 * stamps it, `and` keeps it through conjunction, `hasMinWidth` recovers
 * it at runtime, and `getMinWidth` returns a guaranteed `number` where it
 * is present. Composes by intersection with the other feature brands.
 *
 * @since 0.3.0
 */
export type MinWidth = { readonly [MinWidthId]: 'minWidth' }

/**
 * The brand of a query known to carry a `max-width` feature. `maxWidth`
 * stamps it, `and` keeps it through conjunction, `hasMaxWidth` recovers
 * it at runtime, and `getMaxWidth` returns a guaranteed `number` where it
 * is present. Composes by intersection with the other feature brands.
 *
 * @since 0.3.0
 */
export type MaxWidth = { readonly [MaxWidthId]: 'maxWidth' }

/**
 * The brand of a query known to carry a `prefers-color-scheme` feature.
 * `prefersColorScheme` stamps it, `and` keeps it through conjunction,
 * `hasPrefersColorScheme` recovers it at runtime, and
 * `getPrefersColorScheme` returns a guaranteed scheme where it is
 * present. Composes by intersection with the other feature brands.
 *
 * @since 0.3.0
 */
export type PrefersColorScheme = { readonly [PrefersColorSchemeId]: 'prefersColorScheme' }

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
 * The result carries the `MinWidth` brand, so `getMinWidth` returns a
 * bare `number` on it and on any conjunction built from it.
 *
 * @param px - The threshold in CSS pixels. Must be a non-negative finite number.
 * @returns A one-feature `MediaQuery`, branded `MinWidth`.
 * @throws `Error` when `px` is negative or not finite.
 * @example
 * ```ts
 * MediaQuery.render(MediaQuery.minWidth(768)) // '(min-width: 768px)'
 * MediaQuery.render(MediaQuery.minWidth(768), { mediaSyntax: 'range' }) // '(width >= 768px)'
 * ```
 * @since 0.1.0
 */
export const minWidth: (px: number) => MediaQuery<MinWidth> = internal.minWidth

/**
 * Creates a viewport-width upper bound.
 *
 * The result carries the `MaxWidth` brand, so `getMaxWidth` returns a
 * bare `number` on it and on any conjunction built from it.
 *
 * @param px - The threshold in CSS pixels. Must be a non-negative finite number.
 * @returns A one-feature `MediaQuery`, branded `MaxWidth`.
 * @throws `Error` when `px` is negative or not finite.
 * @example
 * ```ts
 * MediaQuery.render(MediaQuery.maxWidth(1024)) // '(max-width: 1024px)'
 * MediaQuery.render(MediaQuery.maxWidth(1024), { mediaSyntax: 'range' }) // '(width <= 1024px)'
 * ```
 * @since 0.3.0
 */
export const maxWidth: (px: number) => MediaQuery<MaxWidth> = internal.maxWidth

/**
 * Creates a `prefers-color-scheme` condition.
 *
 * The result carries the `PrefersColorScheme` brand, so
 * `getPrefersColorScheme` returns a guaranteed scheme on it and on any
 * conjunction built from it.
 *
 * @param scheme - The scheme to match, `'dark'` or `'light'`.
 * @returns A one-feature `MediaQuery`, branded `PrefersColorScheme`.
 * @since 0.1.0
 */
export const prefersColorScheme: (scheme: 'dark' | 'light') => MediaQuery<PrefersColorScheme> =
  internal.prefersColorScheme

export const and: {
  /**
   * Returns a function that conjoins `that` with its argument.
   *
   * @param that - The query to merge in.
   * @returns A function producing the conjunction.
   * @since 0.1.0
   */
  <B>(that: MediaQuery<B>): <A>(self: MediaQuery<A>) => MediaQuery<A & B>
  /**
   * Conjoins two queries: the result matches where both match. Features
   * re-sort into canonical order and exact duplicates collapse, so `and`
   * is commutative and idempotent.
   *
   * Known features intersect: the result keeps every brand either side
   * carries, so a `MinWidth` query stays `MinWidth` through conjunction.
   *
   * @param self - The first query.
   * @param that - The second query.
   * @returns The conjunction, branded with both sides' known features.
   * @example
   * ```ts
   * MediaQuery.minWidth(1280).pipe(
   *   MediaQuery.and(MediaQuery.prefersColorScheme('dark')),
   *   MediaQuery.render,
   * ) // '(min-width: 1280px) and (prefers-color-scheme: dark)'
   * ```
   * @since 0.1.0
   */
  <A, B>(self: MediaQuery<A>, that: MediaQuery<B>): MediaQuery<A & B>
} = internal.and

/**
 * Gets the query's `min-width` threshold.
 *
 * The return type keys on the `MinWidth` brand. Where the type proves a
 * `min-width` feature is present — `minWidth`'s result, any conjunction
 * keeping its brand, or a query narrowed by `hasMinWidth` — the result is
 * a bare `number`. On any other query it is `number | undefined`.
 *
 * When several `min-width` features stack, the largest threshold is
 * returned — the conjunction's effective lower bound, since every
 * feature must hold.
 *
 * @param query - The query to read.
 * @returns The largest `min-width` threshold in CSS pixels, or `undefined` when an unbranded query carries no `min-width` feature.
 * @example
 * ```ts
 * MediaQuery.getMinWidth(MediaQuery.minWidth(768)) // 768
 * MediaQuery.getMinWidth(MediaQuery.prefersColorScheme('dark')) // undefined
 * MediaQuery.minWidth(768).pipe(
 *   MediaQuery.and(MediaQuery.minWidth(1024)),
 *   MediaQuery.getMinWidth,
 * ) // 1024
 * ```
 * @since 0.3.0
 */
export const getMinWidth: <T>(
  query: MediaQuery<T>,
) => T extends MinWidth ? number : number | undefined = internal.getMinWidth

/**
 * Gets the query's `max-width` threshold.
 *
 * The return type keys on the `MaxWidth` brand. Where the type proves a
 * `max-width` feature is present — `maxWidth`'s result, any conjunction
 * keeping its brand, or a query narrowed by `hasMaxWidth` — the result is
 * a bare `number`. On any other query it is `number | undefined`.
 *
 * When several `max-width` features stack, the smallest threshold is
 * returned — the conjunction's effective upper bound, since every
 * feature must hold.
 *
 * @param query - The query to read.
 * @returns The smallest `max-width` threshold in CSS pixels, or `undefined` when an unbranded query carries no `max-width` feature.
 * @example
 * ```ts
 * MediaQuery.getMaxWidth(MediaQuery.maxWidth(1024)) // 1024
 * MediaQuery.getMaxWidth(MediaQuery.minWidth(768)) // undefined
 * ```
 * @since 0.3.0
 */
export const getMaxWidth: <T>(
  query: MediaQuery<T>,
) => T extends MaxWidth ? number : number | undefined = internal.getMaxWidth

/**
 * Gets the query's `prefers-color-scheme` value.
 *
 * The return type keys on the `PrefersColorScheme` brand. Where the type
 * proves the feature is present, the result is a bare `'dark' | 'light'`.
 * On any other query it may also be `undefined`.
 *
 * A query holding both schemes matches nothing; the accessor then
 * returns `'dark'`, the alphabetically first in canonical order.
 *
 * @param query - The query to read.
 * @returns The required scheme, or `undefined` when an unbranded query carries no `prefers-color-scheme` feature.
 * @example
 * ```ts
 * MediaQuery.getPrefersColorScheme(MediaQuery.prefersColorScheme('dark')) // 'dark'
 * MediaQuery.getPrefersColorScheme(MediaQuery.minWidth(768)) // undefined
 * ```
 * @since 0.3.0
 */
export const getPrefersColorScheme: <T>(
  query: MediaQuery<T>,
) => T extends PrefersColorScheme ? 'dark' | 'light' : 'dark' | 'light' | undefined =
  internal.getPrefersColorScheme

/**
 * Checks if the query carries a `min-width` feature, narrowing its type
 * to `MediaQuery<MinWidth>` so `getMinWidth` returns a bare `number`.
 *
 * @param query - The query to check.
 * @returns `true` if a `min-width` feature is present, `false` otherwise.
 * @example
 * ```ts
 * declare const query: MediaQuery.MediaQuery
 * if (MediaQuery.hasMinWidth(query)) {
 *   MediaQuery.getMinWidth(query) // number, not number | undefined
 * }
 * ```
 * @since 0.3.0
 */
export const hasMinWidth: (query: MediaQuery) => query is MediaQuery<MinWidth> =
  internal.hasMinWidth

/**
 * Checks if the query carries a `max-width` feature, narrowing its type
 * to `MediaQuery<MaxWidth>` so `getMaxWidth` returns a bare `number`.
 *
 * @param query - The query to check.
 * @returns `true` if a `max-width` feature is present, `false` otherwise.
 * @since 0.3.0
 */
export const hasMaxWidth: (query: MediaQuery) => query is MediaQuery<MaxWidth> =
  internal.hasMaxWidth

/**
 * Checks if the query carries a `prefers-color-scheme` feature, narrowing
 * its type to `MediaQuery<PrefersColorScheme>` so `getPrefersColorScheme`
 * returns a guaranteed scheme.
 *
 * @param query - The query to check.
 * @returns `true` if a `prefers-color-scheme` feature is present, `false` otherwise.
 * @since 0.3.0
 */
export const hasPrefersColorScheme: (query: MediaQuery) => query is MediaQuery<PrefersColorScheme> =
  internal.hasPrefersColorScheme

/**
 * Renders the query as CSS text: features in canonical order —
 * `min-width` ascending, then `prefers-color-scheme` — joined with
 * ` and `. The `mediaSyntax` option picks the width-feature spelling
 * (default `'prefix'`).
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
