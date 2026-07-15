import type { ApplyBindings, Bindings, Calc, Input, SerializeOptions } from '#calc/calc'
import type { Pipeable } from '#util'
import type { ColorTypeId } from './color.internal.ts'
import * as internal from './color.internal.ts'
import type { ColorSpace } from './colorSpace.ts'
import type { None } from './keywords.ts'

declare const ColorRefs: unique symbol

/**
 * A CSS color expression whose channels are `Calc` number expressions.
 *
 * A color is not a number: it can be bound and serialized, but not
 * solved. The `Refs` parameter unions the channels' unbound reference
 * names, exactly as on `Calc`.
 *
 * `oklch(...)`, `color(srgb ...)`, `light-dark(...)`, `color-mix(...)`,
 * relative colors (`oklch(from ...)`, `color(from ...)`), a color-valued
 * `var(...)`, and named colors are modeled today; other color functions
 * arrive as a consumer needs them. Channels accept `Keyword.none`, CSS's
 * missing-component value.
 *
 * Construct via `oklch`, `srgb`, `lightDark`, `mix`, `named`, `from`, and
 * `ref` (or the `transparent` constant).
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
 * Creates a color-valued custom-property reference — `ref('accent')`
 * serializes as `var(--accent)`. Use it where a whole color is read from a
 * custom property: as a standalone value, or as the origin of a relative color
 * (`from`).
 *
 * The reference is the whole value, so it carries `name` as its one unbound
 * reference — a dependency, exactly as an unbound `Calc.ref` does — but has no
 * channels. `bind` substitutes channel expressions, not whole colors, so it
 * leaves a color reference in place; the browser resolves it from the cascade.
 *
 * @param name - The custom-property name, without the `--` prefix. Must be non-empty.
 * @returns A `Color` with `name` as its one unbound reference.
 * @throws `Error` when `name` is empty.
 * @example
 * ```ts
 * Color.serialize(Color.ref('accent')) // 'var(--accent)'
 * ```
 * @since 0.2.0
 */
export const ref: <Name extends string>(name: Name) => Color<Name> = internal.ref

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

/**
 * A rectangular (Cartesian) interpolation colorspace: the two colors mix
 * coordinate by coordinate, with no hue channel, so no
 * `HueInterpolation` strategy applies to it.
 *
 * @since 0.2.0
 */
export type RectangularColorspace =
  | 'srgb'
  | 'srgb-linear'
  | 'display-p3'
  | 'a98-rgb'
  | 'prophoto-rgb'
  | 'rec2020'
  | 'lab'
  | 'oklab'
  | 'xyz'
  | 'xyz-d50'
  | 'xyz-d65'

/**
 * A polar (cylindrical) interpolation colorspace: it carries a hue
 * channel, so a `HueInterpolation` strategy may accompany it.
 *
 * @since 0.2.0
 */
export type PolarColorspace = 'hsl' | 'hwb' | 'lch' | 'oklch'

/**
 * A `color-mix()` interpolation colorspace — the space whose coordinates
 * the two colors are mixed in, rectangular or polar.
 *
 * @since 0.2.0
 */
export type Colorspace = RectangularColorspace | PolarColorspace

/**
 * How a polar colorspace traverses the hue circle between the two colors:
 * the `shorter` or `longer` arc, or monotonically `increasing` /
 * `decreasing`. Serialized before the literal `hue` keyword, as CSS
 * spells it — `in oklch longer hue`.
 *
 * @since 0.2.0
 */
export type HueInterpolation = 'shorter' | 'longer' | 'increasing' | 'decreasing'

/**
 * The `<color-interpolation-method>` argument to `mix`: a bare colorspace
 * (`'oklch'`), or an object pairing a colorspace with its options. A hue
 * strategy is only grammatical after a polar space, so the object form
 * admits `hue` only when `colorspace` is a `PolarColorspace` — `{
 * colorspace: 'srgb', hue: 'longer' }` is a type error, mirroring the
 * grammar where `<hue-interpolation-method>` follows only a
 * `<polar-color-space>`.
 *
 * @since 0.2.0
 */
export type InterpolationMethod =
  | Colorspace
  | { readonly colorspace: RectangularColorspace }
  | { readonly colorspace: PolarColorspace; readonly hue?: HueInterpolation }

/**
 * Creates a `color-mix(...)`: the browser mixes `color1` and `color2` in
 * the interpolation `method`'s colorspace. Each arm is a bare `Color` or
 * a `[color, percentage]` tuple giving that color's weight — a bare
 * number reads as a percent (`20` is `20%`, the `<percentage>`
 * convention), a `Percentage` expression carries an annotated or computed
 * weight (`Percentage.of(20)`, `Calc.multiply(Percentage.of(50), ...)`).
 * A plain number-kind `Calc` in the percentage slot is rejected: a weight
 * is a `<percentage>`, not a bare number.
 *
 * Percentages are optional and preserved verbatim — fashionable emits the
 * authored form and never runs the spec's mixing normalization (omitted
 * weights defaulting to `50%`, weights summing off `100%` rescaling with
 * an alpha multiplier), which is computed-value behavior the browser
 * owns. A hue-interpolation strategy attaches to a polar colorspace
 * through the object method form. Like every `Color`, a mix binds and
 * serializes but does not solve, and each arm and each percentage
 * contributes its references to the result.
 *
 * @param method - The interpolation colorspace, optionally with a hue strategy.
 * @param color1 - The first color, or a `[color, percentage]` tuple weighting it.
 * @param color2 - The second color, or a `[color, percentage]` tuple weighting it.
 * @returns A `Color` unioning both arms' and both percentages' references.
 * @example
 * ```ts
 * Color.serialize(Color.mix('oklch', Color.named('red'), Color.named('blue')))
 * // 'color-mix(in oklch, red, blue)'
 * Color.serialize(Color.mix('srgb', [Color.named('white'), 20], Color.named('black')))
 * // 'color-mix(in srgb, white 20%, black)'
 * const method = { colorspace: 'oklch', hue: 'longer' } as const
 * Color.serialize(Color.mix(method, Color.named('red'), Color.named('blue')))
 * // 'color-mix(in oklch longer hue, red, blue)'
 * ```
 * @since 0.2.0
 */
