import {
  isDeclaration,
  renderWith as renderDeclaration,
} from '#declaration/declaration.internal'
import { isFontFaceRule, render as renderFontFace } from '#fontFace/fontFaceRule.internal'
import * as Equal from '#internal/equal'
import { EMPTY_REFS, unionRefs } from '#internal/refs'
import { isPropertyRule, render as renderPropertyRule } from '#property/propertyRule.internal'
import type { RenderOptions as PropertyRenderOptions } from '#property/propertyRule'
import { and as andQuery, render as renderQuery } from '#query/mediaQuery.internal'
import type { MediaQuery } from '#query/mediaQuery'
import {
  refSetOf,
  type RenderContext,
  renderStyleRuleBlock,
  requireMediaRule,
  resolveRenderOptions,
} from '#rule/rule.internal'
import { concat as concatBlocks } from '#rule/ruleSet.internal'
import type { RuleSet } from '#rule/ruleSet'
import { isStyleRule, make as makeStyleRule } from '#rule/styleRule.internal'
import type { StyleRule } from '#rule/styleRule'
import { render as renderSelector } from '#selector/selector.internal'
import type { Selector } from '#selector/selector'
import { dual, Pipeable } from '#util'
import type { Node, NodeRefs, RenderOptions, Stylesheet } from './stylesheet.ts'

export const StylesheetTypeId = Symbol.for('fashionable/stylesheet')
export type StylesheetTypeId = typeof StylesheetTypeId

const nodeRefs = (node: Node<string>): ReadonlySet<string> =>
  isStyleRule(node) ? refSetOf(node) : EMPTY_REFS

class StylesheetImpl extends Pipeable implements Stylesheet<string>, Equal.Equal {
  readonly [StylesheetTypeId]: StylesheetTypeId = StylesheetTypeId

