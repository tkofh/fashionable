import type { Declaration } from '#declaration/declaration'
import { isDeclaration } from '#declaration/declaration.internal'
import { isFontFaceRule, render as renderFontFace } from '#fontFace/fontFaceRule.internal'
import * as Equal from '#internal/equal'
import { EMPTY_REFS, unionRefs } from '#internal/refs'
import type { RenderOptions as PropertyRenderOptions } from '#property/propertyRule'
import { isPropertyRule, render as renderPropertyRule } from '#property/propertyRule.internal'
import type { MediaQuery } from '#query/mediaQuery'
import { coSatisfiable, implies } from '#query/mediaQuery.internal'
import { isMediaRule } from '#rule/mediaRule.internal'
import {
  needsParentOf,
  refSetOf,
  type RenderContext,
  renderMediaRuleBlock,
  renderStyleRuleBlock,
  resolveRenderOptions,
} from '#rule/rule.internal'
import type { RuleSet } from '#rule/ruleSet'
import { concat as concatBlocks } from '#rule/ruleSet.internal'
import type { StyleRule } from '#rule/styleRule'
import { isStyleRule, make as makeStyleRule } from '#rule/styleRule.internal'
import type { Requirement, Selector } from '#selector/selector'
import { needsParent, render as renderSelector, specificity } from '#selector/selector.internal'
import { compare as compareSpecificity } from '#selector/specificity.internal'
import { dual, invariant, Pipeable } from '#util'
import type { Name as VarName } from '#var/var'
import type { AnyVar } from '#var/var.internal'
import type { CoalesceOptions, Node, NodeVars, RenderOptions, Stylesheet } from './stylesheet.ts'

export const StylesheetTypeId = Symbol.for('fashionable/stylesheet')
export type StylesheetTypeId = typeof StylesheetTypeId

const nodeRefs = (node: Node<AnyVar>): ReadonlySet<string> =>
  isStyleRule(node) || isMediaRule(node) ? refSetOf(node) : EMPTY_REFS

class StylesheetImpl extends Pipeable implements Stylesheet<AnyVar>, Equal.Equal {
  readonly [StylesheetTypeId]: StylesheetTypeId = StylesheetTypeId

  readonly nodes: ReadonlyArray<Node<AnyVar>>
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(nodes: ReadonlyArray<Node<AnyVar>>) {
    super()
    this.nodes = nodes
    this.refSet = unionRefs(...nodes.map(nodeRefs))
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return (
      isStylesheet(that) &&
      this.nodes.length === that.nodes.length &&
      this.nodes.every((node, index) => Equal.equals(node, that.nodes[index]))
    )
  }

