import * as Equal from '../internal/equal.ts'
import { render as renderSelector } from '../selector/selector.internal.ts'
import type { Selector } from '../selector/selector.ts'
import { dual, Pipeable } from '../utils.ts'
import { refSetOf, renderStyleRuleBlock, resolveRenderOptions } from './rule.internal.ts'
import type { RuleSet } from './ruleSet.ts'
import type { RenderOptions, StyleRule } from './styleRule.ts'

export const StyleRuleTypeId = Symbol.for('fashionable/rule/styleRule')
export type StyleRuleTypeId = typeof StyleRuleTypeId

class StyleRuleImpl extends Pipeable implements StyleRule<string>, Equal.Equal {
  readonly [StyleRuleTypeId]: StyleRuleTypeId = StyleRuleTypeId

  readonly selector: Selector
  readonly block: RuleSet<string>
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(selector: Selector, block: RuleSet<string>) {
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
export const isStyleRule = (u: unknown): u is StyleRule<string> =>
  typeof u === 'object' && u !== null && StyleRuleTypeId in u

/** @internal */
export function make<Refs extends string>(
  selector: Selector,
  block: RuleSet<Refs>,
): StyleRule<Refs> {
  return new StyleRuleImpl(selector, block) as unknown as StyleRule<Refs>
}

/** @internal */
export function refs<Refs extends string>(rule: StyleRule<Refs>): ReadonlySet<Refs> {
  return refSetOf(rule) as ReadonlySet<Refs>
}

/** @internal */
export const render = (rule: StyleRule<string>, options?: RenderOptions): string =>
  renderStyleRuleBlock(rule.selector, rule.block, resolveRenderOptions(options))

/** @internal */
export const equals = dual<
  (that: StyleRule<string>) => (self: StyleRule<string>) => boolean,
  (self: StyleRule<string>, that: StyleRule<string>) => boolean
>(2, (self: StyleRule<string>, that: StyleRule<string>): boolean => Equal.equals(self, that))
