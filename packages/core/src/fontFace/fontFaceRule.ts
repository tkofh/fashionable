import type { RenderOptions as DeclarationRenderOptions } from '#declaration/declaration'
import type { Pipeable } from '#util'
import type { FontFaceRuleTypeId, SourceTypeId } from './fontFaceRule.internal.ts'
import * as internal from './fontFaceRule.internal.ts'

/**
 * An `@font-face` rule: a font family, its sources, and the optional
 * descriptors that scope and adjust the face.
 *
 * A declaration-block at-rule lives at the top level of a stylesheet —
 * it is deliberately not a rule-block member, so it cannot nest. All
 * fields are plain data: nothing in `@font-face` takes an expression.
 *
 * Construct via `make`.
 *
 * @since 0.1.0
 */
export interface FontFaceRule extends Pipeable {
  readonly [FontFaceRuleTypeId]: FontFaceRuleTypeId
  /**
   * The `font-family` descriptor: the name the face binds to, quoted when
   * rendered.
   */
  readonly family: string
  /**
   * The `src` descriptor's sources, in authored order — the browser uses
   * the first it supports.
   */
  readonly src: ReadonlyArray<Source>
  /**
   * The `font-weight` descriptor: one weight or an ordered
   * `[min, max]` range, in `[1, 1000]`.
   */
  readonly weight: Weight | undefined
  /**
   * The `font-style` descriptor keyword.
   */
  readonly style: Style | undefined
  /**
   * The `font-display` descriptor keyword.
   */
  readonly display: Display | undefined
  /**
   * The `ascent-override` metric, as a percentage number (`90` renders
   * `90%`).
   */
  readonly ascentOverride: number | undefined
  /**
   * The `descent-override` metric, as a percentage number.
   */
  readonly descentOverride: number | undefined
  /**
   * The `line-gap-override` metric, as a percentage number.
   */
  readonly lineGapOverride: number | undefined
  /**
   * The `size-adjust` metric, as a percentage number.
   */
  readonly sizeAdjust: number | undefined
}

/**
 * One entry of an `@font-face` `src` list: a downloadable `url(...)`
 * (optionally with a `format(...)` hint) or a `local(...)` lookup.
 *
 * Construct via `url` and `local`.
 *
 * @since 0.1.0
 */
export interface Source extends Pipeable {
  readonly [SourceTypeId]: SourceTypeId
}

/**
 * A `font-weight` descriptor value: a single weight, or an ordered
 * `[min, max]` range (`[100, 900]` renders `100 900`) for variable faces.
 *
 * @since 0.1.0
 */
export type Weight = number | readonly [number, number]

/**
 * The `font-style` descriptor keywords. Oblique angle ranges are a later
 * extension when a consumer needs them.
 *
 * @since 0.1.0
 */
export type Style = 'normal' | 'italic' | 'oblique'

/**
 * The `font-display` descriptor keywords.
 *
 * @since 0.1.0
 */
export type Display = 'auto' | 'block' | 'swap' | 'fallback' | 'optional'

/**
 * The descriptors accepted by `make`. `family` and `src` are required;
 * everything else renders only when given.
 *
 * The four metric descriptors take percentages as numbers — `90` means
 * `90%`. Metrics-adjusted fallback faces are the expected use: a face
 * whose sole source is `local(...)`, carrying overrides computed from the
 * primary face's metrics.
 *
 * @since 0.1.0
 */
export interface Descriptors {
  readonly family: string
  readonly src: ReadonlyArray<Source>
  readonly weight?: Weight
  readonly style?: Style
  readonly display?: Display
  readonly ascentOverride?: number
  readonly descentOverride?: number
  readonly lineGapOverride?: number
  readonly sizeAdjust?: number
}

/**
 * Options for `render`, in the render-options family rooted at
 * `MediaQuery.RenderOptions` (via `Declaration.RenderOptions`). This
 * renderer consumes `indent`; the inherited keys are accepted and
 * ignored, so one options object composes across the library.
 *
 * @since 0.1.0
 */
