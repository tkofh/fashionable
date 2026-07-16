import * as Equal from '#internal/equal'
import { unionRefs } from '#internal/refs'
import type { MediaQuery } from '#query/mediaQuery'
import type { Requirement, Selector } from '#selector/selector'
import { isSelector } from '#selector/selector.internal'
import { dual, Pipeable } from '#util'
import type { Name as VarName } from '#var/var'
import type { AnyVar } from '#var/var.internal'
import { make as makeMediaRule } from './mediaRule.internal.ts'
import type { MediaRule } from './mediaRule.ts'
import {
  blockBodyLines,
  memberNeedsParent,
  memberRefs,
  refSetOf,
  resolveRenderOptions,
} from './rule.internal.ts'
import type { Member, MemberRequires, MemberVars, RenderOptions, RuleSet } from './ruleSet.ts'
import { make as makeStyleRule } from './styleRule.internal.ts'
import type { StyleRule } from './styleRule.ts'

export const RuleSetTypeId = Symbol.for('fashionable/rule/ruleSet')
export type RuleSetTypeId = typeof RuleSetTypeId

class RuleSetImpl extends Pipeable implements RuleSet<AnyVar>, Equal.Equal {
  readonly [RuleSetTypeId]: RuleSetTypeId = RuleSetTypeId

  readonly members: ReadonlyArray<Member<AnyVar>>
  readonly refSet: ReadonlySet<string>
  readonly needsParent: boolean
  #hash: number | undefined

  constructor(members: ReadonlyArray<Member<AnyVar>>) {
    super()
    this.members = members
    this.refSet = unionRefs(...members.map(memberRefs))
    this.needsParent = members.some(memberNeedsParent)
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
export const empty: RuleSet<never, never> = new RuleSetImpl([]) as unknown as RuleSet<never, never>

/** @internal */
export const isEmpty = (set: RuleSet<AnyVar>): boolean => set.members.length === 0

/** @internal */
export function make<Members extends ReadonlyArray<Member<AnyVar>>>(
  ...members: Members
): RuleSet<MemberVars<Members[number]>, MemberRequires<Members[number]>> {
  return (members.length === 0 ? empty : new RuleSetImpl(members)) as RuleSet<
    MemberVars<Members[number]>,
    MemberRequires<Members[number]>
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
  ): <Vars extends AnyVar, Requires extends Requirement>(
    self: RuleSet<Vars, Requires>,
  ) => RuleSet<Vars | MemberVars<M>, Requires | MemberRequires<M>>
  <B extends AnyVar, S extends Requirement>(
    selector: Selector<S>,
    block: RuleSet<B>,
  ): <Vars extends AnyVar, Requires extends Requirement>(
    self: RuleSet<Vars, Requires>,
  ) => RuleSet<Vars | B, Requires | S>
  <B extends AnyVar, BR extends Requirement>(
    query: MediaQuery,
    block: RuleSet<B, BR>,
  ): <Vars extends AnyVar, Requires extends Requirement>(
    self: RuleSet<Vars, Requires>,
  ) => RuleSet<Vars | B, Requires | BR>
  <Vars extends AnyVar, Requires extends Requirement, M extends Member<AnyVar>>(
    self: RuleSet<Vars, Requires>,
    member: M,
  ): RuleSet<Vars | MemberVars<M>, Requires | MemberRequires<M>>
  <Vars extends AnyVar, Requires extends Requirement, B extends AnyVar, S extends Requirement>(
    self: RuleSet<Vars, Requires>,
    selector: Selector<S>,
    block: RuleSet<B>,
  ): RuleSet<Vars | B, Requires | S>
  <Vars extends AnyVar, Requires extends Requirement, B extends AnyVar, BR extends Requirement>(
    self: RuleSet<Vars, Requires>,
    query: MediaQuery,
    block: RuleSet<B, BR>,
  ): RuleSet<Vars | B, Requires | BR>
} = dual(
  (args: IArguments) => isRuleSet(args[0]),
  (self: RuleSet<AnyVar>, head: unknown, block?: unknown): RuleSet<AnyVar> =>
    new RuleSetImpl([...self.members, resolveMember(head, block)]),
)

/** @internal */
export const concat: {
  <B extends AnyVar, BR extends Requirement>(
    that: RuleSet<B, BR>,
  ): <A extends AnyVar, AR extends Requirement>(self: RuleSet<A, AR>) => RuleSet<A | B, AR | BR>
  <A extends AnyVar, AR extends Requirement, B extends AnyVar, BR extends Requirement>(
    self: RuleSet<A, AR>,
    that: RuleSet<B, BR>,
  ): RuleSet<A | B, AR | BR>
} = dual(
  2,
  (self: RuleSet<AnyVar>, that: RuleSet<AnyVar>): RuleSet<AnyVar> =>
    new RuleSetImpl([...self.members, ...that.members]),
)

/** @internal */
export const forSelector: {
  <S extends Requirement>(
    selector: Selector<S>,
  ): <Vars extends AnyVar>(self: RuleSet<Vars>) => StyleRule<Vars, S>
  <Vars extends AnyVar, S extends Requirement>(
    self: RuleSet<Vars>,
    selector: Selector<S>,
  ): StyleRule<Vars, S>
} = dual(
  2,
  (self: RuleSet<AnyVar>, selector: Selector<Requirement>): StyleRule<AnyVar, Requirement> =>
    makeStyleRule(selector, self),
)

/** @internal */
export const forMediaQuery: {
  (
    query: MediaQuery,
  ): <Vars extends AnyVar, Requires extends Requirement>(
    self: RuleSet<Vars, Requires>,
  ) => MediaRule<Vars, Requires>
  <Vars extends AnyVar, Requires extends Requirement>(
    self: RuleSet<Vars, Requires>,
    query: MediaQuery,
  ): MediaRule<Vars, Requires>
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
