import { Calc } from '#calc'
import type { Input } from '#calc/calc'
import type { HueInterpolation } from './hueInterpolation.ts'

export const HueInterpolationTypeId = Symbol.for('fashionable/data/hueInterpolation')
export type HueInterpolationTypeId = typeof HueInterpolationTypeId

class HueInterpolationImpl {
  readonly [HueInterpolationTypeId]: HueInterpolationTypeId = HueInterpolationTypeId
  readonly strategy: string

  constructor(strategy: string) {
    this.strategy = strategy
  }

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

/** @internal */
export const interpolate = (
  strategy: HueInterpolation<string>,
  from: Input<string>,
  to: Input<string>,
  t: Input<string>,
): Calc.Calc<never> => {
  // CSS Color 4 hue fixup, branchless in degree-space (`mod` handles the
  // normalization): each strategy is a signed delta the browser adds to `from`
  // as `t` runs 0 to 1. `shorter` and `longer` are complementary arcs;
  // `increasing`/`decreasing` force the direction.
  const delta = Calc.subtract(to, from)
  const shortest = Calc.subtract(Calc.mod(Calc.add(delta, 180), 360), 180)
  const strat = strategyOf(strategy)
  const step =
    strat === 'increasing'
      ? Calc.mod(delta, 360)
      : strat === 'decreasing'
        ? Calc.subtract(Calc.mod(delta, 360), 360)
        : strat === 'longer'
          ? Calc.subtract(shortest, Calc.multiply(360, Calc.sign(shortest)))
          : shortest
  return Calc.add(from, Calc.multiply(step, t)) as unknown as Calc.Calc<never>
}
