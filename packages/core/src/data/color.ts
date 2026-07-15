import type { ApplyBindings, Bindings, Calc, Input, SerializeOptions } from '#calc/calc'
import type { Pipeable } from '#util'
import type { ColorTypeId } from './color.internal.ts'
import * as internal from './color.internal.ts'
import type { ColorSpace, PolarSpace } from './colorSpace.ts'
import type { HueInterpolation } from './hueInterpolation.ts'
import type { None } from './keywords.ts'

declare const ColorVars: unique symbol

/**
 * A CSS color expression whose channels are `Calc` number expressions.
 *
 * A color is not a number: it can be bound and serialized, but not
 * solved. The `Vars` parameter unions the channels' unbound variable
 * names, exactly as on `Calc`.
 *
 * `oklch(...)`, `color(srgb ...)`, `light-dark(...)`, `color-mix(...)`,
 * relative colors (`oklch(from ...)`, `color(from ...)`), a color-valued
 * `var(...)`, and named colors are modeled today; other color functions
 * arrive as a consumer needs them. Channels accept `Keyword.none`, CSS's
 * missing-component value.
 *
 * Construct via `oklch`, `srgb`, `lightDark`, `mix`, `named`, `from`, and
 * `var` (or the `transparent` constant).
 *
 * @since 0.1.0
 */
