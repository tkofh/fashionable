import * as Equal from '#internal/equal'
import type { MediaQuery } from '#query/mediaQuery'
import { render as renderQuery } from '#query/mediaQuery.internal'
import { dual, Pipeable } from '#util'
import type { MediaRule, RenderOptions } from './mediaRule.ts'
import { refSetOf, renderMediaRuleBlock, resolveRenderOptions } from './rule.internal.ts'
import type { RuleSet } from './ruleSet.ts'

export const MediaRuleTypeId = Symbol.for('fashionable/rule/mediaRule')
export type MediaRuleTypeId = typeof MediaRuleTypeId

class MediaRuleImpl extends Pipeable implements MediaRule<string>, Equal.Equal {
  readonly [MediaRuleTypeId]: MediaRuleTypeId = MediaRuleTypeId

  readonly query: MediaQuery
  readonly block: RuleSet<string>
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(query: MediaQuery, block: RuleSet<string>) {
    super()
    this.query = query
    this.block = block
    this.refSet = refSetOf(block)
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return (
      isMediaRule(that) &&
      Equal.equals(this.query, that.query) &&
      Equal.equals(this.block, that.block)
    )
  }

  [Equal.HashTypeId](): number {
    if (this.#hash === undefined) {
      let h = Equal.hashString('fashionable/rule/mediaRule')
      h = Equal.combine(h, Equal.hash(this.query))
      h = Equal.combine(h, Equal.hash(this.block))
      this.#hash = h
    }
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `MediaRule(${renderQuery(this.query)})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isMediaRule = (u: unknown): u is MediaRule<string> =>
  typeof u === 'object' && u !== null && MediaRuleTypeId in u

/** @internal */
export function make<Vars extends string>(
  query: MediaQuery,
  block: RuleSet<Vars>,
): MediaRule<Vars> {
  return new MediaRuleImpl(query, block) as unknown as MediaRule<Vars>
}

/** @internal */
export function refs<Vars extends string>(rule: MediaRule<Vars>): ReadonlySet<Vars> {
  return refSetOf(rule) as ReadonlySet<Vars>
}

/** @internal */
export const render = (rule: MediaRule<string>, options?: RenderOptions): string =>
  renderMediaRuleBlock(rule.query, rule.block, resolveRenderOptions(options))

/** @internal */
export const equals = dual<
  (that: MediaRule<string>) => (self: MediaRule<string>) => boolean,
  (self: MediaRule<string>, that: MediaRule<string>) => boolean
>(2, (self: MediaRule<string>, that: MediaRule<string>): boolean => Equal.equals(self, that))
