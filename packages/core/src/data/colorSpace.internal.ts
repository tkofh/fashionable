import type { ColorSpace } from './colorSpace.ts'

export const ColorSpaceTypeId = Symbol.for('fashionable/data/colorSpace')
export type ColorSpaceTypeId = typeof ColorSpaceTypeId

/**
 * How a relative color built in this space serializes: a named color function
 * (`oklch(from ...)`) or the `color()` wrapper with a colorspace token
 * (`color(from ... srgb ...)`).
 *
 * @internal
 */
export type Wrap = 'function' | 'color'

/**
 * The erased runtime of a color space: the token that names it and how it
 * wraps. The channel-brand scoping is type-only and lives in `colorSpace.ts`.
 *
 * @internal
 */
export interface ColorSpaceData {
  readonly token: string
  readonly wrap: Wrap
}

class ColorSpaceImpl {
  readonly [ColorSpaceTypeId]: ColorSpaceTypeId = ColorSpaceTypeId

  constructor(
    readonly token: string,
    readonly wrap: Wrap,
  ) {}

  get [Symbol.toStringTag]() {
    return `ColorSpace(${this.token})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const oklch = new ColorSpaceImpl('oklch', 'function')

/** @internal */
export const srgb = new ColorSpaceImpl('srgb', 'color')

/** @internal */
export const dataOf = (space: ColorSpace<unknown>): ColorSpaceData =>
  space as unknown as ColorSpaceData
