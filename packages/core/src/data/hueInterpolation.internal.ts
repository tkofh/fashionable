import type { HueInterpolation } from './hueInterpolation.ts'

export const HueInterpolationTypeId = Symbol.for('fashionable/data/hueInterpolation')
export type HueInterpolationTypeId = typeof HueInterpolationTypeId

class HueInterpolationImpl {
  readonly [HueInterpolationTypeId]: HueInterpolationTypeId = HueInterpolationTypeId

  constructor(readonly strategy: string) {}

  get [Symbol.toStringTag]() {
    return `HueInterpolation(${this.strategy})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const shorter = new HueInterpolationImpl('shorter')

/** @internal */
export const longer = new HueInterpolationImpl('longer')

/** @internal */
export const increasing = new HueInterpolationImpl('increasing')

/** @internal */
export const decreasing = new HueInterpolationImpl('decreasing')

/** @internal */
export const strategyOf = (hue: HueInterpolation<string>): string =>
  (hue as unknown as HueInterpolationImpl).strategy
