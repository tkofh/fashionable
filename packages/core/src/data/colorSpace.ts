/**
 * A CSS color space, as a nominal value. Two consumers share the vocabulary:
 * `Color.from` derives a relative color *in* the space (its channels and
 * serialized function form), and `Color.mix` interpolates *in* the space (the
 * `in <space>` of `color-mix()`). `ColorSpace.oklch` serves both — an
 * `oklch(from ...)` destination and a polar interpolation space.
 *
 * Capabilities are carried as type-level **traits** (the curvy pattern): a
 * space's `Trait` parameter accumulates the brands it satisfies, and a position
 * requires a capability by naming its brand. `Polar` is the trait a space with
 * a hue channel carries (`oklch`, `lch`, `hsl`, `hwb`), and `Color.mix` requires
 * it to accept a `HueInterpolation`; rectangular spaces simply lack it. The
 * `Channels` parameter is the payload `Color.from` scopes on — the `Channel`
 * keywords valid in the space. Only `oklch` and `srgb` name their channels
 * today; the rest are interpolation-only until a consumer needs their `from`
 * channels.
 *
 * @since 0.2.0
 */

import type { ColorSpaceTraits, ColorSpaceTypeId } from './colorSpace.internal.ts'
import * as internal from './colorSpace.internal.ts'
import type { ChannelLeaf } from './units.ts'

declare const ColorSpaceChannels: unique symbol
declare const PolarId: unique symbol

/**
 * The trait a polar color space carries — one with a hue channel. `Color.mix`
 * requires it to take a `HueInterpolation`, and `PolarSpace` is the space type
 * that has it. Composes by intersection with future space traits, as curvy's
 * brands do.
 *
 * @since 0.2.0
 */
export type Polar = { readonly [PolarId]: 'polar' }

/**
 * A color space. `Channels` carries the origin-channel keyword brands
 * (`Channel`) valid for `Color.from`; `Trait` accumulates the space's
 * capability brands (`Polar`), defaulting to `unknown` — a space with no
 * capability claims. A position requires a capability by naming its brand in
 * `Trait` (`ColorSpace<Channels, Polar>`).
 *
 * @since 0.2.0
 */
export interface ColorSpace<out Channels = ChannelLeaf<string>, out Trait = unknown> {
  readonly [ColorSpaceTypeId]: ColorSpaceTypeId
  readonly [ColorSpaceChannels]?: Channels
  readonly [ColorSpaceTraits]?: Trait
}

/**
 * A polar color space — one carrying the `Polar` trait, so `Color.mix` may take
 * a `HueInterpolation` after it.
 *
 * @since 0.2.0
 */
export type PolarSpace<Channels = ChannelLeaf<string>> = ColorSpace<Channels, Polar>

/**
 * The `oklch` space: a polar interpolation space, and an `oklch(from ...)`
 * destination with `Channel.L`/`C`/`H` (and `Alpha`) in scope.
 *
 * @since 0.2.0
 */
export const oklch: ColorSpace<
  ChannelLeaf<'l'> | ChannelLeaf<'c'> | ChannelLeaf<'h'> | ChannelLeaf<'alpha'>,
  Polar
> = internal.oklch

/**
 * The `srgb` space: a rectangular interpolation space, and a
 * `color(from ... srgb ...)` destination with `Channel.R`/`G`/`B` (and `Alpha`)
 * in scope.
 *
 * @since 0.2.0
 */
export const srgb: ColorSpace<
  ChannelLeaf<'r'> | ChannelLeaf<'g'> | ChannelLeaf<'b'> | ChannelLeaf<'alpha'>
> = internal.srgb

/**
 * The `srgb-linear` space (rectangular).
 *
 * @since 0.2.0
 */
export const srgbLinear: ColorSpace<never> = internal.srgbLinear

/**
 * The `display-p3` space (rectangular).
 *
 * @since 0.2.0
 */
export const displayP3: ColorSpace<never> = internal.displayP3

/**
 * The `a98-rgb` space (rectangular).
 *
 * @since 0.2.0
 */
export const a98Rgb: ColorSpace<never> = internal.a98Rgb

/**
 * The `prophoto-rgb` space (rectangular).
 *
 * @since 0.2.0
 */
export const prophotoRgb: ColorSpace<never> = internal.prophotoRgb

/**
 * The `rec2020` space (rectangular).
 *
 * @since 0.2.0
 */
export const rec2020: ColorSpace<never> = internal.rec2020

/**
 * The `lab` space (rectangular).
 *
 * @since 0.2.0
 */
export const lab: ColorSpace<never> = internal.lab

/**
 * The `oklab` space (rectangular).
 *
 * @since 0.2.0
 */
export const oklab: ColorSpace<never> = internal.oklab

/**
 * The `xyz` space (rectangular; an alias for `xyz-d65`).
 *
 * @since 0.2.0
 */
export const xyz: ColorSpace<never> = internal.xyz

/**
 * The `xyz-d50` space (rectangular).
 *
 * @since 0.2.0
 */
export const xyzD50: ColorSpace<never> = internal.xyzD50

/**
 * The `xyz-d65` space (rectangular).
 *
 * @since 0.2.0
 */
export const xyzD65: ColorSpace<never> = internal.xyzD65

/**
 * The `hsl` space (polar).
 *
 * @since 0.2.0
 */
export const hsl: ColorSpace<never, Polar> = internal.hsl

/**
 * The `hwb` space (polar).
 *
 * @since 0.2.0
 */
export const hwb: ColorSpace<never, Polar> = internal.hwb

/**
 * The `lch` space (polar).
 *
 * @since 0.2.0
 */
export const lch: ColorSpace<never, Polar> = internal.lch
