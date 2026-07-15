/**
 * Runtime helpers for the unbound-variable sets carried by expression
 * values. The matching type-level machinery (the phantom `Vars` parameter
 * and `ApplyBindings`) lives with the public types in calc/calc.ts;
 * container modules extract vars from heterogeneous members with
 * conditionals over their member unions (`RuleSet.MemberVars`).
 */

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
