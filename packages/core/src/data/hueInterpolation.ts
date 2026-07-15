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
