import type { MediaQuery } from '#query/mediaQuery'
import type { Requirement } from '#selector/selector'
import type { Pipeable } from '#util'
import type { Var } from '#var'
import type { MediaRuleTypeId } from './mediaRule.internal.ts'
import * as internal from './mediaRule.internal.ts'
import type { RenderOptions as RuleSetRenderOptions, RuleSet } from './ruleSet.ts'

/**
 * A `@media` rule: a media query and the block it gates.
 *
 * The usual position is nested — a member of an enclosing style rule's
 * block, holding declarations that apply to that rule's selector, per
 * the CSSNestedDeclarations grammar. A media rule whose block holds only
 * closed style rules may instead sit at a stylesheet's top level, the
 * authored `@media { selector { ... } }` grouping. The `Vars` parameter
 * is the block's.
 *
 * `Requires` is the block's too — a media rule has no selector of its
 * own, so it is transparent to the requirements channel. Bare
 * declarations put `Parent` in the block's requirements, which is what
 * confines a declaration-bearing media rule to nested position:
 * `Stylesheet`'s node union takes `MediaRule<Vars, never>`.
 *
 * Construct via `make`.
 *
 * @since 0.1.0
 */
export interface MediaRule<
  out Vars extends Var.Any = Var.Any,
  out Requires extends Requirement = Requirement,
> extends Pipeable {
  readonly [MediaRuleTypeId]: MediaRuleTypeId
  /**
   * The media query gating the block.
   */
  readonly query: MediaQuery
  /**
   * The rule's block.
   */
  readonly block: RuleSet<Vars, Requires>
}

/**
 * Checks if a value is a `MediaRule`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `MediaRule`, `false` otherwise.
 * @since 0.1.0
 */
export const isMediaRule: (u: unknown) => u is MediaRule<Var.Any> = internal.isMediaRule

/**
 * Creates a `@media` rule.
 *
 * @param query - The media query gating the block.
 * @param block - The rule's block. Declarations make the rule nested-only; a block of closed style rules makes it top-level-capable.
 * @returns A `MediaRule` carrying the block's variable names and requirements.
 * @example
 * ```ts
 * MediaRule.make(
 *   MediaQuery.prefersColorScheme('dark'),
 *   RuleSet.make(Declaration.make('--scheme', 'dark')),
 * )
 * ```
 * @since 0.1.0
 */
export const make: <Vars extends Var.Any, Requires extends Requirement>(
  query: MediaQuery,
  block: RuleSet<Vars, Requires>,
) => MediaRule<Vars, Requires> = internal.make

/**
 * The rule's unbound variable names — the block's, since a query
 * contributes none.
 *
 * @param rule - The rule to inspect.
 * @returns The set of unbound variable names.
 * @since 0.1.0
 */
export const vars: <Vars extends Var.Any>(rule: MediaRule<Vars>) => ReadonlySet<Var.Name<Vars>> =
  internal.refs

/**
 * Options for `render` — the block renderers' shared shape,
 * `RuleSet.RenderOptions`, unchanged.
 *
 * @since 0.1.0
 */
export type RenderOptions = RuleSetRenderOptions

/**
 * Renders the rule in nested form: `@media query { ... }`, the body as
 * `RuleSet.render` emits it, one level deeper — declarations directly
 * inside the query block, the shape a media rule takes nested in a
 * style rule (CSSNestedDeclarations). A rule whose block is empty
 * renders as the empty string.
 *
 * Nested style rules render as indented sub-blocks with `&` kept
 * verbatim — native CSS nesting is the output shape.
 *
 * A fragment renderer: whole sheets render via `Stylesheet.render`,
 * which emits each rule's media in this same nested shape.
 *
 * @param rule - The rule to render.
 * @param options - Optional indentation unit, precision context, and media syntax.
 * @returns Deterministic CSS text.
 * @example
 * ```ts
 * MediaRule.render(
 *   MediaRule.make(MediaQuery.minWidth(768), RuleSet.make(Declaration.make('--gutter', 24))),
 * ) // '@media (min-width: 768px) {\n\t--gutter: 24;\n}'
 * ```
 * @since 0.1.0
 */
export const render: (rule: MediaRule<Var.Any>, options?: RenderOptions) => string = internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The rule to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: MediaRule<Var.Any>): (self: MediaRule<Var.Any>) => boolean
  /**
   * Structural equality: queries compare as in `MediaQuery.equals`
   * (canonically ordered features), blocks as in `RuleSet.equals`
   * (members in order).
   *
   * @param self - The first rule.
   * @param that - The second rule.
   * @returns `true` if the rules are structurally equal.
   * @since 0.1.0
   */
  (self: MediaRule<Var.Any>, that: MediaRule<Var.Any>): boolean
} = internal.equals
