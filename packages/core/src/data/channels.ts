/**
 * Origin-channel keywords for relative color syntax. Inside a relative color
 * — `Color.oklchFrom`, `Color.srgbFrom` — these reference the channels of the
 * `from` origin, converted into the destination function's color space:
 * `oklch(from <origin> l c h)` rebuilds the origin unchanged, and arithmetic
 * on the keywords derives a new color (`calc(l * 0.8)` darkens it).
 *
 * Each keyword is a `Calc` number expression that serializes bare — `l`, not
 * `var(--l)` — and contributes no references: the browser resolves it from the
 * origin, so it is neither a custom property nor a `Color.bind` target. They
 * compose with every `Calc` combinator, and the destination function fixes
 * which are in scope — `l`/`c`/`h` for `oklch`, `r`/`g`/`b` for `srgb`, `alpha`
 * for both. That the keyword you pass is one the function accepts is not
 * checked, matching the library's posture on identifiers.
 *
 * Modeled today: the `oklch` and `color(srgb ...)` channels. Siblings
 * (`s`/`w`, the `lab` axes) arrive with the color functions that name them.
 *
 * @since 0.2.0
 */

import type { Calc } from '#calc/calc'
import * as internal from './channels.internal.ts'

/**
 * The `l` origin channel — lightness in `oklch`. Serializes bare as `l`.
 *
 * @since 0.2.0
 */
export const L: Calc<never> = internal.L

/**
 * The `c` origin channel — chroma in `oklch`. Serializes bare as `c`.
 *
 * @since 0.2.0
 */
export const C: Calc<never> = internal.C

/**
 * The `h` origin channel — hue in `oklch`, in degrees. Serializes bare as `h`.
 *
 * @since 0.2.0
 */
export const H: Calc<never> = internal.H

/**
 * The `r` origin channel — red in `color(srgb ...)`. Serializes bare as `r`.
 *
 * @since 0.2.0
 */
export const R: Calc<never> = internal.R

/**
 * The `g` origin channel — green in `color(srgb ...)`. Serializes bare as `g`.
 *
 * @since 0.2.0
 */
export const G: Calc<never> = internal.G

/**
 * The `b` origin channel — blue in `color(srgb ...)`. Serializes bare as `b`.
 *
 * @since 0.2.0
 */
export const B: Calc<never> = internal.B

/**
 * The `alpha` origin channel — the opacity of the `from` origin, in `oklch`
 * and `color(srgb ...)` alike. Serializes bare as `alpha`.
 *
 * @since 0.2.0
 */
export const Alpha: Calc<never> = internal.Alpha