export interface RenderOptions extends DeclarationRenderOptions {
  /**
   * The indentation unit for the block's declarations. Defaults to a tab.
   */
  readonly indent?: string
}

/**
 * Checks if a value is a `FontFaceRule`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `FontFaceRule`, `false` otherwise.
 * @since 0.1.0
 */
export const isFontFaceRule: (u: unknown) => u is FontFaceRule = internal.isFontFaceRule

/**
 * Checks if a value is a font `Source`.
 *
 * True only for values built by `url` and `local`, which carry the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `Source`, `false` otherwise.
 * @since 0.1.0
 */
export const isSource: (u: unknown) => u is Source = internal.isSource

/**
 * Creates a downloadable font source, rendered `url('href')` — with a
 * `format('...')` hint appended when `format` is given.
 *
 * @param href - The URL the face loads from. Must be non-empty; rendered single-quoted with embedded quotes and backslashes escaped.
 * @param format - The optional format hint (`woff2`, `woff`, ...). Must be non-empty when given.
 * @returns A `Source` for `Descriptors.src`.
 * @throws `Error` when `href` is empty, or `format` is given but empty.
 * @since 0.1.0
 */
export const url: (href: string, format?: string) => Source = internal.url

/**
 * Creates a local font lookup, rendered `local('name')` — the expected
 * sole source of a metrics-adjusted fallback face.
 *
 * @param name - The locally installed family name. Must be non-empty; rendered single-quoted with embedded quotes and backslashes escaped.
 * @returns A `Source` for `Descriptors.src`.
 * @throws `Error` when `name` is empty.
 * @since 0.1.0
 */
export const local: (name: string) => Source = internal.local

/**
 * Creates an `@font-face` rule.
 *
 * @param descriptors - The face's descriptors; `family` and `src` are required.
 * @returns A `FontFaceRule`.
 * @throws `Error` when `family` is empty, `src` is empty, a weight is outside `[1, 1000]` or a range is out of order, or a metric override is negative.
 * @example
 * ```ts
 * FontFaceRule.make({
 *   family: 'Inter',
 *   weight: [100, 900],
 *   style: 'normal',
 *   display: 'swap',
 *   src: [FontFaceRule.url('/fonts/inter-variable.woff2', 'woff2')],
 * })
 * ```
 * @since 0.1.0
 */
export const make: (descriptors: Descriptors) => FontFaceRule = internal.make

/**
 * Renders the rule as a complete `@font-face { ... }` block.
 *
 * Descriptors render in a fixed order — `font-family`, `font-weight`,
 * `font-style`, `font-display`, `src`, then the metric overrides — one
 * per line. A single-source `src` stays inline; multiple sources render
 * one per line at double indent, comma-separated. Numbers format at the
 * library default precision; the metric descriptors append `%`.
 *
 * @param rule - The rule to render.
 * @param options - Optional indentation unit.
 * @returns Deterministic CSS text.
 * @example
 * ```ts
 * FontFaceRule.render(
 *   FontFaceRule.make({ family: 'Inter', src: [FontFaceRule.url('/inter.woff2', 'woff2')] }),
 * )
 * // "@font-face {\n\tfont-family: 'Inter';\n\tsrc: url('/inter.woff2') format('woff2');\n}"
 * ```
 * @since 0.1.0
 */
export const render: (rule: FontFaceRule, options?: RenderOptions) => string = internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The rule to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: FontFaceRule): (self: FontFaceRule) => boolean
  /**
   * Structural equality over descriptors. `src` order participates (it is
   * fallback order); a single weight never equals a range, even a
   * degenerate one.
   *
   * @param self - The first rule.
   * @param that - The second rule.
   * @returns `true` if the rules are structurally equal.
   * @since 0.1.0
   */
  (self: FontFaceRule, that: FontFaceRule): boolean
} = internal.equals