export const mix: <
  C1 extends string = never,
  P1 extends string = never,
  C2 extends string = never,
  P2 extends string = never,
>(
  method: InterpolationMethod,
  color1: Color<C1> | readonly [Color<C1>, number | Calc<P1, 'percentage', unknown>],
  color2: Color<C2> | readonly [Color<C2>, number | Calc<P2, 'percentage', unknown>],
) => Color<C1 | P1 | C2 | P2> = internal.mix

/**
 * A channel slot of a relative color: a bare number, `Keyword.none`, or a
 * `Calc` number expression. `Channels` is the set of origin-channel keyword
 * brands (`Channel`) the expression may read — the space's own channels — so a
 * keyword from another color space (`Channel.R` in an `oklch` slot) is a
 * compile error. A plain expression (a constant, a `Calc.ref`, a `clamp`)
 * carries no channel keyword and fits any slot.
 *
 * @since 0.2.0
 */
export type RelativeChannel<Refs extends string, Channels> =
  | number
  | None
  | Calc<Refs, 'number', Channels>

// The channel-keyword brands a `ColorSpace` admits, extracted for scoping.
type ChannelsOf<Space> = Space extends ColorSpace<infer Channels> ? Channels : never

/**
 * Creates a relative color from an origin and a destination `ColorSpace`:
 * `Color.from(origin, ColorSpace.oklch, l, c, h)` is `oklch(from origin l c h)`
 * and `Color.from(origin, ColorSpace.srgb, r, g, b)` is
 * `color(from origin srgb r g b)`. The browser converts `origin` into the
 * space and exposes its channels as the `Channel` keywords the space names
 * (`Channel.L`/`C`/`H` for `oklch`, `Channel.R`/`G`/`B` for `srgb`, `Channel.Alpha`
 * for both); passing them straight through reproduces the origin, and
 * arithmetic on them derives a related color.
 *
 * The `space` scopes the channel arguments — a keyword the space does not name
 * is a compile error. Each channel serializes independently, wrapped in
 * `calc()` when arithmetic and bare when a lone keyword, and may be
 * `Keyword.none`. A supplied `alpha` renders after a slash
 * (`/ calc(alpha * 0.5)`); omitted, the origin's alpha carries through. The
 * origin's own references union into the result; the channel keywords
 * contribute none, since the browser resolves them from the origin.
 *
 * @param origin - The color to derive from — any `Color`, commonly a `ref`.
 * @param space - The destination `ColorSpace`, fixing the function form and the channels in scope.
 * @param channel1 - The first channel (`l`/`r`), in the space's order.
 * @param channel2 - The second channel (`c`/`g`).
 * @param channel3 - The third channel (`h`/`b`).
 * @param alpha - The optional alpha channel; omitted, the origin's alpha is kept.
 * @returns A `Color` unioning the origin's and the channels' references.
 * @example
 * ```ts
 * const hover = Color.from(Color.ref('accent'), ColorSpace.oklch, Calc.multiply(Channel.L, 0.8), Channel.C, Channel.H)
 * Color.serialize(hover) // 'oklch(from var(--accent) calc(l * 0.8) c h)'
 * const faded = Color.from(Color.ref('brand'), ColorSpace.srgb, Channel.R, Channel.G, Channel.B, Calc.multiply(Channel.Alpha, 0.5))
 * Color.serialize(faded) // 'color(from var(--brand) srgb r g b / calc(alpha * 0.5))'
 * ```
 * @since 0.2.0
 */
export const from: <
  O extends string = never,
  Space extends ColorSpace = ColorSpace,
  C1 extends string = never,
  C2 extends string = never,
  C3 extends string = never,
  A extends string = never,
>(
  origin: Color<O>,
  space: Space,
  channel1: RelativeChannel<C1, ChannelsOf<Space>>,
  channel2: RelativeChannel<C2, ChannelsOf<Space>>,
  channel3: RelativeChannel<C3, ChannelsOf<Space>>,
  alpha?: RelativeChannel<A, ChannelsOf<Space>>,
) => Color<O | C1 | C2 | C3 | A> = internal.from

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

/**
 * The origin-channel keyword tokens the color reads — the `Channel` keywords a
 * relative color's channels reference (`l`, `c`, `h`, ...), gathered across its
 * channels and any nested colors. Empty for a color with no relative parts.
 *
 * The `Color` companion to `Calc.channels`, and the mirror of `refs`: where
 * `refs` reports the custom properties a color depends on, `channels` reports
 * the origin channels a relative color reads. They are disjoint — a channel
 * keyword is never a reference — so a channel token never appears in `refs` nor
 * reaches a `Stylesheet`'s dependency report.
 *
 * @param color - The color to inspect.
 * @returns The set of channel-keyword tokens the color reads.
 * @example
 * ```ts
 * const hover = Color.from(Color.ref('accent'), ColorSpace.oklch, Calc.multiply(Channel.L, 0.8), Channel.C, Channel.H)
 * Color.channels(hover) // Set { 'l', 'c', 'h' }
 * Color.refs(hover) // Set { 'accent' }
 * ```
 * @since 0.2.0
 */
export const channels: (color: Color<string>) => ReadonlySet<string> = internal.channels

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
