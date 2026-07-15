import * as Equal from '#internal/equal'
import { unionRefs } from '#internal/refs'
import type { MediaQuery } from '#query/mediaQuery'
import type { Selector } from '#selector/selector'
import { isSelector } from '#selector/selector.internal'
import { dual, Pipeable } from '#util'
import { make as makeMediaRule } from './mediaRule.internal.ts'
import { blockBodyLines, memberRefs, refSetOf, resolveRenderOptions } from './rule.internal.ts'
import type { Member, MemberRefs, RenderOptions, RuleSet } from './ruleSet.ts'
import { make as makeStyleRule } from './styleRule.internal.ts'

export const RuleSetTypeId = Symbol.for('fashionable/rule/ruleSet')
export type RuleSetTypeId = typeof RuleSetTypeId

class RuleSetImpl extends Pipeable implements RuleSet<string>, Equal.Equal {
  readonly [RuleSetTypeId]: RuleSetTypeId = RuleSetTypeId

  readonly members: ReadonlyArray<Member<string>>
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(members: ReadonlyArray<Member<string>>) {
    super()
    this.members = members
    this.refSet = unionRefs(...members.map(memberRefs))
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return (
      isRuleSet(that) &&
      this.members.length === that.members.length &&
      this.members.every((member, index) => Equal.equals(member, that.members[index]))
    )
  }

  [Equal.HashTypeId](): number {
    if (this.#hash === undefined) {
      let h = Equal.hashString('fashionable/rule/ruleSet')
      for (const member of this.members) {
        h = Equal.combine(h, Equal.hash(member))
      }
      this.#hash = h
    }
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `RuleSet(${this.members.length})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isRuleSet = (u: unknown): u is RuleSet<string> =>
  typeof u === 'object' && u !== null && RuleSetTypeId in u

/** @internal */
export const empty: RuleSet<never> = new RuleSetImpl([]) as unknown as RuleSet<never>

/** @internal */
export function make<Members extends ReadonlyArray<Member<string>>>(
  ...members: Members
): RuleSet<MemberRefs<Members[number]>> {
  return (members.length === 0 ? empty : new RuleSetImpl(members)) as RuleSet<
    MemberRefs<Members[number]>
  >
}

const resolveMember = (head: unknown, block: unknown): Member<string> => {
  if (block === undefined) {
    return head as Member<string>
  }
  return isSelector(head)
    ? makeStyleRule(head, block as RuleSet<string>)
    : makeMediaRule(head as MediaQuery, block as RuleSet<string>)
}

/** @internal */
export const append: {
  <M extends Member<string>>(
    member: M,
  ): <Refs extends string>(self: RuleSet<Refs>) => RuleSet<Refs | MemberRefs<M>>
  <B extends string>(
    selector: Selector,
    block: RuleSet<B>,
  ): <Refs extends string>(self: RuleSet<Refs>) => RuleSet<Refs | B>
  <B extends string>(
    query: MediaQuery,
    block: RuleSet<B>,
  ): <Refs extends string>(self: RuleSet<Refs>) => RuleSet<Refs | B>
  <Refs extends string, M extends Member<string>>(
    self: RuleSet<Refs>,
    member: M,
  ): RuleSet<Refs | MemberRefs<M>>
  <Refs extends string, B extends string>(
    self: RuleSet<Refs>,
    selector: Selector,
    block: RuleSet<B>,
  ): RuleSet<Refs | B>
  <Refs extends string, B extends string>(
    self: RuleSet<Refs>,
    query: MediaQuery,
    block: RuleSet<B>,
  ): RuleSet<Refs | B>
} = dual(
  (args: IArguments) => isRuleSet(args[0]),
  (self: RuleSet<string>, head: unknown, block?: unknown): RuleSet<string> =>
    new RuleSetImpl([...self.members, resolveMember(head, block)]),
)

/** @internal */
export const concat: {
  <B extends string>(that: RuleSet<B>): <A extends string>(self: RuleSet<A>) => RuleSet<A | B>
  <A extends string, B extends string>(self: RuleSet<A>, that: RuleSet<B>): RuleSet<A | B>
} = dual(
  2,
  (self: RuleSet<string>, that: RuleSet<string>): RuleSet<string> =>
    new RuleSetImpl([...self.members, ...that.members]),
)

/** @internal */
export function refs<Refs extends string>(set: RuleSet<Refs>): ReadonlySet<Refs> {
  return refSetOf(set) as ReadonlySet<Refs>
}

/** @internal */
export const render = (set: RuleSet<string>, options?: RenderOptions): string =>
  blockBodyLines(set, 0, resolveRenderOptions(options)).join('\n')

/** @internal */
export const equals = dual<
  (that: RuleSet<string>) => (self: RuleSet<string>) => boolean,
  (self: RuleSet<string>, that: RuleSet<string>) => boolean
>(2, (self: RuleSet<string>, that: RuleSet<string>): boolean => Equal.equals(self, that))
