import * as Equal from '#internal/equal'
import { formatDecimals } from '#internal/format'
import { dual, invariant, Pipeable } from '#util'
import type { MaxWidth, MediaQuery, MinWidth, PrefersColorScheme, RenderOptions } from './mediaQuery.ts'

export const MediaQueryTypeId = Symbol.for('fashionable/query/mediaQuery')
export type MediaQueryTypeId = typeof MediaQueryTypeId

/**
 * Phantom key holding a `MediaQuery`'s `Features` parameter. The runtime
 * never stores a value here — known features are type-level brands, so a
 * query is identical at runtime whatever its type knows (the curvy trait
 * pattern, as `ColorSpace` uses for polar-ness).
 *
 * @internal
 */
export const MediaQueryFeatures: unique symbol = Symbol.for(
  'fashionable/query/mediaQuery/features',
)
export type MediaQueryFeatures = typeof MediaQueryFeatures

// ---------------------------------------------------------------------------
// feature ADT
// ---------------------------------------------------------------------------

/** @internal */
export type MediaFeature =
  | { readonly _tag: 'MinWidth'; readonly px: number }
  | { readonly _tag: 'MaxWidth'; readonly px: number }
  | { readonly _tag: 'PrefersColorScheme'; readonly scheme: 'dark' | 'light' }

// Feature kinds order by definition rank, then within kind: widths
// ascending by threshold, scheme values alphabetically. Conjunction is
// commutative and idempotent, so the model sorts and dedups at
// construction; equal queries compare equal however they were built.
// max-width slots beside min-width — a new kind reshuffles no existing
// output, so it takes the rank that reads best, not the end of the ladder.
const featureRank = (feature: MediaFeature): number => {
  switch (feature._tag) {
    case 'MinWidth':
      return 0
    case 'MaxWidth':
      return 1
    case 'PrefersColorScheme':
      return 2
  }
}

const compareFeatures = (a: MediaFeature, b: MediaFeature): number => {
  const rank = featureRank(a) - featureRank(b)
  if (rank !== 0) {
    return rank
  }
  if (a._tag === 'MinWidth' || a._tag === 'MaxWidth') {
    return a.px - (b as typeof a).px
  }
  const x = (a as Extract<MediaFeature, { _tag: 'PrefersColorScheme' }>).scheme
  const y = (b as Extract<MediaFeature, { _tag: 'PrefersColorScheme' }>).scheme
  return x < y ? -1 : x > y ? 1 : 0
}

const featureEquals = (a: MediaFeature, b: MediaFeature): boolean => {
  if (a._tag !== b._tag) {
    return false
  }
  if (a._tag === 'MinWidth' || a._tag === 'MaxWidth') {
    return a.px === (b as typeof a).px
  }
  return a.scheme === (b as typeof a).scheme
}

const featureHash = (feature: MediaFeature): number => {
  const h = Equal.hashString(feature._tag)
  if (feature._tag === 'MinWidth' || feature._tag === 'MaxWidth') {
    return Equal.combine(h, Equal.hashNumber(feature.px))
  }
  return Equal.combine(h, Equal.hashString(feature.scheme))
}

const renderFeature = (feature: MediaFeature, syntax: 'prefix' | 'range'): string => {
  switch (feature._tag) {
    case 'MinWidth': {
      const px = formatDecimals(feature.px, 5)
      return syntax === 'prefix' ? `(min-width: ${px}px)` : `(width >= ${px}px)`
    }
    case 'MaxWidth': {
      const px = formatDecimals(feature.px, 5)
      return syntax === 'prefix' ? `(max-width: ${px}px)` : `(width <= ${px}px)`
    }
    case 'PrefersColorScheme':
      return `(prefers-color-scheme: ${feature.scheme})`
  }
}

const canonicalize = (features: ReadonlyArray<MediaFeature>): ReadonlyArray<MediaFeature> => {
  const sorted = [...features].toSorted(compareFeatures)
  const deduped: Array<MediaFeature> = []
  for (const feature of sorted) {
    const last = deduped[deduped.length - 1]
    if (last === undefined || !featureEquals(last, feature)) {
      deduped.push(feature)
    }
  }
  return deduped
}

// ---------------------------------------------------------------------------
// the value
// ---------------------------------------------------------------------------

class MediaQueryImpl extends Pipeable implements MediaQuery, Equal.Equal {
  readonly [MediaQueryTypeId]: MediaQueryTypeId = MediaQueryTypeId

  readonly features: ReadonlyArray<MediaFeature>
  #hash: number | undefined

  constructor(features: ReadonlyArray<MediaFeature>) {
    super()
    this.features = features
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return (
      isMediaQuery(that) &&
      this.features.length === featuresOf(that).length &&
      this.features.every((feature, index) =>
        featureEquals(feature, featuresOf(that)[index] as MediaFeature),
      )
    )
  }

