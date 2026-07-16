import { isDeclaration } from '#declaration/declaration.internal'
import * as Equal from '#internal/equal'
import type { Requirement, Selector } from '#selector/selector'
import { needsParent, render as renderSelector } from '#selector/selector.internal'
import { dual, invariant, Pipeable } from '#util'
import type { Name as VarName } from '#var/var'
import type { AnyVar } from '#var/var.internal'
import { refSetOf, renderStyleRuleBlock, resolveRenderOptions } from './rule.internal.ts'
import type { RuleSet } from './ruleSet.ts'
import type { RenderOptions, StyleRule } from './styleRule.ts'

export const StyleRuleTypeId = Symbol.for('fashionable/rule/styleRule')
export type StyleRuleTypeId = typeof StyleRuleTypeId

class StyleRuleImpl extends Pipeable implements StyleRule<AnyVar, Requirement>, Equal.Equal {
  readonly [StyleRuleTypeId]: StyleRuleTypeId = StyleRuleTypeId

  readonly selector: Selector<Requirement>
  readonly block: RuleSet<AnyVar>
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(selector: Selector<Requirement>, block: RuleSet<AnyVar>) {
    super()
    this.selector = selector
    this.block = block
    this.refSet = refSetOf(block)
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return (
      isStyleRule(that) &&
      Equal.equals(this.selector, that.selector) &&
      Equal.equals(this.block, that.block)
    )
  }

  [Equal.HashTypeId](): number {
    if (this.#hash === undefined) {
      let h = Equal.hashString('fashionable/rule/styleRule')
      h = Equal.combine(h, Equal.hash(this.selector))
      h = Equal.combine(h, Equal.hash(this.block))
      this.#hash = h
    }
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `StyleRule(${renderSelector(this.selector)})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isStyleRule = (u: unknown): u is StyleRule<AnyVar, Requirement> =>
  typeof u === 'object' && u !== null && StyleRuleTypeId in u

// The binder invariant (docs/selector-nesting.md section 1): every style
// rule reachable from this rule's block without crossing another style
// rule — media rules are transparent — binds its `&` against this rule's
// selector, so each must actually reference it. The walk stops at style
// rules because their own construction ran this same check.
const requireNestedSelectors = (block: RuleSet<AnyVar>): void => {
  for (const member of block.members) {
    if (isDeclaration(member)) {
      continue
    }
    if ('query' in member) {
      requireNestedSelectors(member.block)
    } else {
      invariant(
        needsParent(member.selector),
        `A nested style rule must reference its parent — include Selector.nest ('&') in '${renderSelector(member.selector)}'; the model does not prepend CSS's implicit descendant`,
      )
    }
  }
}

/** @internal */
export function make<Vars extends AnyVar, S extends Requirement>(
  selector: Selector<S>,
  block: RuleSet<Vars>,
): StyleRule<Vars, S> {
  requireNestedSelectors(block)
  return new StyleRuleImpl(selector, block) as unknown as StyleRule<Vars, S>
}

/** @internal */
export function refs<Vars extends AnyVar>(
  rule: StyleRule<Vars, Requirement>,
): ReadonlySet<VarName<Vars>> {
  return refSetOf(rule) as ReadonlySet<VarName<Vars>>
}

/** @internal */
export const render = (rule: StyleRule<AnyVar, Requirement>, options?: RenderOptions): string =>
  renderStyleRuleBlock(rule.selector, rule.block, resolveRenderOptions(options))

/** @internal */
export const equals = dual<
  (that: StyleRule<AnyVar, Requirement>) => (self: StyleRule<AnyVar, Requirement>) => boolean,
  (self: StyleRule<AnyVar, Requirement>, that: StyleRule<AnyVar, Requirement>) => boolean
>(2, (self: StyleRule<AnyVar, Requirement>, that: StyleRule<AnyVar, Requirement>): boolean =>
  Equal.equals(self, that),
)
