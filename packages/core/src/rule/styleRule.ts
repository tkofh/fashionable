import type { Selector } from '#selector/selector'
import type { Pipeable } from '#util'
import type { Var } from '#var'
import type { RenderOptions as RuleSetRenderOptions, RuleSet } from './ruleSet.ts'
import type { StyleRuleTypeId } from './styleRule.internal.ts'
import * as internal from './styleRule.internal.ts'

/**
 * A style rule: a compound selector and the block it applies.
 *
 * The block is a full `RuleSet`, so a style rule holds declarations and
 * nested `@media` rules in one authored order. The `Vars` parameter is
 * the block's — a selector contributes no variable names.
 *
 * Construct via `make`.
 *
 * @since 0.1.0
 */
export interface StyleRule<out Vars extends Var.Any = Var.Any> extends Pipeable {
  readonly [StyleRuleTypeId]: StyleRuleTypeId
  /**
   * The compound selector the block applies to.
   */
  readonly selector: Selector
  /**
   * The rule's block.
   */
  readonly block: RuleSet<Vars>
}

/**
 * Checks if a value is a `StyleRule`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `StyleRule`, `false` otherwise.
 * @since 0.1.0
 */
export const isStyleRule: (u: unknown) => u is StyleRule<Var.Any> = internal.isStyleRule

/**
 * Creates a style rule.
 *
 * @param selector - The compound selector the block applies to.
 * @param block - The rule's block.
 * @returns A `StyleRule` carrying the block's variable names.
 * @example
 * ```ts
 * StyleRule.make(
 *   Selector.root,
 *   RuleSet.make(Declaration.make('--depth', Calc.var('depth'))),
 * ) // StyleRule<'depth'>
 * ```
 * @since 0.1.0
 */
export const make: <Vars extends Var.Any>(
  selector: Selector,
  block: RuleSet<Vars>,
) => StyleRule<Vars> = internal.make

/**
 * The rule's unbound variable names — the block's, since a selector
 * contributes none.
 *
 * @param rule - The rule to inspect.
 * @returns The set of unbound variable names.
 * @since 0.1.0
 */
export const vars: <Vars extends Var.Any>(rule: StyleRule<Vars>) => ReadonlySet<Var.Name<Vars>> =
  internal.refs

/**
 * Options for `render` — the block renderers' shared shape,
 * `RuleSet.RenderOptions`, unchanged.
 *
 * @since 0.1.0
 */
export type RenderOptions = RuleSetRenderOptions

/**
 * Renders the rule in nested form: `selector { ... }`, the body as
 * `RuleSet.render` emits it, one level deeper. A rule whose block is
 * empty renders as the empty string.
 *
 * A fragment renderer: whole sheets render via `Stylesheet.render`,
 * which emits each rule in this same nested shape.
 *
 * @param rule - The rule to render.
 * @param options - Optional indentation unit, precision context, and media syntax.
 * @returns Deterministic CSS text.
 * @throws `Error` when the block nests a style rule — selector composition (`&`) is a later extension, not part of v1 rendering.
 * @example
 * ```ts
 * StyleRule.render(StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--depth', 4))))
 * // ':root {\n\t--depth: 4;\n}'
 * ```
 * @since 0.1.0
 */
export const render: (rule: StyleRule<Var.Any>, options?: RenderOptions) => string = internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The rule to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: StyleRule<Var.Any>): (self: StyleRule<Var.Any>) => boolean
  /**
   * Structural equality: selectors compare as in `Selector.equals`
   * (canonically ordered parts), blocks as in `RuleSet.equals` (members
   * in order).
   *
   * @param self - The first rule.
   * @param that - The second rule.
   * @returns `true` if the rules are structurally equal.
   * @since 0.1.0
   */
  (self: StyleRule<Var.Any>, that: StyleRule<Var.Any>): boolean
} = internal.equals
