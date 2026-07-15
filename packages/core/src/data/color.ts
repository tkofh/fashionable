import type { ApplyBindings, Bindings, Input, SerializeOptions } from '#calc/calc'
import type { Pipeable } from '#util'
import type { ColorTypeId } from './color.internal.ts'
import * as internal from './color.internal.ts'
import type { None } from './keywords.ts'

declare const ColorRefs: unique symbol

/**
 * A CSS color expression whose channels are `Calc` number expressions.
 *
 * A color is not a number: it can be bound and serialized, but not
 * solved. The `Refs` parameter unions the channels' unbound reference
 * names, exactly as on `Calc`.
 *
 * `oklch(...)`, `color(srgb ...)`, `light-dark(...)`, and named colors
 * are modeled today; other color functions arrive as a consumer needs
 * them. Channels accept `Keyword.none`, CSS's missing-component value.
 *
 * Construct via `oklch`, `srgb`, `lightDark`, and `named` (or the
 * `transparent` constant).
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
 * (`0` to `1`), chroma (`0` upward), and hue (degrees). A channel may be
 * `Keyword.none` — the missing-component keyword, the conventional hue
 * for achromatic colors: `oklch(0 0 none)`.
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
  lightness: Input<L> | None,
  chroma: Input<C> | None,
  hue: Input<H> | None,
) => Color<L | C | H> = internal.oklch

/**
 * Creates a `color(srgb ...)` color from three channel expressions, each
 * `0` to `1`. A channel may be `Keyword.none`, the missing-component
 * keyword.
 *
 * Each channel serializes independently, wrapped in `calc()` when it is
 * arithmetic, inside the `color()` function's `srgb` colorspace:
 * `color(srgb 0.18 0.34 0.78)`.
 *
 * @param red - The red channel.
 * @param green - The green channel.
 * @param blue - The blue channel.
 * @returns A `Color` with the channels' references unioned.
 * @example
 * ```ts
 * const brand = Color.srgb(0.18, 0.34, 0.78)
 * Color.serialize(brand) // 'color(srgb 0.18 0.34 0.78)'
 * ```
 * @since 0.2.0
 */
export const srgb: <R extends string = never, G extends string = never, B extends string = never>(
  red: Input<R> | None,
  green: Input<G> | None,
  blue: Input<B> | None,
) => Color<R | G | B> = internal.srgb

/**
 * Creates a named color, rendered bare: `named('rebeccapurple')`
 * serializes as `rebeccapurple`. The name is the whole value — a named
 * color has no channels, contributes no references, and binds nothing.
 *
 * That the name is one of the specification's named colors is not
 * checked, matching the library's posture on identifiers — with one
 * exception: the CSS-wide keywords (`inherit`, `initial`, ...) are
 * whole-declaration values, not colors (`light-dark(inherit, ...)` is
 * invalid CSS), and are rejected.
 *
 * @param name - The color name. Must be non-empty and not a CSS-wide keyword.
 * @returns A `Color<never>`.
 * @throws `Error` when `name` is empty or a CSS-wide keyword.
 * @since 0.2.0
 */
export const named: (name: string) => Color<never> = internal.named

/**
 * The `transparent` named color — `rgb(0 0 0 / 0)` by definition, and
 * the conventional "no color" value.
 *
 * @since 0.2.0
 */
export const transparent: Color<never> = internal.transparent

/**
 * Creates a scheme-conditional `light-dark(...)` color: the browser uses
 * the first color under the light scheme and the second under dark.
 *
 * The arms are whole colors and positional — `lightDark(a, b)` and
 * `lightDark(b, a)` are different colors. Any `Color` is accepted,
 * including another `lightDark` (grammatically an arm is any `<color>`;
 * nesting is redundant but legal, and simplification is not this type's
 * job). Note the resolution context: `light-dark()` requires
 * `color-scheme` to be set — that contract is the consumer's.
 *
 * @param light - The color used under the light scheme.
 * @param dark - The color used under the dark scheme.
 * @returns A `Color` with both arms' references unioned.
 * @example
 * ```ts
 * const accent = Color.lightDark(Color.srgb(0.85, 0.3, 0.4), Color.srgb(0.95, 0.5, 0.55))
 * Color.serialize(accent) // 'light-dark(color(srgb 0.85 0.3 0.4), color(srgb 0.95 0.5 0.55))'
 * ```
 * @since 0.2.0
 */
export const lightDark: <A extends string = never, B extends string = never>(
  light: Color<A>,
  dark: Color<B>,
) => Color<A | B> = internal.lightDark

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
 * the color's own function form — `oklch(...)` or `color(srgb ...)` —
 * each wrapped in `calc()` when it is arithmetic; a `lightDark` renders
 * both arms in full, comma-separated.
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
   * as in `Calc.equals`. Different color functions never compare equal,
   * even where they would name the same point in color space.
   *
   * @param self - The first color.
   * @param that - The second color.
   * @returns `true` if the colors are structurally equal.
   * @since 0.1.0
   */
  (self: Color<string>, that: Color<string>): boolean
} = internal.equals
