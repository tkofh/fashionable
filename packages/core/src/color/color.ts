import type { ApplyBindings, Bindings, Input, SerializeOptions } from '#calc/calc'
import type { Pipeable } from '#util'
import type { ColorTypeId } from './color.internal.ts'
import * as internal from './color.internal.ts'

declare const ColorRefs: unique symbol

/**
 * A CSS color expression whose channels are `Calc` number expressions.
 *
 * A color is not a number: it can be bound and serialized, but not
 * solved. The `Refs` parameter unions the channels' unbound reference
 * names, exactly as on `Calc`.
 *
 * Only `oklch` is modeled today; other color functions are additional
 * union arms when a consumer needs them.
 *
 * Construct via `oklch`.
 *
 * @since 0.1.0
 */
export interface Color<out Refs extends string = string> extends Pipeable {
  readonly [ColorTypeId]: ColorTypeId
  readonly [ColorRefs]?: Refs
}

/**
 * Checks if a value is a `Color`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `Color`, `false` otherwise.
 * @since 0.1.0
 */
export const isColor: (u: unknown) => u is Color<string> = internal.isColor

/**
 * Creates an `oklch(...)` color from three channel expressions: lightness
 * (`0` to `1`), chroma (`0` upward), and hue (degrees).
 *
 * Each channel serializes independently, wrapped in `calc()` when it is
 * arithmetic: `oklch(var(--l) calc(var(--c) * 0.5) 220)`.
 *
 * @param lightness - The lightness channel.
 * @param chroma - The chroma channel.
 * @param hue - The hue channel, in degrees.
 * @returns A `Color` with the channels' references unioned.
 * @example
 * ```ts
 * const accent = Color.oklch(Calc.ref('lightness'), 0.15, 220)
 * Color.serialize(accent) // 'oklch(var(--lightness) 0.15 220)'
 * ```
 * @since 0.1.0
 */
export const oklch: <L extends string = never, C extends string = never, H extends string = never>(
  lightness: Input<L>,
  chroma: Input<C>,
  hue: Input<H>,
) => Color<L | C | H> = internal.oklch

export const bind: {
  /**
   * Returns a function that binds the given names in a color's channels.
   *
   * @param bindings - Reference names to values or expressions.
   * @returns A function replacing bound references in its argument.
   * @since 0.1.0
   */
  <const B extends Bindings>(
    bindings: B,
  ): <Refs extends string>(color: Color<Refs>) => Color<ApplyBindings<Refs, B>>
  /**
   * Replaces references in the color's channels with values or other
   * expressions, re-folding constant subtrees. Semantics match
   * `Calc.bind`: unreferenced names and `undefined` values are ignored,
   * and expression-valued bindings contribute their own references.
   *
   * @param color - The color to bind.
   * @param bindings - Reference names to values or expressions.
   * @returns The bound color.
   * @since 0.1.0
   */
  <Refs extends string, const B extends Bindings>(
    color: Color<Refs>,
    bindings: B,
  ): Color<ApplyBindings<Refs, B>>
} = internal.bind

/**
 * Renders a color as CSS text. Channels render space-separated inside
 * `oklch(...)`, each wrapped in `calc()` when it is arithmetic.
 *
 * Options match `Calc.serialize`: partial bindings applied first, and a
 * precision context for unannotated constants.
 *
 * @param color - The color to render.
 * @param options - Optional bindings and precision context.
 * @returns Deterministic CSS text.
 * @example
 * ```ts
 * const surface = Color.oklch(Calc.add(Calc.ref('l'), 0.1), 0.04, 250)
 * Color.serialize(surface) // 'oklch(calc(var(--l) + 0.1) 0.04 250)'
 * ```
 * @since 0.1.0
 */
export const serialize: <Refs extends string>(
  color: Color<Refs>,
  options?: SerializeOptions<Refs>,
) => string = internal.serialize

/**
 * The color's unbound reference names, unioned across channels.
 *
 * @param color - The color to inspect.
 * @returns The set of unbound reference names.
 * @since 0.1.0
 */
export const refs: <Refs extends string>(color: Color<Refs>) => ReadonlySet<Refs> = internal.refs

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The color to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: Color<string>): (self: Color<string>) => boolean
  /**
   * Structural equality over colors: channel trees compare node for node,
   * as in `Calc.equals`.
   *
   * @param self - The first color.
   * @param that - The second color.
   * @returns `true` if the colors are structurally equal.
   * @since 0.1.0
   */
  (self: Color<string>, that: Color<string>): boolean
} = internal.equals