  readonly nodes: ReadonlyArray<Node<string>>
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(nodes: ReadonlyArray<Node<string>>) {
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
export const isStylesheet = (u: unknown): u is Stylesheet<string> =>
  typeof u === 'object' && u !== null && StylesheetTypeId in u

const appendDistinct = (
  kept: Array<Node<string>>,
  buckets: Map<number, Array<Node<string>>>,
  node: Node<string>,
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

const distinct = (nodes: ReadonlyArray<Node<string>>): Array<Node<string>> => {
  const kept: Array<Node<string>> = []
  const buckets = new Map<number, Array<Node<string>>>()
  for (const node of nodes) {
    appendDistinct(kept, buckets, node)
  }
  return kept
}

/** @internal */
export const empty: Stylesheet<never> = new StylesheetImpl([]) as unknown as Stylesheet<never>

/** @internal */
export function make<Nodes extends ReadonlyArray<Node<string>>>(
  ...nodes: Nodes
): Stylesheet<NodeRefs<Nodes[number]>> {
  const kept = distinct(nodes)
  return (kept.length === 0 ? empty : new StylesheetImpl(kept)) as Stylesheet<
    NodeRefs<Nodes[number]>
  >
}

const resolveNode = (head: unknown, block: unknown): Node<string> =>
  block === undefined
    ? (head as Node<string>)
    : makeStyleRule(head as Selector, block as RuleSet<string>)

/** @internal */
export const append: {
  <N extends Node<string>>(
    node: N,
  ): <Refs extends string>(self: Stylesheet<Refs>) => Stylesheet<Refs | NodeRefs<N>>
  <B extends string>(
    selector: Selector,
    block: RuleSet<B>,
  ): <Refs extends string>(self: Stylesheet<Refs>) => Stylesheet<Refs | B>
  <Refs extends string, N extends Node<string>>(
    self: Stylesheet<Refs>,
    node: N,
  ): Stylesheet<Refs | NodeRefs<N>>
  <Refs extends string, B extends string>(
    self: Stylesheet<Refs>,
    selector: Selector,
    block: RuleSet<B>,
  ): Stylesheet<Refs | B>
} = dual(
  (args: IArguments) => isStylesheet(args[0]),
  (self: Stylesheet<string>, head: unknown, block?: unknown): Stylesheet<string> => {
    const node = resolveNode(head, block)
    if (self.nodes.some((existing) => Equal.equals(existing, node))) {
      return self
    }
    return new StylesheetImpl([...self.nodes, node])
  },
)

/** @internal */
export const merge: {
  <B extends string>(
    that: Stylesheet<B>,
  ): <A extends string>(self: Stylesheet<A>) => Stylesheet<A | B>
  <A extends string, B extends string>(self: Stylesheet<A>, that: Stylesheet<B>): Stylesheet<A | B>
} = dual(2, (self: Stylesheet<string>, that: Stylesheet<string>): Stylesheet<string> => {
  if (that.nodes.length === 0) {
    return self
  }
  if (self.nodes.length === 0) {
    return that
  }
  const kept: Array<Node<string>> = []
  const buckets = new Map<number, Array<Node<string>>>()
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
export function mergeAll<Refs extends string>(
  sheets: ReadonlyArray<Stylesheet<Refs>>,
): Stylesheet<Refs> {
  let merged: Stylesheet<string> = empty
  for (const sheet of sheets) {
    merged = merge(merged, sheet)
  }
  return merged as Stylesheet<Refs>
}

/** @internal */
export function coalesce<Refs extends string>(sheet: Stylesheet<Refs>): Stylesheet<Refs> {
  const nodes: Array<Node<string>> = []
  const seen = new Map<number, Array<{ readonly selector: Selector; readonly index: number }>>()
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
    const target = nodes[first.index] as StyleRule<string>
    nodes[first.index] = makeStyleRule(target.selector, concatBlocks(target.block, node.block))
    changed = true
  }
  return (changed ? new StylesheetImpl(nodes) : sheet) as Stylesheet<Refs>
}

/** @internal */
export function refs<Refs extends string>(sheet: Stylesheet<Refs>): ReadonlySet<Refs> {
  return (sheet as unknown as StylesheetImpl).refSet as ReadonlySet<Refs>
}

const propertyRenderOptions = (context: RenderContext): PropertyRenderOptions =>
  context.precision === undefined
    ? { indent: context.indent }
    : { indent: context.indent, precision: context.precision }

const flatBlock = (
  selector: string,
  query: MediaQuery | undefined,
  lines: ReadonlyArray<string>,
  context: RenderContext,
): string => {
  if (query === undefined) {
    const inner = lines.map((line) => `${context.indent}${line}`).join('\n')
    return `${selector} {\n${inner}\n}`
  }
  const inner = lines.map((line) => `${context.indent}${context.indent}${line}`).join('\n')
  const prelude = renderQuery(query, { mediaSyntax: context.mediaSyntax })
  return `@media ${prelude} {\n${context.indent}${selector} {\n${inner}\n${context.indent}}\n}`
}

const flatStyleRule = (
  selector: string,
  query: MediaQuery | undefined,
  block: RuleSet<string>,
  context: RenderContext,
  sections: Array<string>,
): void => {
  let run: Array<string> = []
  const flush = (): void => {
    if (run.length > 0) {
      sections.push(flatBlock(selector, query, run, context))
      run = []
    }
  }
  for (const member of block.members) {
    if (isDeclaration(member)) {
      run.push(renderDeclaration(member, context.precision))
      continue
    }
    const media = requireMediaRule(member)
    flush()
    flatStyleRule(
      selector,
      query === undefined ? media.query : andQuery(query, media.query),
      media.block,
      context,
      sections,
    )
  }
  flush()
}

/** @internal */
export const render = (sheet: Stylesheet<string>, options?: RenderOptions): string => {
  const context = resolveRenderOptions(options)
  const format = options?.format ?? 'flat'
  const sections: Array<string> = []
  for (const node of sheet.nodes) {
    if (isFontFaceRule(node)) {
      sections.push(renderFontFace(node, { indent: context.indent }))
    } else if (isPropertyRule(node)) {
      sections.push(renderPropertyRule(node, propertyRenderOptions(context)))
    } else if (format === 'flat') {
      flatStyleRule(renderSelector(node.selector), undefined, node.block, context, sections)
    } else {
      const section = renderStyleRuleBlock(node.selector, node.block, context)
      if (section !== '') {
        sections.push(section)
      }
    }
  }
  return sections.join('\n\n')
}

/** @internal */
export const equals = dual<
  (that: Stylesheet<string>) => (self: Stylesheet<string>) => boolean,
  (self: Stylesheet<string>, that: Stylesheet<string>) => boolean
>(2, (self: Stylesheet<string>, that: Stylesheet<string>): boolean => Equal.equals(self, that))
