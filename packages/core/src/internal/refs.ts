/**
 * Runtime helpers for the unbound-variable sets carried by expression
 * values, and the cross-world protocol that shares them. The matching
 * type-level machinery (the phantom `Vars` parameter and `ApplyBindings`)
 * lives with the public types in calc/calc.ts; container modules extract
 * vars from heterogeneous members with conditionals over their member
 * unions (`RuleSet.MemberVars`).
 *
 * The protocol exists so `Var` values can union a fallback's reads without
 * importing the fallback's world: `Calc`, `Color`, and `Var` impls each
 * expose their vars set behind `RefsTypeId`, and `refsOf` reads any of them
 * (the same seam shape as the Equal protocol).
 */

/** @internal */
export const RefsTypeId: unique symbol = Symbol.for('fashionable/Refs')

/** @internal */
export type RefsTypeId = typeof RefsTypeId

/** @internal */
export interface HasRefs {
  readonly [RefsTypeId]: ReadonlySet<string>
}

/** @internal */
export const refsOf = (u: unknown): ReadonlySet<string> =>
  typeof u === 'object' && u !== null && RefsTypeId in u ? (u as HasRefs)[RefsTypeId] : EMPTY_REFS

/** @internal */
export const unionRefs = (...sets: ReadonlyArray<ReadonlySet<string>>): Set<string> => {
  const merged = new Set<string>()
  for (const set of sets) {
    for (const ref of set) {
      merged.add(ref)
    }
  }
  return merged
}

/** @internal */
export const EMPTY_REFS: ReadonlySet<never> = new Set()