export interface Color<out Vars extends string = string> extends Pipeable {
  readonly [ColorTypeId]: ColorTypeId
  readonly [ColorVars]?: Vars
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
 * @returns A `Color` with the channels' variables unioned.
 * @example
 * ```ts
 * const accent = Color.oklch(Calc.var('lightness'), 0.15, 220)
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
 * @returns A `Color` with the channels' variables unioned.
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
 * color has no channels, contributes no variables, and binds nothing.
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
 * Creates a color-valued read of a CSS variable — `Color.var('accent')`
 * serializes as `var(--accent)`. Use it where a whole color is read from a
 * custom property: as a standalone value, or as the origin of a relative
 * color (`from`). Exported as `var` (`Color.var('accent')`) because `var` is
 * reserved in declaration position.
 *
 * The read is the whole value, so it carries `name` as its one unbound
 * variable — a dependency, exactly as an unbound `Calc.var` is — but has no
 * channels. `bind` substitutes channel expressions, not whole colors, so it
 * leaves a color variable in place; the browser resolves it from the cascade.
 *
 * @param name - The variable name, without the `--` prefix. Must be non-empty.
 * @returns A `Color` with `name` as its one unbound variable.
 * @throws `Error` when `name` is empty.
 * @example
 * ```ts
 * Color.serialize(Color.var('accent')) // 'var(--accent)'
 * ```
 * @since 0.2.0
 */
const _var: <Name extends string>(name: Name) => Color<Name> = internal.ref
export { _var as var }

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
 * @returns A `Color` with both arms' variables unioned.
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

// A mix arm: a bare color, or a [color, weight] tuple. A bare number weight
// reads as a percent; a `Percentage` expression carries an annotated or
// computed one, and a plain number-kind `Calc` is rejected.
type MixArm<C extends string, P extends string> =
  | Color<C>
  | readonly [Color<C>, number | Calc<P, 'percentage', unknown>]

/**
 * Creates a `color-mix(...)`: the browser mixes `color1` and `color2` in the
 * interpolation `space`. Each arm is a bare `Color` or a `[color, percentage]`
 * tuple giving its weight — a bare number reads as a percent (`20` is `20%`,
 * the `<percentage>` convention), a `Percentage` expression an annotated or
 * computed weight (`Percentage.of(20)`, `Calc.multiply(Percentage.of(50), ...)`);
 * a plain number-kind `Calc` is rejected, a weight being a `<percentage>`.
 *
 * A polar `space` (`ColorSpace.oklch`, `ColorSpace.lch`, ...) may take a
 * `HueInterpolation` strategy between the space and the colors — the second
 * overload — for how the hue circle is traversed; omit it and the browser
 * defaults to `shorter`. A rectangular space has no hue channel, so passing a
 * strategy is a compile error, mirroring the grammar where
 * `<hue-interpolation-method>` follows only a polar space.
 *
 * Percentages are optional and preserved verbatim — fashionable emits the
 * authored form and never runs the spec's mixing normalization (omitted weights
 * defaulting to `50%`, weights off `100%` rescaling with an alpha multiplier),
 * which is computed-value behavior the browser owns. Like every `Color`, a mix
 * binds and serializes but does not solve, and each arm and each percentage
 * contributes its variables to the result.
 *
 * @param space - The interpolation `ColorSpace`; a polar one may be followed by a `HueInterpolation`.
 * @param color1 - The first color, or a `[color, percentage]` tuple weighting it.
 * @param color2 - The second color, or a `[color, percentage]` tuple weighting it.
 * @returns A `Color` unioning both arms' and both percentages' variables.
 * @example
 * ```ts
 * Color.serialize(Color.mix(ColorSpace.oklch, Color.named('red'), Color.named('blue')))
 * // 'color-mix(in oklch, red, blue)'
 * Color.serialize(Color.mix(ColorSpace.srgb, [Color.named('white'), 20], Color.named('black')))
 * // 'color-mix(in srgb, white 20%, black)'
 * Color.serialize(Color.mix(ColorSpace.oklch, HueInterpolation.longer, Color.named('red'), Color.named('blue')))
 * // 'color-mix(in oklch longer hue, red, blue)'
 * ```
 * @since 0.2.0
 */
export const mix: {
  <
    C1 extends string = never,
    P1 extends string = never,
    C2 extends string = never,
    P2 extends string = never,
  >(
    space: ColorSpace,
    color1: MixArm<C1, P1>,
    color2: MixArm<C2, P2>,
  ): Color<C1 | P1 | C2 | P2>
  <
    C1 extends string = never,
    P1 extends string = never,
    C2 extends string = never,
    P2 extends string = never,
  >(
    space: PolarSpace,
    hue: HueInterpolation,
    color1: MixArm<C1, P1>,
    color2: MixArm<C2, P2>,
  ): Color<C1 | P1 | C2 | P2>
} = internal.mix

/**
 * A channel slot of a relative color: a bare number, `Keyword.none`, or a
 * `Calc` number expression. `Channels` is the set of origin-channel keyword
 * brands (`ChannelIdent`) the expression may read — the space's own channels —
 * so a keyword from another color space (`Channel.R` in an `oklch` slot) is a
 * compile error. A plain expression (a constant, a `Calc.var`, a `clamp`)
 * carries no channel keyword and fits any slot.
 *
 * @since 0.2.0
 */
export type RelativeChannel<Vars extends string, Channels> =
  | number
  | None
  | Calc<Vars, 'number', Channels>

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
 * origin's own variables union into the result; the channel keywords
 * contribute none, since the browser resolves them from the origin.
 *
 * @param origin - The color to derive from — any `Color`, commonly a `var`.
 * @param space - The destination `ColorSpace`, fixing the function form and the channels in scope.
 * @param channel1 - The first channel (`l`/`r`), in the space's order.
 * @param channel2 - The second channel (`c`/`g`).
 * @param channel3 - The third channel (`h`/`b`).
 * @param alpha - The optional alpha channel; omitted, the origin's alpha is kept.
 * @returns A `Color` unioning the origin's and the channels' variables.
 * @example
 * ```ts
 * const hover = Color.from(Color.var('accent'), ColorSpace.oklch, Calc.multiply(Channel.L, 0.8), Channel.C, Channel.H)
 * Color.serialize(hover) // 'oklch(from var(--accent) calc(l * 0.8) c h)'
 * const faded = Color.from(Color.var('brand'), ColorSpace.srgb, Channel.R, Channel.G, Channel.B, Calc.multiply(Channel.Alpha, 0.5))
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
   * @param bindings - Variable names to values or expressions.
   * @returns A function replacing bound variables in its argument.
   * @since 0.1.0
   */
  <const B extends Bindings>(
    bindings: B,
  ): <Vars extends string>(color: Color<Vars>) => Color<ApplyBindings<Vars, B>>
  /**
   * Replaces variables in the color's channels with values or other
   * expressions, re-folding constant subtrees. Semantics match
   * `Calc.bind`: unread names and `undefined` values are ignored, and
   * expression-valued bindings contribute their own variables.
   *
   * @param color - The color to bind.
   * @param bindings - Variable names to values or expressions.
   * @returns The bound color.
   * @since 0.1.0
   */
  <Vars extends string, const B extends Bindings>(
    color: Color<Vars>,
    bindings: B,
  ): Color<ApplyBindings<Vars, B>>
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
 * const surface = Color.oklch(Calc.add(Calc.var('l'), 0.1), 0.04, 250)
 * Color.serialize(surface) // 'oklch(calc(var(--l) + 0.1) 0.04 250)'
 * ```
 * @since 0.1.0
 */
export const serialize: <Vars extends string>(
  color: Color<Vars>,
  options?: SerializeOptions<Vars>,
) => string = internal.serialize

/**
 * The color's unbound variable names, unioned across channels.
 *
 * @param color - The color to inspect.
 * @returns The set of unbound variable names.
 * @since 0.1.0
 */
export const vars: <Vars extends string>(color: Color<Vars>) => ReadonlySet<Vars> = internal.refs

/**
 * The origin-channel keyword tokens the color reads — the `Channel` keywords a
 * relative color's channels reference (`l`, `c`, `h`, ...), gathered across its
 * channels and any nested colors. Empty for a color with no relative parts.
 *
 * The `Color` companion to `Calc.idents`, and the mirror of `vars`: where
 * `vars` reports the custom properties a color depends on, `channels` reports
 * the origin channels a relative color reads. They are disjoint — a channel
 * keyword is never a variable — so a channel token never appears in `vars` nor
 * reaches a `Stylesheet`'s dependency report.
 *
 * @param color - The color to inspect.
 * @returns The set of channel-keyword tokens the color reads.
 * @example
 * ```ts
 * const hover = Color.from(Color.var('accent'), ColorSpace.oklch, Calc.multiply(Channel.L, 0.8), Channel.C, Channel.H)
 * Color.channels(hover) // Set { 'l', 'c', 'h' }
 * Color.vars(hover) // Set { 'accent' }
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
