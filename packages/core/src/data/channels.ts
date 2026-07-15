/**
 * Origin-channel keywords for relative color syntax. Inside a relative color
 * — `Color.from(origin, ColorSpace.oklch, ...)` — these reference the channels
 * of the `from` origin, converted into the destination space:
 * `oklch(from <origin> l c h)` rebuilds the origin unchanged, and arithmetic
 * on the keywords derives a new color (`calc(l * 0.8)` darkens it).
 *
 * Each keyword is a `Calc` number expression that serializes bare — `l`, not
 * `var(--l)` — and contributes no variables: it is neither a custom property
 * nor a `Color.bind` target, since the browser resolves it from the origin. It
 * is not opaque to `Calc.solve`, though — each carries a `ChannelIdent` leaf
 * brand, so an expression built on one solves by supplying the keyword's value
 * in the `idents` section of the solve options
 * (`Calc.solve(expr, { idents: { l: 0.62 } })`), the way a viewport unit
 * supplies a ratio through `units`. They compose with every `Calc` combinator,
 * and the destination `ColorSpace` passed to `Color.from` fixes which are in
 * scope — `l`/`c`/`h` for `oklch`, `r`/`g`/`b` for `srgb`, `alpha` for both —
 * through the brand each keyword carries, so an out-of-space keyword is a
 * compile error.
 *
 * Modeled today: the `oklch` and `color(srgb ...)` channels. Siblings
 * (`s`/`w`, the `lab` axes) arrive with the color functions that name them.
 *
 * @since 0.2.0
 */

import type { Calc, Ident } from '#calc/calc'
import * as internal from './channels.internal.ts'

declare const ChannelId: unique symbol

/**
 * The leaf brand of an origin-channel keyword: the refinement of `Calc.Ident`
 * the `Channel` keywords carry. The extra brand is what scopes relative-color
 * slots — a `ColorSpace` names the `ChannelIdent`s it admits, so a bare
 * identifier from some other construct never satisfies a channel slot even if
 * its token collides — while everything generic over identifiers (`solve`'s
 * `idents` section, `Calc.idents`) keys on the `Ident` base and needs no
 * special case.
 *
 * @since 0.2.0
 */
export interface ChannelIdent<Name extends string> extends Ident<Name> {
  readonly [ChannelId]: Name
}

/**
 * The `l` origin channel — lightness in `oklch`. Serializes bare as `l`.
 *
 * @since 0.2.0
 */
export const L: Calc<never, 'number', ChannelIdent<'l'>> = internal.L

/**
 * The `c` origin channel — chroma in `oklch`. Serializes bare as `c`.
 *
 * @since 0.2.0
 */
export const C: Calc<never, 'number', ChannelIdent<'c'>> = internal.C

/**
 * The `h` origin channel — hue in `oklch`, in degrees. Serializes bare as `h`.
 *
 * @since 0.2.0
 */
export const H: Calc<never, 'number', ChannelIdent<'h'>> = internal.H

/**
 * The `r` origin channel — red in `color(srgb ...)`. Serializes bare as `r`.
 *
 * @since 0.2.0
 */
export const R: Calc<never, 'number', ChannelIdent<'r'>> = internal.R

/**
 * The `g` origin channel — green in `color(srgb ...)`. Serializes bare as `g`.
 *
 * @since 0.2.0
 */
export const G: Calc<never, 'number', ChannelIdent<'g'>> = internal.G

/**
 * The `b` origin channel — blue in `color(srgb ...)`. Serializes bare as `b`.
 *
 * @since 0.2.0
 */
export const B: Calc<never, 'number', ChannelIdent<'b'>> = internal.B

/**
 * The `alpha` origin channel — the opacity of the `from` origin, in `oklch`
 * and `color(srgb ...)` alike. Serializes bare as `alpha`.
 *
 * @since 0.2.0
 */
export const Alpha: Calc<never, 'number', ChannelIdent<'alpha'>> = internal.Alpha
