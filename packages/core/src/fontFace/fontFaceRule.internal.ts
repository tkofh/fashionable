import { toSpec } from '#calc/precision.internal'
import * as Equal from '#internal/equal'
import { DEFAULT_FORMAT, type FormatSpec, formatWith } from '#internal/format'
import { DEFAULT_INDENT, quote, renderBlock } from '#internal/render'
import { dual, invariant, Pipeable } from '#util'
import type {
  Descriptors,
  Display,
  FontFaceRule,
  RenderOptions,
  Source,
  Style,
  UnicodeRange,
  Weight,
} from './fontFaceRule.ts'

export const FontFaceRuleTypeId = Symbol.for('fashionable/fontFace/fontFaceRule')
export type FontFaceRuleTypeId = typeof FontFaceRuleTypeId

export const SourceTypeId = Symbol.for('fashionable/fontFace/fontFaceRule/source')
export type SourceTypeId = typeof SourceTypeId

// ---------------------------------------------------------------------------
// sources
// ---------------------------------------------------------------------------

type SourceNode =
  | { readonly _tag: 'Url'; readonly href: string; readonly format: string | undefined }
  | { readonly _tag: 'Local'; readonly name: string }

const renderSource = (node: SourceNode): string => {
  switch (node._tag) {
    case 'Url':
      return node.format === undefined
        ? `url(${quote(node.href)})`
        : `url(${quote(node.href)}) format(${quote(node.format)})`
    case 'Local':
      return `local(${quote(node.name)})`
  }
}

const sourceEquals = (a: SourceNode, b: SourceNode): boolean => {
  if (a._tag !== b._tag) {
    return false
  }
  switch (a._tag) {
    case 'Url': {
      const other = b as typeof a
      return a.href === other.href && a.format === other.format
    }
    case 'Local':
      return a.name === (b as typeof a).name
  }
}

const sourceHash = (node: SourceNode): number => {
  let h = Equal.hashString(node._tag)
  switch (node._tag) {
    case 'Url':
      h = Equal.combine(h, Equal.hashString(node.href))
      return Equal.combine(h, Equal.hashString(node.format ?? ''))
    case 'Local':
      return Equal.combine(h, Equal.hashString(node.name))
  }
}

class SourceImpl extends Pipeable implements Source {
  readonly [SourceTypeId]: SourceTypeId = SourceTypeId

  readonly node: SourceNode

  constructor(node: SourceNode) {
    super()
    this.node = node
  }

