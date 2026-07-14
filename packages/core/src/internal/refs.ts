/**
 * Runtime helpers for the unbound-reference sets carried by expression
 * values. The matching type-level machinery (the phantom `Refs` parameter
 * and `ApplyBindings`) lives with the public types in calc/calc.ts;
 * container modules extract refs from heterogeneous members with
 * conditionals over their member unions (`RuleSet.MemberRefs`).
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
