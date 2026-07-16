import * as Equal from '#internal/equal'
import { unionRefs } from '#internal/refs'
import type { MediaQuery } from '#query/mediaQuery'
import type { Selector } from '#selector/selector'
import { isSelector } from '#selector/selector.internal'
import { dual, Pipeable } from '#util'
import type { Name as VarName } from '#var/var'
import type { AnyVar } from '#var/var.internal'
import { make as makeMediaRule } from './mediaRule.internal.ts'
import type { MediaRule } from './mediaRule.ts'
import { blockBodyLines, memberRefs, refSetOf, resolveRenderOptions } from './rule.internal.ts'
import type { Member, MemberVars, RenderOptions, RuleSet } from './ruleSet.ts'
import { make as makeStyleRule } from './styleRule.internal.ts'
import type { StyleRule } from './styleRule.ts'

export const RuleSetTypeId = Symbol.for('fashionable/rule/ruleSet')
export type RuleSetTypeId = typeof RuleSetTypeId

class RuleSetImpl extends Pipeable implements RuleSet<AnyVar>, Equal.Equal {
  readonly [RuleSetTypeId]: RuleSetTypeId = RuleSetTypeId

  readonly members: ReadonlyArray<Member<AnyVar>>
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(members: ReadonlyArray<Member<AnyVar>>) {
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
export const isRuleSet = (u: unknown): u is RuleSet<AnyVar> =>
  typeof u === 'object' && u !== null && RuleSetTypeId in u

/** @internal */
export const empty: RuleSet<never> = new RuleSetImpl([]) as unknown as RuleSet<never>

/** @internal */
export const isEmpty = (set: RuleSet<AnyVar>): boolean => set.members.length === 0

/** @internal */
export function make<Members extends ReadonlyArray<Member<AnyVar>>>(
  ...members: Members
): RuleSet<MemberVars<Members[number]>> {
  return (members.length === 0 ? empty : new RuleSetImpl(members)) as RuleSet<
    MemberVars<Members[number]>
  >
}

const resolveMember = (head: unknown, block: unknown): Member<AnyVar> => {
  if (block === undefined) {
    return head as Member<AnyVar>
  }
  return isSelector(head)
    ? makeStyleRule(head, block as RuleSet<AnyVar>)
    : makeMediaRule(head as MediaQuery, block as RuleSet<AnyVar>)
}

/** @internal */
export const append: {
  <M extends Member<AnyVar>>(
    member: M,
  ): <Vars extends AnyVar>(self: RuleSet<Vars>) => RuleSet<Vars | MemberVars<M>>
  <B extends AnyVar>(
    selector: Selector,
    block: RuleSet<B>,
  ): <Vars extends AnyVar>(self: RuleSet<Vars>) => RuleSet<Vars | B>
  <B extends AnyVar>(
    query: MediaQuery,
    block: RuleSet<B>,
  ): <Vars extends AnyVar>(self: RuleSet<Vars>) => RuleSet<Vars | B>
  <Vars extends AnyVar, M extends Member<AnyVar>>(
    self: RuleSet<Vars>,
    member: M,
  ): RuleSet<Vars | MemberVars<M>>
  <Vars extends AnyVar, B extends AnyVar>(
    self: RuleSet<Vars>,
    selector: Selector,
    block: RuleSet<B>,
  ): RuleSet<Vars | B>
  <Vars extends AnyVar, B extends AnyVar>(
    self: RuleSet<Vars>,
    query: MediaQuery,
    block: RuleSet<B>,
  ): RuleSet<Vars | B>
} = dual(
  (args: IArguments) => isRuleSet(args[0]),
  (self: RuleSet<AnyVar>, head: unknown, block?: unknown): RuleSet<AnyVar> =>
    new RuleSetImpl([...self.members, resolveMember(head, block)]),
)

/** @internal */
export const concat: {
  <B extends AnyVar>(that: RuleSet<B>): <A extends AnyVar>(self: RuleSet<A>) => RuleSet<A | B>
  <A extends AnyVar, B extends AnyVar>(self: RuleSet<A>, that: RuleSet<B>): RuleSet<A | B>
} = dual(
  2,
  (self: RuleSet<AnyVar>, that: RuleSet<AnyVar>): RuleSet<AnyVar> =>
    new RuleSetImpl([...self.members, ...that.members]),
)

/** @internal */
export const forSelector: {
  (selector: Selector): <Vars extends AnyVar>(self: RuleSet<Vars>) => StyleRule<Vars>
  <Vars extends AnyVar>(self: RuleSet<Vars>, selector: Selector): StyleRule<Vars>
} = dual(
  2,
  (self: RuleSet<AnyVar>, selector: Selector): StyleRule<AnyVar> => makeStyleRule(selector, self),
)

/** @internal */
export const forMediaQuery: {
  (query: MediaQuery): <Vars extends AnyVar>(self: RuleSet<Vars>) => MediaRule<Vars>
  <Vars extends AnyVar>(self: RuleSet<Vars>, query: MediaQuery): MediaRule<Vars>
} = dual(
  2,
  (self: RuleSet<AnyVar>, query: MediaQuery): MediaRule<AnyVar> => makeMediaRule(query, self),
)

/** @internal */
export function refs<Vars extends AnyVar>(set: RuleSet<Vars>): ReadonlySet<VarName<Vars>> {
  return refSetOf(set) as ReadonlySet<VarName<Vars>>
}

/** @internal */
export const render = (set: RuleSet<AnyVar>, options?: RenderOptions): string =>
  blockBodyLines(set, 0, resolveRenderOptions(options)).join('\n')

/** @internal */
export const equals = dual<
  (that: RuleSet<AnyVar>) => (self: RuleSet<AnyVar>) => boolean,
  (self: RuleSet<AnyVar>, that: RuleSet<AnyVar>) => boolean
>(2, (self: RuleSet<AnyVar>, that: RuleSet<AnyVar>): boolean => Equal.equals(self, that))
