import type { MediaQuery } from '#query/mediaQuery'
import type { Pipeable } from '#util'
import type { Var } from '#var'
import type { MediaRuleTypeId } from './mediaRule.internal.ts'
import * as internal from './mediaRule.internal.ts'
import type { RenderOptions as RuleSetRenderOptions, RuleSet } from './ruleSet.ts'

/**
 * A nested `@media` rule: a media query and the block it gates.
 *
 * This is the nested form — a member of an enclosing style rule's block,
 * per the CSSNestedDeclarations grammar — not a top-level `@media`
 * statement. Media enters the model inside a style rule
 * (`:root { @media ... { ... } }`) and renders there, nested. The `Vars`
 * parameter is the block's.
 *
 * Construct via `make`.
 *
 * @since 0.1.0
 */
export interface MediaRule<out Vars extends Var.Any = Var.Any> extends Pipeable {
  readonly [MediaRuleTypeId]: MediaRuleTypeId
  /**
   * The media query gating the block.
   */
  readonly query: MediaQuery
  /**
   * The rule's block.
   */
  readonly block: RuleSet<Vars>
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
 * Creates a nested `@media` rule.
 *
 * @param query - The media query gating the block.
 * @param block - The rule's block.
 * @returns A `MediaRule` carrying the block's variable names.
 * @example
 * ```ts
 * MediaRule.make(
 *   MediaQuery.prefersColorScheme('dark'),
 *   RuleSet.make(Declaration.make('--scheme', 'dark')),
 * )
 * ```
 * @since 0.1.0
 */
export const make: <Vars extends Var.Any>(
  query: MediaQuery,
  block: RuleSet<Vars>,
) => MediaRule<Vars> = internal.make

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
 * A fragment renderer: whole sheets render via `Stylesheet.render`,
 * which emits each rule's media in this same nested shape.
 *
 * @param rule - The rule to render.
 * @param options - Optional indentation unit, precision context, and media syntax.
 * @returns Deterministic CSS text.
 * @throws `Error` when the block nests a style rule — selector composition (`&`) is a later extension, not part of v1 rendering.
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
