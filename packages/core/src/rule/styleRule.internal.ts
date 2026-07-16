import * as Equal from '#internal/equal'
import type { Selector } from '#selector/selector'
import { render as renderSelector } from '#selector/selector.internal'
import { dual, Pipeable } from '#util'
import type { Name as VarName } from '#var/var'
import type { AnyVar } from '#var/var.internal'
import { refSetOf, renderStyleRuleBlock, resolveRenderOptions } from './rule.internal.ts'
import type { RuleSet } from './ruleSet.ts'
import type { RenderOptions, StyleRule } from './styleRule.ts'

export const StyleRuleTypeId = Symbol.for('fashionable/rule/styleRule')
export type StyleRuleTypeId = typeof StyleRuleTypeId

class StyleRuleImpl extends Pipeable implements StyleRule<AnyVar>, Equal.Equal {
  readonly [StyleRuleTypeId]: StyleRuleTypeId = StyleRuleTypeId

  readonly selector: Selector
  readonly block: RuleSet<AnyVar>
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(selector: Selector, block: RuleSet<AnyVar>) {
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
export const isStyleRule = (u: unknown): u is StyleRule<AnyVar> =>
  typeof u === 'object' && u !== null && StyleRuleTypeId in u

/** @internal */
export function make<Vars extends AnyVar>(
  selector: Selector,
  block: RuleSet<Vars>,
): StyleRule<Vars> {
  return new StyleRuleImpl(selector, block) as unknown as StyleRule<Vars>
}

/** @internal */
export function refs<Vars extends AnyVar>(rule: StyleRule<Vars>): ReadonlySet<VarName<Vars>> {
  return refSetOf(rule) as ReadonlySet<VarName<Vars>>
}

/** @internal */
export const render = (rule: StyleRule<AnyVar>, options?: RenderOptions): string =>
  renderStyleRuleBlock(rule.selector, rule.block, resolveRenderOptions(options))

/** @internal */
export const equals = dual<
  (that: StyleRule<AnyVar>) => (self: StyleRule<AnyVar>) => boolean,
  (self: StyleRule<AnyVar>, that: StyleRule<AnyVar>) => boolean
>(2, (self: StyleRule<AnyVar>, that: StyleRule<AnyVar>): boolean => Equal.equals(self, that))
