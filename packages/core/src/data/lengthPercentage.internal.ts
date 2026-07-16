import type { Calc } from '#calc/calc'
import type { Bottom } from '#calc/calc.internal'
import type { AnyVar } from '#var/var.internal'
import type * as Unit from './unit.ts'

/**
 * The runtime is the identity: widening is a type-level anchor, and the
 * expression tree already carries its units structurally. The bottom
 * return is the usual widening discipline; the public signature carries
 * the real vars/requires threading.
 *
 * @internal
 */
export const of = (value: Calc<AnyVar, Unit.LengthPercentage, unknown>): Bottom =>
  value as unknown as Bottom
