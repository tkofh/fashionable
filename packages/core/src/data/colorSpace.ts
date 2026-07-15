/**
 * The destination color space of a relative color — the argument to
 * `Color.from` that picks both the serialized function form and which origin
 * channels are in scope. `ColorSpace.oklch` derives an `oklch(from ...)` color
 * whose channels are `Channel.L`/`C`/`H` (and `Alpha`); `ColorSpace.srgb`
 * derives a `color(from ... srgb ...)` whose channels are `Channel.R`/`G`/`B`.
 *
 * Each space carries its channels as a phantom brand union, so `Color.from`
 * reads the scope straight off the space argument — passing `Channel.R` into an
 * `oklch` relative color is a compile error, no keyword strings threaded
 * through the signature. This is the destination-function space, distinct from
 * the interpolation `Colorspace` of `Color.mix` (the `in <space>` of
 * `color-mix()`); the color spaces overlap, the roles do not.
 *
 * Modeled today: `oklch` and `srgb`. Siblings arrive with the color functions
 * that name them.
 *
 * @since 0.2.0
 */

import type { ColorSpaceTypeId } from './colorSpace.internal.ts'
import * as internal from './colorSpace.internal.ts'
import type { ChannelLeaf } from './units.ts'

declare const ColorSpaceChannels: unique symbol

/**
 * A relative-color destination space. The `Channels` parameter carries the
 * origin-channel keyword brands (`Channel`) valid in the space, exactly as
 * `Color.from` needs them to scope its channel arguments; a bare `ColorSpace`
 * admits any channel.
 *
 * @since 0.2.0
 */
export interface ColorSpace<out Channels = ChannelLeaf<string>> {
  readonly [ColorSpaceTypeId]: ColorSpaceTypeId
  readonly [ColorSpaceChannels]?: Channels
}

/**
 * The `oklch` destination space: `Color.from(origin, ColorSpace.oklch, l, c, h)`
 * serializes as `oklch(from origin l c h)`, with `Channel.L`/`C`/`H` (and
 * `Alpha`) in scope.
 *
 * @since 0.2.0
 */
export const oklch: ColorSpace<
  ChannelLeaf<'l'> | ChannelLeaf<'c'> | ChannelLeaf<'h'> | ChannelLeaf<'alpha'>
> = internal.oklch

/**
 * The `srgb` destination space: `Color.from(origin, ColorSpace.srgb, r, g, b)`
 * serializes as `color(from origin srgb r g b)`, with `Channel.R`/`G`/`B` (and
 * `Alpha`) in scope.
 *
 * @since 0.2.0
 */
export const srgb: ColorSpace<
  ChannelLeaf<'r'> | ChannelLeaf<'g'> | ChannelLeaf<'b'> | ChannelLeaf<'alpha'>
> = internal.srgb