  get [Symbol.toStringTag]() {
    return `Source(${renderSource(this.node)})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

const nodeOfSource = (source: Source): SourceNode => (source as SourceImpl).node

/** @internal */
export const isSource = (u: unknown): u is Source =>
  typeof u === 'object' && u !== null && SourceTypeId in u

/** @internal */
export const url = (href: string, format?: string): Source => {
  invariant(href.length > 0, 'Font source url must be a non-empty string')
  invariant(
    format === undefined || format.length > 0,
    'Font source format must be a non-empty string when given',
  )
  return new SourceImpl({ _tag: 'Url', href, format })
}

/** @internal */
export const local = (name: string): Source => {
  invariant(name.length > 0, 'Font source local name must be a non-empty string')
  return new SourceImpl({ _tag: 'Local', name })
}

// ---------------------------------------------------------------------------
// the rule
// ---------------------------------------------------------------------------

const requireWeightValue = (value: number): void => {
  invariant(
    Number.isFinite(value) && value >= 1 && value <= 1000,
    `Font weight must be a number in [1, 1000], got ${value}`,
  )
}

const requirePercentage = (value: number | undefined, descriptor: string): void => {
  invariant(
    value === undefined || (Number.isFinite(value) && value >= 0),
    `${descriptor} must be a non-negative finite number of percent`,
  )
}

const weightEquals = (a: Weight | undefined, b: Weight | undefined): boolean => {
  if (a === undefined || b === undefined || typeof a === 'number' || typeof b === 'number') {
    return a === b
  }
  return a[0] === b[0] && a[1] === b[1]
}

const renderWeight = (weight: Weight, format: FormatSpec): string =>
  typeof weight === 'number'
    ? formatWith(weight, format)
    : `${formatWith(weight[0], format)} ${formatWith(weight[1], format)}`

// ---------------------------------------------------------------------------
// unicode-range
// ---------------------------------------------------------------------------

const MAX_CODEPOINT = 0x10ffff

const requireCodepoint = (value: number): void => {
  invariant(
    Number.isInteger(value) && value >= 0 && value <= MAX_CODEPOINT,
    `unicode-range codepoint must be an integer in [0x0, 0x10FFFF], got ${value}`,
  )
}

const rangeStart = (range: UnicodeRange): number => (typeof range === 'number' ? range : range[0])

const rangeEnd = (range: UnicodeRange): number => (typeof range === 'number' ? range : range[1])

const rangeEquals = (a: UnicodeRange, b: UnicodeRange): boolean => {
  if (typeof a === 'number' || typeof b === 'number') {
    return a === b
  }
  return a[0] === b[0] && a[1] === b[1]
}

/**
 * The descriptor is a set union, so member order carries no meaning:
 * sort by start, then end, singles before their degenerate ranges, and
 * drop exact duplicates — structurally equal descriptors compare equal
 * however they were built.
 */
const canonicalRanges = (ranges: ReadonlyArray<UnicodeRange>): ReadonlyArray<UnicodeRange> => {
  const sorted = ranges.toSorted(
    (a, b) =>
      rangeStart(a) - rangeStart(b) ||
      rangeEnd(a) - rangeEnd(b) ||
      (typeof a === 'number' ? 0 : 1) - (typeof b === 'number' ? 0 : 1),
  )
  const kept: Array<UnicodeRange> = []
  for (const range of sorted) {
    const previous = kept[kept.length - 1]
    if (previous === undefined || !rangeEquals(previous, range)) {
      kept.push(range)
    }
  }
  return kept
}

const hex = (value: number): string => value.toString(16).toUpperCase()

const renderRange = (range: UnicodeRange): string =>
  typeof range === 'number' ? `U+${hex(range)}` : `U+${hex(range[0])}-${hex(range[1])}`

class FontFaceRuleImpl extends Pipeable implements FontFaceRule, Equal.Equal {
  readonly [FontFaceRuleTypeId]: FontFaceRuleTypeId = FontFaceRuleTypeId

  readonly family: string
  readonly src: ReadonlyArray<Source>
  readonly weight: Weight | undefined
  readonly style: Style | undefined
  readonly display: Display | undefined
  readonly unicodeRange: ReadonlyArray<UnicodeRange> | undefined
  readonly ascentOverride: number | undefined
  readonly descentOverride: number | undefined
  readonly lineGapOverride: number | undefined
  readonly sizeAdjust: number | undefined
  #hash: number | undefined

  constructor(descriptors: Descriptors) {
    super()
    this.family = descriptors.family
    this.src = [...descriptors.src]
    this.weight = descriptors.weight
    this.style = descriptors.style
    this.display = descriptors.display
    this.unicodeRange =
      descriptors.unicodeRange === undefined ? undefined : canonicalRanges(descriptors.unicodeRange)
    this.ascentOverride = descriptors.ascentOverride
    this.descentOverride = descriptors.descentOverride
    this.lineGapOverride = descriptors.lineGapOverride
    this.sizeAdjust = descriptors.sizeAdjust
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return (
      isFontFaceRule(that) &&
      this.family === that.family &&
      weightEquals(this.weight, that.weight) &&
      this.style === that.style &&
      this.display === that.display &&
      (this.unicodeRange === undefined || that.unicodeRange === undefined
        ? this.unicodeRange === that.unicodeRange
        : this.unicodeRange.length === that.unicodeRange.length &&
          this.unicodeRange.every((range, index) =>
            rangeEquals(
              range,
              (that.unicodeRange as ReadonlyArray<UnicodeRange>)[index] as UnicodeRange,
            ),
          )) &&
      this.ascentOverride === that.ascentOverride &&
      this.descentOverride === that.descentOverride &&
      this.lineGapOverride === that.lineGapOverride &&
      this.sizeAdjust === that.sizeAdjust &&
      this.src.length === that.src.length &&
      this.src.every((source, index) =>
        sourceEquals(nodeOfSource(source), nodeOfSource(that.src[index] as Source)),
      )
    )
  }

  [Equal.HashTypeId](): number {
    if (this.#hash === undefined) {
      let h = Equal.hashString('fashionable/fontFace/fontFaceRule')
      h = Equal.combine(h, Equal.hashString(this.family))
      h = Equal.combine(
        h,
        this.weight === undefined
          ? 0
          : typeof this.weight === 'number'
            ? Equal.hashNumber(this.weight)
            : Equal.combine(Equal.hashNumber(this.weight[0]), Equal.hashNumber(this.weight[1])),
      )
      h = Equal.combine(h, Equal.hashString(this.style ?? ''))
      h = Equal.combine(h, Equal.hashString(this.display ?? ''))
      for (const range of this.unicodeRange ?? []) {
        h = Equal.combine(
          h,
          typeof range === 'number'
            ? Equal.hashNumber(range)
            : Equal.combine(Equal.hashNumber(range[0]), Equal.hashNumber(range[1])),
        )
      }
      for (const metric of [
        this.ascentOverride,
        this.descentOverride,
        this.lineGapOverride,
        this.sizeAdjust,
      ]) {
        h = Equal.combine(h, metric === undefined ? 0 : Equal.hashNumber(metric))
      }
      for (const source of this.src) {
        h = Equal.combine(h, sourceHash(nodeOfSource(source)))
      }
      this.#hash = h
    }
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `FontFaceRule(${quote(this.family)})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isFontFaceRule = (u: unknown): u is FontFaceRule =>
  typeof u === 'object' && u !== null && FontFaceRuleTypeId in u

/** @internal */
export const make = (descriptors: Descriptors): FontFaceRule => {
  invariant(descriptors.family.length > 0, 'Font family must be a non-empty string')
  invariant(descriptors.src.length > 0, '@font-face src must contain at least one source')
  if (typeof descriptors.weight === 'number') {
    requireWeightValue(descriptors.weight)
  } else if (descriptors.weight !== undefined) {
    requireWeightValue(descriptors.weight[0])
    requireWeightValue(descriptors.weight[1])
    invariant(
      descriptors.weight[0] <= descriptors.weight[1],
      'Font weight range must be ordered min then max',
    )
  }
  if (descriptors.unicodeRange !== undefined) {
    invariant(
      descriptors.unicodeRange.length > 0,
      'unicode-range must contain at least one range when given',
    )
    for (const range of descriptors.unicodeRange) {
      if (typeof range === 'number') {
        requireCodepoint(range)
      } else {
        requireCodepoint(range[0])
        requireCodepoint(range[1])
        invariant(range[0] <= range[1], 'unicode-range must be ordered start then end')
      }
    }
  }
  requirePercentage(descriptors.ascentOverride, 'ascent-override')
  requirePercentage(descriptors.descentOverride, 'descent-override')
  requirePercentage(descriptors.lineGapOverride, 'line-gap-override')
  requirePercentage(descriptors.sizeAdjust, 'size-adjust')
  return new FontFaceRuleImpl(descriptors)
}

const renderSrc = (src: ReadonlyArray<Source>, indent: string): string => {
  if (src.length === 1) {
    return `src: ${renderSource(nodeOfSource(src[0] as Source))}`
  }
  const sources = src
    .map((source) => `${indent}${indent}${renderSource(nodeOfSource(source))}`)
    .join(',\n')
  return `src:\n${sources}`
}

/** @internal */
export const render = (rule: FontFaceRule, options?: RenderOptions): string => {
  const indent = options?.indent ?? DEFAULT_INDENT
  const format = options?.precision === undefined ? DEFAULT_FORMAT : toSpec(options.precision)
  const declarations: Array<string> = [`font-family: ${quote(rule.family)}`]
  if (rule.weight !== undefined) {
    declarations.push(`font-weight: ${renderWeight(rule.weight, format)}`)
  }
  if (rule.style !== undefined) {
    declarations.push(`font-style: ${rule.style}`)
  }
  if (rule.display !== undefined) {
    declarations.push(`font-display: ${rule.display}`)
  }
  declarations.push(renderSrc(rule.src, indent))
  if (rule.unicodeRange !== undefined) {
    declarations.push(`unicode-range: ${rule.unicodeRange.map(renderRange).join(', ')}`)
  }
  if (rule.ascentOverride !== undefined) {
    declarations.push(`ascent-override: ${formatWith(rule.ascentOverride, format)}%`)
  }
  if (rule.descentOverride !== undefined) {
    declarations.push(`descent-override: ${formatWith(rule.descentOverride, format)}%`)
  }
  if (rule.lineGapOverride !== undefined) {
    declarations.push(`line-gap-override: ${formatWith(rule.lineGapOverride, format)}%`)
  }
  if (rule.sizeAdjust !== undefined) {
    declarations.push(`size-adjust: ${formatWith(rule.sizeAdjust, format)}%`)
  }
  return renderBlock('@font-face', declarations, indent)
}

/** @internal */
export const equals = dual<
  (that: FontFaceRule) => (self: FontFaceRule) => boolean,
  (self: FontFaceRule, that: FontFaceRule) => boolean
>(2, (self: FontFaceRule, that: FontFaceRule): boolean => Equal.equals(self, that))