  [Equal.HashTypeId](): number {
    if (this.#hash === undefined) {
      let h = Equal.hashString('fashionable/stylesheet')
      for (const node of this.nodes) {
        h = Equal.combine(h, Equal.hash(node))
      }
      this.#hash = h
    }
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `Stylesheet(${this.nodes.length})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isStylesheet = (u: unknown): u is Stylesheet<AnyVar> =>
  typeof u === 'object' && u !== null && StylesheetTypeId in u

const appendDistinct = (
  kept: Array<Node<AnyVar>>,
  buckets: Map<number, Array<Node<AnyVar>>>,
  node: Node<AnyVar>,
): boolean => {
  const hash = Equal.hash(node)
  const bucket = buckets.get(hash)
  if (bucket?.some((existing) => Equal.equals(existing, node))) {
    return false
  }
  if (bucket === undefined) {
    buckets.set(hash, [node])
  } else {
    bucket.push(node)
  }
  kept.push(node)
  return true
}

const distinct = (nodes: ReadonlyArray<Node<AnyVar>>): Array<Node<AnyVar>> => {
  const kept: Array<Node<AnyVar>> = []
  const buckets = new Map<number, Array<Node<AnyVar>>>()
  for (const node of nodes) {
    appendDistinct(kept, buckets, node)
  }
  return kept
}

/** @internal */
export const empty: Stylesheet<never> = new StylesheetImpl([]) as unknown as Stylesheet<never>

/** @internal */
export const isEmpty = (sheet: Stylesheet<AnyVar>): boolean => sheet.nodes.length === 0

// The root gate (docs/selector-nesting.md section 1): nothing above a
// top-level node binds `&`, so nothing that still needs a parent may
// enter the node list — an `&`-bearing rule selector, or a media block
// carrying bare declarations or `&`-selector rules. The node union
// enforces this at the type level (`Requires = never` arms); this
// runtime mirror covers callers the types cannot see.
const requireClosedNode = (node: Node<AnyVar>): Node<AnyVar> => {
  if (isStyleRule(node)) {
    invariant(
      !needsParent(node.selector),
      `A style rule whose selector references '&' cannot sit at the top level of a stylesheet — nothing binds the nesting selector; nest it inside another style rule`,
    )
  } else if (isMediaRule(node)) {
    invariant(
      !needsParentOf(node.block),
      `A media rule at the top level of a stylesheet must hold only closed style rules — bare declarations and '&'-selectors have no subject there; nest the rule inside a style rule`,
    )
  }
  return node
}

/** @internal */
export function make<Nodes extends ReadonlyArray<Node<AnyVar>>>(
  ...nodes: Nodes
): Stylesheet<NodeVars<Nodes[number]>> {
  const kept = distinct(nodes.map(requireClosedNode))
  return (kept.length === 0 ? empty : new StylesheetImpl(kept)) as Stylesheet<
    NodeVars<Nodes[number]>
  >
}

const resolveNode = (head: unknown, block: unknown): Node<AnyVar> =>
  block === undefined
    ? (head as Node<AnyVar>)
    : makeStyleRule(head as Selector, block as RuleSet<AnyVar>)

/** @internal */
export const append: {
  <N extends Node<AnyVar>>(
    node: N,
  ): <Vars extends AnyVar>(self: Stylesheet<Vars>) => Stylesheet<Vars | NodeVars<N>>
  <B extends AnyVar>(
    selector: Selector,
    block: RuleSet<B>,
  ): <Vars extends AnyVar>(self: Stylesheet<Vars>) => Stylesheet<Vars | B>
  <Vars extends AnyVar, N extends Node<AnyVar>>(
    self: Stylesheet<Vars>,
    node: N,
  ): Stylesheet<Vars | NodeVars<N>>
  <Vars extends AnyVar, B extends AnyVar>(
    self: Stylesheet<Vars>,
    selector: Selector,
    block: RuleSet<B>,
  ): Stylesheet<Vars | B>
} = dual(
  (args: IArguments) => isStylesheet(args[0]),
  (self: Stylesheet<AnyVar>, head: unknown, block?: unknown): Stylesheet<AnyVar> => {
    const node = requireClosedNode(resolveNode(head, block))
    if (self.nodes.some((existing) => Equal.equals(existing, node))) {
      return self
    }
    return new StylesheetImpl([...self.nodes, node])
  },
)

/** @internal */
export const merge: {
  <B extends AnyVar>(
    that: Stylesheet<B>,
  ): <A extends AnyVar>(self: Stylesheet<A>) => Stylesheet<A | B>
  <A extends AnyVar, B extends AnyVar>(self: Stylesheet<A>, that: Stylesheet<B>): Stylesheet<A | B>
} = dual(2, (self: Stylesheet<AnyVar>, that: Stylesheet<AnyVar>): Stylesheet<AnyVar> => {
  if (that.nodes.length === 0) {
    return self
  }
  if (self.nodes.length === 0) {
    return that
  }
  const kept: Array<Node<AnyVar>> = []
  const buckets = new Map<number, Array<Node<AnyVar>>>()
  for (const node of self.nodes) {
    appendDistinct(kept, buckets, node)
  }
  let changed = false
  for (const node of that.nodes) {
    if (appendDistinct(kept, buckets, node)) {
      changed = true
    }
  }
  return changed ? new StylesheetImpl(kept) : self
})

/** @internal */
export function mergeAll(sheets: ReadonlyArray<Stylesheet<AnyVar>>): Stylesheet<never> {
  let merged: Stylesheet<AnyVar> = empty
  for (const sheet of sheets) {
    merged = merge(merged, sheet)
  }
  return merged as Stylesheet<never>
}

interface PendingPull {
  readonly selector: Selector<Requirement>
  readonly block: RuleSet<AnyVar>
  readonly crossedIndex: number
}

interface Setter {
  readonly declaration: Declaration<AnyVar>
  readonly query: MediaQuery | undefined
}

// A block flattened to (declaration, query) setters, `undefined` query
// meaning the declaration applies in every state. `undefined` result: the
// block nests beyond declarations and one-level `@media` blocks, which
// the shadow check refuses rather than reasons through.
const settersOf = (block: RuleSet<AnyVar>): Array<Setter> | undefined => {
  const setters: Array<Setter> = []
  for (const member of block.members) {
    if (isDeclaration(member)) {
      setters.push({ declaration: member, query: undefined })
    } else if (isMediaRule(member)) {
      for (const inner of member.block.members) {
        if (!isDeclaration(inner)) {
          return undefined
        }
        setters.push({ declaration: inner, query: member.query })
      }
    } else {
      return undefined
    }
  }
  return setters
}

const collectCrossings = (
  kept: ReadonlyArray<Node<AnyVar>>,
  anchor: number,
  rule: StyleRule<AnyVar>,
  pending: Array<PendingPull>,
): void => {
  const pulled = specificity(rule.selector)
  for (let index = anchor + 1; index < kept.length; index++) {
    const node = kept[index] as Node<AnyVar>
    if (!isStyleRule(node) || Equal.equals(node.selector, rule.selector)) {
      continue
    }
    if (compareSpecificity(specificity(node.selector), pulled) === 0) {
      pending.push({ selector: rule.selector, block: rule.block, crossedIndex: index })
    }
  }
}

/**
 * The strict-mode check: a pull is unsafe when the moved block crosses a
 * style rule whose selector ties the pulled selector on specificity,
 * unless every moved declaration is provably shadowed by the crossed
 * rule. Shadowed means the crossed rule re-establishes the declaration —
 * a structurally equal declaration under a query the moved one's query
 * implies — and no later member under a co-satisfiable query sets a
 * different value. Matching semantics stay out of scope: the check never
 * asks whether tying selectors reach the same element, only whether the
 * move could change a computed value if they did.
 *
 * Crossings are collected during the fold but verified afterwards,
 * against each crossed rule's final member list: a re-establishing
 * setter can arrive from a node after the moved block (the scheme
 * mirror's toggle half in dtcg's sheets), invisible to a
 * check that fires at encounter time. The safety argument is therefore
 * global rather than per-move — coalescing preserves member order
 * within every selector family, so the shadow conditions over the final
 * list pin the crossed family's last applicable setter in every state
 * where the moved declaration applies.
 */
const requireShadowedPull = (pull: PendingPull, nodes: ReadonlyArray<Node<AnyVar>>): void => {
  const crossed = nodes[pull.crossedIndex] as StyleRule<AnyVar>
  const moved = settersOf(pull.block)
  const members = settersOf(crossed.block)
  invariant(
    moved !== undefined && members !== undefined,
    `Coalescing '${renderSelector(pull.selector)}' would pull its block across '${renderSelector(crossed.selector)}', which ties on specificity and nests beyond the shadow check — the pull can change the cascade`,
  )
  for (const setter of moved) {
    const name = setter.declaration.name
    const competing = members.filter((member) => member.declaration.name === name)
    if (competing.length === 0) {
      continue
    }
    const reestablished = competing.findLastIndex(
      (member) =>
        implies(setter.query, member.query) && Equal.equals(member.declaration, setter.declaration),
    )
    invariant(
      reestablished !== -1,
      `Coalescing '${renderSelector(pull.selector)}' would pull '${name}' across '${renderSelector(crossed.selector)}', which ties on specificity without re-establishing its value — the pull can change the cascade`,
    )
    for (let index = reestablished + 1; index < competing.length; index++) {
      const later = competing[index] as Setter
      invariant(
        !coSatisfiable(setter.query, later.query) ||
          Equal.equals(later.declaration, setter.declaration),
        `Coalescing '${renderSelector(pull.selector)}' would pull '${name}' across '${renderSelector(crossed.selector)}', which ties on specificity and later diverges from its value — the pull can change the cascade`,
      )
    }
  }
}

/** @internal */
export function coalesce<Vars extends AnyVar>(
  sheet: Stylesheet<Vars>,
  options?: CoalesceOptions,
): Stylesheet<Vars> {
  const strict = options?.strict === true
  const nodes: Array<Node<AnyVar>> = []
  const seen = new Map<
    number,
    Array<{ readonly selector: Selector<Requirement>; readonly index: number }>
  >()
  const pending: Array<PendingPull> = []
  let changed = false
  for (const node of sheet.nodes) {
    if (!isStyleRule(node)) {
      nodes.push(node)
      continue
    }
    const hash = Equal.hash(node.selector)
    const entries = seen.get(hash)
    const first = entries?.find((entry) => Equal.equals(entry.selector, node.selector))
    if (first === undefined) {
      const entry = { selector: node.selector, index: nodes.length }
      if (entries === undefined) {
        seen.set(hash, [entry])
      } else {
        entries.push(entry)
      }
      nodes.push(node)
      continue
    }
    if (strict) {
      collectCrossings(nodes, first.index, node, pending)
    }
    const target = nodes[first.index] as StyleRule<AnyVar>
    nodes[first.index] = makeStyleRule(target.selector, concatBlocks(target.block, node.block))
    changed = true
  }
  for (const pull of pending) {
    requireShadowedPull(pull, nodes)
  }
  return (changed ? new StylesheetImpl(nodes) : sheet) as Stylesheet<Vars>
}

/** @internal */
export function refs<Vars extends AnyVar>(sheet: Stylesheet<Vars>): ReadonlySet<VarName<Vars>> {
  return (sheet as unknown as StylesheetImpl).refSet as ReadonlySet<VarName<Vars>>
}

const propertyRenderOptions = (context: RenderContext): PropertyRenderOptions =>
  context.precision === undefined
    ? { indent: context.indent }
    : { indent: context.indent, precision: context.precision }

/** @internal */
export const render = (sheet: Stylesheet<AnyVar>, options?: RenderOptions): string => {
  const context = resolveRenderOptions(options)
  const sections: Array<string> = []
  for (const node of sheet.nodes) {
    if (isFontFaceRule(node)) {
      sections.push(renderFontFace(node, { indent: context.indent }))
    } else if (isPropertyRule(node)) {
      sections.push(renderPropertyRule(node, propertyRenderOptions(context)))
    } else {
      const section = isMediaRule(node)
        ? renderMediaRuleBlock(node.query, node.block, context)
        : renderStyleRuleBlock(node.selector, node.block, context)
      if (section !== '') {
        sections.push(section)
      }
    }
  }
  return sections.join('\n\n')
}

/** @internal */
export const equals = dual<
  (that: Stylesheet<AnyVar>) => (self: Stylesheet<AnyVar>) => boolean,
  (self: Stylesheet<AnyVar>, that: Stylesheet<AnyVar>) => boolean
>(2, (self: Stylesheet<AnyVar>, that: Stylesheet<AnyVar>): boolean => Equal.equals(self, that))
