/**
 * Shared plumbing for the three mutually recursive rule types: the
 * cross-type ref accessors and the nested-form block renderer. The
 * per-type internals import from here, and never from each other — with
 * one sanctioned exception: `ruleSet.internal.ts` imports the StyleRule
 * and MediaRule constructors for its pair-form `append` overloads. That
 * import is one-directional (neither per-type internal imports the rule
 * set's), so the recursion stays in the types and out of the module
 * graph. Members are discriminated structurally here (`'query' in
 * member`) for the same reason: importing the per-type guards would
 * close the cycle.
 */

import type { Precision } from '../calc/precision.ts'
import {
  isDeclaration,
  refsOf as declarationRefsOf,
  renderWith as renderDeclaration,
} from '../declaration/declaration.internal.ts'
import { DEFAULT_INDENT } from '../internal/render.ts'
import { render as renderQuery } from '../query/mediaQuery.internal.ts'
import type { MediaQuery } from '../query/mediaQuery.ts'
import { render as renderSelector } from '../selector/selector.internal.ts'
import type { Selector } from '../selector/selector.ts'
import { invariant } from '../utils.ts'
import type { MediaRule } from './mediaRule.ts'
import type { Member, RuleSet } from './ruleSet.ts'
import type { StyleRule } from './styleRule.ts'

/** @internal */
export const refSetOf = (
  value: RuleSet<string> | StyleRule<string> | MediaRule<string>,
): ReadonlySet<string> => (value as unknown as { readonly refSet: ReadonlySet<string> }).refSet

/** @internal */
export const memberRefs = (member: Member<string>): ReadonlySet<string> =>
  isDeclaration(member) ? declarationRefsOf(member) : refSetOf(member)

/** @internal */
export interface RenderContext {
  readonly indent: string
  readonly precision: Precision | undefined
  readonly mediaSyntax: 'prefix' | 'range'
}

/** @internal */
export const resolveRenderOptions = (options?: {
  readonly indent?: string
  readonly precision?: Precision
  readonly mediaSyntax?: 'prefix' | 'range'
}): RenderContext => ({
  indent: options?.indent ?? DEFAULT_INDENT,
  precision: options?.precision,
  mediaSyntax: options?.mediaSyntax ?? 'prefix',
})

/** @internal */
export const requireMediaRule = (
  member: StyleRule<string> | MediaRule<string>,
): MediaRule<string> => {
  invariant(
    'query' in member,
    'A nested style rule has no v1 rendering — selector composition is a later extension; lift the rule to the top level of the stylesheet',
  )
  return member
}

/**
 * The nested-form body of a block: one line per declaration, nested
 * media rules as indented `@media` sub-blocks, in member order. Empty
 * blocks contribute nothing.
 *
 * @internal
 */
export const blockBodyLines = (
  block: RuleSet<string>,
  depth: number,
  context: RenderContext,
): Array<string> => {
  const pad = context.indent.repeat(depth)
  const lines: Array<string> = []
  for (const member of block.members) {
    if (isDeclaration(member)) {
      lines.push(`${pad}${renderDeclaration(member, context.precision)}`)
      continue
    }
    const media = requireMediaRule(member)
    const inner = blockBodyLines(media.block, depth + 1, context)
    if (inner.length > 0) {
      const prelude = renderQuery(media.query, { mediaSyntax: context.mediaSyntax })
      lines.push(`${pad}@media ${prelude} {`, ...inner, `${pad}}`)
    }
  }
  return lines
}

/** @internal */
export const renderStyleRuleBlock = (
  selector: Selector,
  block: RuleSet<string>,
  context: RenderContext,
): string => {
  const lines = blockBodyLines(block, 1, context)
  return lines.length === 0 ? '' : `${renderSelector(selector)} {\n${lines.join('\n')}\n}`
}

/** @internal */
export const renderMediaRuleBlock = (
  query: MediaQuery,
  block: RuleSet<string>,
  context: RenderContext,
): string => {
  const lines = blockBodyLines(block, 1, context)
  if (lines.length === 0) {
    return ''
  }
  const prelude = renderQuery(query, { mediaSyntax: context.mediaSyntax })
  return `@media ${prelude} {\n${lines.join('\n')}\n}`
}
