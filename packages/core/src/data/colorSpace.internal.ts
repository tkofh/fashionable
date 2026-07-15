import type { ColorSpace } from './colorSpace.ts'

export const ColorSpaceTypeId = Symbol.for('fashionable/data/colorSpace')
export type ColorSpaceTypeId = typeof ColorSpaceTypeId

/**
 * Phantom key holding a `ColorSpace`'s `Trait` parameter. The runtime value
 * never has a value here — traits are type-level brands, so a space is
 * identical at runtime whatever its traits (the curvy trait pattern).
 *
 * @internal
 */
export const ColorSpaceTraits: unique symbol = Symbol.for('fashionable/data/colorSpace/traits')
export type ColorSpaceTraits = typeof ColorSpaceTraits

/**
 * How a relative color built in this space serializes: a named color function
 * (`oklch(from ...)`) or the `color()` wrapper with a colorspace token
 * (`color(from ... srgb ...)`).
 *
 * @internal
 */
export type Wrap = 'function' | 'color'

/**
 * The erased runtime of a color space: the token that names it (`in <token>`
 * for `mix`, the destination for `from`) and how a `from` wraps. Polar-ness is
 * a type-level trait, so it carries no runtime data.
 *
 * @internal
 */
export interface ColorSpaceData {
  readonly token: string
  readonly wrap: Wrap
}

class ColorSpaceImpl {
  readonly [ColorSpaceTypeId]: ColorSpaceTypeId = ColorSpaceTypeId
  readonly token: string
  readonly wrap: Wrap

  constructor(token: string, wrap: Wrap) {
    this.token = token
    this.wrap = wrap
  }

  get [Symbol.toStringTag]() {
    return `ColorSpace(${this.token})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const srgb = new ColorSpaceImpl('srgb', 'color')
/** @internal */
export const srgbLinear = new ColorSpaceImpl('srgb-linear', 'color')
/** @internal */
export const displayP3 = new ColorSpaceImpl('display-p3', 'color')
/** @internal */
export const a98Rgb = new ColorSpaceImpl('a98-rgb', 'color')
/** @internal */
export const prophotoRgb = new ColorSpaceImpl('prophoto-rgb', 'color')
/** @internal */
export const rec2020 = new ColorSpaceImpl('rec2020', 'color')
/** @internal */
export const lab = new ColorSpaceImpl('lab', 'function')
/** @internal */
export const oklab = new ColorSpaceImpl('oklab', 'function')
/** @internal */
export const xyz = new ColorSpaceImpl('xyz', 'color')
/** @internal */
export const xyzD50 = new ColorSpaceImpl('xyz-d50', 'color')
/** @internal */
export const xyzD65 = new ColorSpaceImpl('xyz-d65', 'color')
/** @internal */
export const hsl = new ColorSpaceImpl('hsl', 'function')
/** @internal */
export const hwb = new ColorSpaceImpl('hwb', 'function')
/** @internal */
export const lch = new ColorSpaceImpl('lch', 'function')
/** @internal */
export const oklch = new ColorSpaceImpl('oklch', 'function')

/** @internal */
export const dataOf = (space: ColorSpace<unknown>): ColorSpaceData =>
  space as unknown as ColorSpaceData
