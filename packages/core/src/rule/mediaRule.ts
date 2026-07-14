import type { MediaQuery } from '../query/mediaQuery.ts'
import type { Pipeable } from '../utils.ts'
import type { MediaRuleTypeId } from './mediaRule.internal.ts'
import * as internal from './mediaRule.internal.ts'
import type { RenderOptions as RuleSetRenderOptions, RuleSet } from './ruleSet.ts'

/**
 * A nested `@media` rule: a media query and the block it gates.
 *
 * This is the nested form — a member of an enclosing style rule's block,
 * per the CSSNestedDeclarations grammar — not a top-level `@media`
 * statement. Media enters the model inside a style rule
 * (`:root { @media ... { ... } }`); a flat renderer distributes the
 * enclosing selector to emit traditional top-level blocks. The `Refs`
 * parameter is the block's.
 *
 * Construct via `make`.
 *
 * @since 0.1.0
 */
export interface MediaRule<out Refs extends string = string> extends Pipeable {
  readonly [MediaRuleTypeId]: MediaRuleTypeId
  /**
   * The media query gating the block.
   */
  readonly query: MediaQuery
  /**
   * The rule's block.
   */
  readonly block: RuleSet<Refs>
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
export const isMediaRule: (u: unknown) => u is MediaRule<string> = internal.isMediaRule

/**
 * Creates a nested `@media` rule.
 *
 * @param query - The media query gating the block.
 * @param block - The rule's block.
 * @returns A `MediaRule` carrying the block's reference names.
 * @example
 * ```ts
 * MediaRule.make(
 *   MediaQuery.prefersColorScheme('dark'),
 *   RuleSet.make(Declaration.make('--scheme', 'dark')),
 * )
 * ```
 * @since 0.1.0
 */
export const make: <Refs extends string>(
  query: MediaQuery,
  block: RuleSet<Refs>,
) => MediaRule<Refs> = internal.make

/**
 * The rule's unbound reference names — the block's, since a query
 * contributes none.
 *
 * @param rule - The rule to inspect.
 * @returns The set of unbound reference names.
 * @since 0.1.0
 */
export const refs: <Refs extends string>(rule: MediaRule<Refs>) => ReadonlySet<Refs> = internal.refs

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
 * whose flat projection instead distributes the query out to top-level
 * `@media selector { ... }` blocks.
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
export const render: (rule: MediaRule<string>, options?: RenderOptions) => string = internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The rule to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: MediaRule<string>): (self: MediaRule<string>) => boolean
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
  (self: MediaRule<string>, that: MediaRule<string>): boolean
} = internal.equals
