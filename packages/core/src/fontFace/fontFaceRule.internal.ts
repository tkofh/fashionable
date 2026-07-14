import * as Equal from '../internal/equal.ts'
import { dual, invariant, Pipeable } from '../utils.ts'
import { DEFAULT_FORMAT, formatWith } from '../internal/format.ts'
import { DEFAULT_INDENT, quote, renderBlock } from '../internal/render.ts'
import type {
  Descriptors,
  Display,
  FontFaceRule,
  RenderOptions,
  Source,
  Style,
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

const formatNumber = (value: number): string => formatWith(value, DEFAULT_FORMAT)

const renderWeight = (weight: Weight): string =>
  typeof weight === 'number'
    ? formatNumber(weight)
    : `${formatNumber(weight[0])} ${formatNumber(weight[1])}`

class FontFaceRuleImpl extends Pipeable implements FontFaceRule, Equal.Equal {
  readonly [FontFaceRuleTypeId]: FontFaceRuleTypeId = FontFaceRuleTypeId

  readonly family: string
  readonly src: ReadonlyArray<Source>
  readonly weight: Weight | undefined
  readonly style: Style | undefined
  readonly display: Display | undefined
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
  const declarations: Array<string> = [`font-family: ${quote(rule.family)}`]
  if (rule.weight !== undefined) {
    declarations.push(`font-weight: ${renderWeight(rule.weight)}`)
  }
  if (rule.style !== undefined) {
    declarations.push(`font-style: ${rule.style}`)
  }
  if (rule.display !== undefined) {
    declarations.push(`font-display: ${rule.display}`)
  }
  declarations.push(renderSrc(rule.src, indent))
  if (rule.ascentOverride !== undefined) {
    declarations.push(`ascent-override: ${formatNumber(rule.ascentOverride)}%`)
  }
  if (rule.descentOverride !== undefined) {
    declarations.push(`descent-override: ${formatNumber(rule.descentOverride)}%`)
  }
  if (rule.lineGapOverride !== undefined) {
    declarations.push(`line-gap-override: ${formatNumber(rule.lineGapOverride)}%`)
  }
  if (rule.sizeAdjust !== undefined) {
    declarations.push(`size-adjust: ${formatNumber(rule.sizeAdjust)}%`)
  }
  return renderBlock('@font-face', declarations, indent)
}

/** @internal */
export const equals = dual<
  (that: FontFaceRule) => (self: FontFaceRule) => boolean,
  (self: FontFaceRule, that: FontFaceRule) => boolean
>(2, (self: FontFaceRule, that: FontFaceRule): boolean => Equal.equals(self, that))
