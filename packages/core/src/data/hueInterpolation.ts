/**
 * How a polar `color-mix()` traverses the hue circle between its two colors —
 * the argument that follows a polar `ColorSpace` in `Color.mix`. `shorter` and
 * `longer` take the short or long arc between the hues; `increasing` and
 * `decreasing` force the direction of travel. Serialized before the literal
 * `hue` keyword, as CSS spells it: `in oklch longer hue`.
 *
 * A polar space in `Color.mix` may be given without one — the browser defaults
 * to `shorter` — so these are the explicit override.
 *
 * @since 0.2.0
 */

import type { Calc, Input } from '#calc/calc'
import type { HueInterpolationTypeId } from './hueInterpolation.internal.ts'
import * as internal from './hueInterpolation.internal.ts'

declare const HueInterpolationStrategy: unique symbol

/**
 * A hue-interpolation strategy. The `Strategy` parameter names the specific
 * one (`'longer'`), letting a position accept a particular strategy where it
 * matters; `Color.mix` accepts any.
 *
 * @since 0.2.0
 */
export interface HueInterpolation<Strategy extends string = string> {
  readonly [HueInterpolationTypeId]: HueInterpolationTypeId
  readonly [HueInterpolationStrategy]?: Strategy
}

/**
 * The `shorter` strategy — the short arc between the two hues (the browser
 * default). Serializes as `shorter hue`.
 *
 * @since 0.2.0
 */
export const shorter: HueInterpolation<'shorter'> = internal.shorter

/**
 * The `longer` strategy — the long arc between the two hues. Serializes as
 * `longer hue`.
 *
 * @since 0.2.0
 */
export const longer: HueInterpolation<'longer'> = internal.longer

/**
 * The `increasing` strategy — hues traversed in increasing order, wrapping past
 * `360` if needed. Serializes as `increasing hue`.
 *
 * @since 0.2.0
 */
export const increasing: HueInterpolation<'increasing'> = internal.increasing

/**
 * The `decreasing` strategy — hues traversed in decreasing order, wrapping past
 * `0` if needed. Serializes as `decreasing hue`.
 *
 * @since 0.2.0
 */
export const decreasing: HueInterpolation<'decreasing'> = internal.decreasing

/**
 * Builds the hue at `t` along the arc from `from` to `to` under `strategy` — the
 * JS side of what a polar `Color.mix` emits for the browser. Hues are numbers of
 * degrees (as an oklch/lch hue channel is), and `from`, `to`, and `t` are each a
 * number or a `Calc`, so the result is a `Calc` too: fully symbolic when any
 * argument is, folding to a constant when all are numbers.
 *
 * The hue math is the CSS Color 4 fixup, written branchlessly with `mod`: each
 * strategy is a signed delta added to `from` as `t` runs `0` (at `from`) to `1`
 * (at `to`). `shorter` and `longer` take the short or long arc between the hues;
 * `increasing`/`decreasing` force the direction. The result is unwrapped — it may
 * fall outside `[0, 360)`, which the browser resolves as a hue — and unions the
 * arguments' variables. Drop it straight into a hue channel (`Color.oklch`).
 *
 * @param strategy - The traversal strategy (`shorter`, `longer`, ...).
 * @param from - The start hue, in degrees: a number or a `Calc`.
 * @param to - The end hue, in degrees: a number or a `Calc`.
 * @param t - The interpolation parameter, `0` to `1`: a number or a `Calc`.
 * @returns The interpolated hue in degrees, a `Calc` unioning the arguments' variables.
 * @example
 * ```ts
 * const hue = HueInterpolation.interpolate(HueInterpolation.shorter, 30, Calc.var('to'), Calc.var('t'))
 * Calc.serialize(hue) // 'calc(30 + (mod(var(--to) - 30 + 180, 360) - 180) * var(--t))'
 * Calc.serialize(HueInterpolation.interpolate(HueInterpolation.increasing, 20, 350, 0.5)) // '185'
 * ```
 * @since 0.2.0
 */
export const interpolate: <
  F extends string = never,
  T extends string = never,
  P extends string = never,
>(
  strategy: HueInterpolation,
  from: Input<F>,
  to: Input<T>,
  t: Input<P>,
) => Calc<F | T | P> = internal.interpolate
