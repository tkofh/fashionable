import * as Equal from '#internal/equal'
import { formatDecimals } from '#internal/format'
import { dual, invariant, Pipeable } from '#util'
import type { MediaQuery, RenderOptions } from './mediaQuery.ts'

export const MediaQueryTypeId = Symbol.for('fashionable/query/mediaQuery')
export type MediaQueryTypeId = typeof MediaQueryTypeId

// ---------------------------------------------------------------------------
// feature ADT
// ---------------------------------------------------------------------------

/** @internal */
export type MediaFeature =
  | { readonly _tag: 'MinWidth'; readonly px: number }
  | { readonly _tag: 'PrefersColorScheme'; readonly scheme: 'dark' | 'light' }

// Feature kinds order by definition rank, then within kind: min-widths
// ascending by threshold, scheme values alphabetically. Conjunction is
// commutative and idempotent, so the model sorts and dedups at
// construction; equal queries compare equal however they were built.
const featureRank = (feature: MediaFeature): number => {
  switch (feature._tag) {
    case 'MinWidth':
      return 0
    case 'PrefersColorScheme':
      return 1
  }
}

const compareFeatures = (a: MediaFeature, b: MediaFeature): number => {
  const rank = featureRank(a) - featureRank(b)
  if (rank !== 0) {
    return rank
  }
  if (a._tag === 'MinWidth') {
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
  if (a._tag === 'MinWidth') {
    return a.px === (b as typeof a).px
  }
  return a.scheme === (b as typeof a).scheme
}

const featureHash = (feature: MediaFeature): number => {
  const h = Equal.hashString(feature._tag)
  if (feature._tag === 'MinWidth') {
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
export const minWidth = (px: number): MediaQuery => {
  invariant(
    Number.isFinite(px) && px >= 0,
    `min-width threshold must be a non-negative finite number of pixels, got ${px}`,
  )
  return new MediaQueryImpl([{ _tag: 'MinWidth', px }])
}

/** @internal */
export const prefersColorScheme = (scheme: 'dark' | 'light'): MediaQuery =>
  new MediaQueryImpl([{ _tag: 'PrefersColorScheme', scheme }])

/** @internal */
export const and = dual<
  (that: MediaQuery) => (self: MediaQuery) => MediaQuery,
  (self: MediaQuery, that: MediaQuery) => MediaQuery
>(
  2,
  (self: MediaQuery, that: MediaQuery): MediaQuery =>
    new MediaQueryImpl(canonicalize([...featuresOf(self), ...featuresOf(that)])),
)

/** @internal */
export const render = (query: MediaQuery, options?: RenderOptions): string =>
  renderImpl(query, options?.mediaSyntax ?? 'prefix')

/** @internal */
export const equals = dual<
  (that: MediaQuery) => (self: MediaQuery) => boolean,
  (self: MediaQuery, that: MediaQuery) => boolean
>(2, (self: MediaQuery, that: MediaQuery): boolean => Equal.equals(self, that))