  [Equal.HashTypeId](): number {
    if (this.#hash === undefined) {
      let h = Equal.hashString('fashionable/query/mediaQuery')
      for (const feature of this.features) {
        h = Equal.combine(h, featureHash(feature))
      }
      this.#hash = h
    }
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `MediaQuery(${renderImpl(this, 'prefix')})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isMediaQuery = (u: unknown): u is MediaQuery =>
  typeof u === 'object' && u !== null && MediaQueryTypeId in u

const featuresOf = (query: MediaQuery): ReadonlyArray<MediaFeature> =>
  (query as MediaQueryImpl).features

const renderImpl = (query: MediaQuery, syntax: 'prefix' | 'range'): string =>
  featuresOf(query)
    .map((feature) => renderFeature(feature, syntax))
    .join(' and ')

// ---------------------------------------------------------------------------
// constructors, combinators, projections
// ---------------------------------------------------------------------------

/** @internal */
export const minWidth = (px: number): MediaQuery<MinWidth> => {
  invariant(
    Number.isFinite(px) && px >= 0,
    `min-width threshold must be a non-negative finite number of pixels, got ${px}`,
  )
  return new MediaQueryImpl([{ _tag: 'MinWidth', px }])
}

/** @internal */
export const maxWidth = (px: number): MediaQuery<MaxWidth> => {
  invariant(
    Number.isFinite(px) && px >= 0,
    `max-width threshold must be a non-negative finite number of pixels, got ${px}`,
  )
  return new MediaQueryImpl([{ _tag: 'MaxWidth', px }])
}

/** @internal */
export const prefersColorScheme = (scheme: 'dark' | 'light'): MediaQuery<PrefersColorScheme> =>
  new MediaQueryImpl([{ _tag: 'PrefersColorScheme', scheme }])

// `MediaQuery<never>` is the bottom of the covariant trait parameter, so
// the erased implementation assigns to every public trait instantiation
// (the same move as `Color<never>` under `mix`).
/** @internal */
export const and = dual<
  (that: MediaQuery) => (self: MediaQuery) => MediaQuery<never>,
  (self: MediaQuery, that: MediaQuery) => MediaQuery<never>
>(
  2,
  (self: MediaQuery, that: MediaQuery): MediaQuery<never> =>
    new MediaQueryImpl(canonicalize([...featuresOf(self), ...featuresOf(that)])),
)

// Accessors are single generic signatures, not two-overload sets: an
// overloaded function contributes only its last signature to inference
// when passed higher-order (a pipe tail), which would erase the brand
// guarantee exactly where it earns its keep. The conditional return
// survives both positions.
/** @internal */
export function getMinWidth<T>(
  query: MediaQuery<T>,
): T extends MinWidth ? number : number | undefined
/** @internal */
export function getMinWidth(query: MediaQuery): number | undefined {
  // Min-widths sort ascending in canonical order, so the last one is the
  // conjunction's effective lower bound (every feature must hold).
  return featuresOf(query).findLast((feature) => feature._tag === 'MinWidth')?.px
}

/** @internal */
export function getMaxWidth<T>(
  query: MediaQuery<T>,
): T extends MaxWidth ? number : number | undefined
/** @internal */
export function getMaxWidth(query: MediaQuery): number | undefined {
  // Max-widths sort ascending in canonical order, so the first one is the
  // conjunction's effective upper bound (every feature must hold).
  return featuresOf(query).find((feature) => feature._tag === 'MaxWidth')?.px
}

/** @internal */
export function getPrefersColorScheme<T>(
  query: MediaQuery<T>,
): T extends PrefersColorScheme ? 'dark' | 'light' : 'dark' | 'light' | undefined
/** @internal */
export function getPrefersColorScheme(query: MediaQuery): 'dark' | 'light' | undefined {
  return featuresOf(query).find((feature) => feature._tag === 'PrefersColorScheme')?.scheme
}

/** @internal */
export const hasMinWidth = (query: MediaQuery): query is MediaQuery<MinWidth> =>
  featuresOf(query).some((feature) => feature._tag === 'MinWidth')

/** @internal */
export const hasMaxWidth = (query: MediaQuery): query is MediaQuery<MaxWidth> =>
  featuresOf(query).some((feature) => feature._tag === 'MaxWidth')

/** @internal */
export const hasPrefersColorScheme = (query: MediaQuery): query is MediaQuery<PrefersColorScheme> =>
  featuresOf(query).some((feature) => feature._tag === 'PrefersColorScheme')

/** @internal */
export const render = (query: MediaQuery, options?: RenderOptions): string =>
  renderImpl(query, options?.mediaSyntax ?? 'prefix')

/** @internal */
export const equals = dual<
  (that: MediaQuery) => (self: MediaQuery) => boolean,
  (self: MediaQuery, that: MediaQuery) => boolean
>(2, (self: MediaQuery, that: MediaQuery): boolean => Equal.equals(self, that))
