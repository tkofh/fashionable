import type {
  Declaration,
  RenderOptions as DeclarationRenderOptions,
} from '#declaration/declaration'
import type { MediaQuery } from '#query/mediaQuery'
import type { Selector } from '#selector/selector'
import type { Pipeable } from '#util'
import type { Var } from '#var'
import type { MediaRule } from './mediaRule.ts'
import type { RuleSetTypeId } from './ruleSet.internal.ts'
import * as internal from './ruleSet.internal.ts'
import type { StyleRule } from './styleRule.ts'

/**
 * An ordered block of rule members — the nesting unit of the rule layer.
 *
 * Member order is preserved exactly as authored: never sorted, never
 * deduplicated. A block's order is cascade behavior, and since
 * CSSNestedDeclarations shipped (late 2024), declarations trailing a
 * nested rule keep their source position rather than hoisting above it —
 * so what you append is what renders.
 *
 * The `Vars` parameter unions the members' unbound variable names, as on
 * `Calc`; `vars` is the runtime set.
 *
 * Construct via `make` (or `empty` and `append`).
 *
 * @since 0.1.0
 */
export interface RuleSet<out Vars extends Var.Any = Var.Any> extends Pipeable {
  readonly [RuleSetTypeId]: RuleSetTypeId
  /**
   * The block's members, in authored order.
   */
  readonly members: ReadonlyArray<Member<Vars>>
}

/**
 * The forms a rule block may contain: declarations, nested style rules,
 * and nested `@media` rules.
 *
 * Deliberately absent are the declaration-block at-rules (`@font-face`,
 * `@property`) — the CSS grammar keeps them at the top level, so this
 * union keeps them out of blocks at the type level.
 *
 * @since 0.1.0
 */
export type Member<Vars extends Var.Any = Var.Any> =
  | Declaration<Vars>
  | StyleRule<Vars>
  | MediaRule<Vars>

/**
 * The unbound variable names of a `Member`, or the union of them for a
 * union of members — the type-level counterpart of `vars`, used by the
 * container constructors to thread their members' names into the result.
 *
 * @since 0.1.0
 */
export type MemberVars<M extends Member<Var.Any>> =
  M extends Declaration<infer R>
    ? R
    : M extends StyleRule<infer R>
      ? R
      : M extends MediaRule<infer R>
        ? R
        : never

/**
 * Checks if a value is a `RuleSet`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `RuleSet`, `false` otherwise.
 * @since 0.1.0
 */
export const isRuleSet: (u: unknown) => u is RuleSet<Var.Any> = internal.isRuleSet

/**
 * The empty block — the identity for `concat`.
 *
 * @since 0.1.0
 */
export const empty: RuleSet<never> = internal.empty

/**
 * Checks if the block has no members.
 *
 * Structural emptiness only: a non-empty block can still *render* as the
 * empty string, when every member is a nested rule whose block renders
 * empty.
 *
 * @param set - The block to inspect.
 * @returns `true` if the block has no members.
 * @since 0.2.0
 */
export const isEmpty: (set: RuleSet<Var.Any>) => boolean = internal.isEmpty

/**
 * Creates a rule set holding the given members, in the given order.
 *
 * @param members - Declarations and nested rules, in authored order.
 * @returns A `RuleSet` whose `Vars` unions the members' variable names.
 * @example
 * ```ts
 * const block = RuleSet.make(
 *   Declaration.make('--depth', Calc.var('depth')),
 *   Declaration.make('color', 'oklch(0.7 0.1 250)'),
 * ) // RuleSet<'depth'>
 * ```
 * @since 0.1.0
 */
export const make: <Members extends ReadonlyArray<Member<Var.Any>>>(
  ...members: Members
) => RuleSet<MemberVars<Members[number]>> = internal.make

export const append: {
  /**
   * Returns a function that appends `member` to its argument's block.
   *
   * @param member - The member to append.
   * @returns A function producing the extended block.
   * @since 0.1.0
   */
  <M extends Member<Var.Any>>(
    member: M,
  ): <Vars extends Var.Any>(self: RuleSet<Vars>) => RuleSet<Vars | MemberVars<M>>
  /**
   * Returns a function that appends the style rule `selector { block }`
   * to its argument's block.
   *
   * @param selector - The nested rule's selector.
   * @param block - The nested rule's block.
   * @returns A function producing the extended block.
   * @since 0.1.0
   */
  <B extends Var.Any>(
    selector: Selector,
    block: RuleSet<B>,
  ): <Vars extends Var.Any>(self: RuleSet<Vars>) => RuleSet<Vars | B>
  /**
   * Returns a function that appends the media rule `@media query { block }`
   * to its argument's block.
   *
   * @param query - The nested rule's media query.
   * @param block - The nested rule's block.
   * @returns A function producing the extended block.
   * @since 0.1.0
   */
  <B extends Var.Any>(
    query: MediaQuery,
    block: RuleSet<B>,
  ): <Vars extends Var.Any>(self: RuleSet<Vars>) => RuleSet<Vars | B>
  /**
   * Appends a member at the end of the block. The result is a new set;
   * the original is untouched.
   *
   * @param self - The block to extend.
   * @param member - The member to append.
   * @returns The extended block, with the member's variable names joined in.
   * @example
   * ```ts
   * RuleSet.empty.pipe(
   *   RuleSet.append(Declaration.make('color', 'red')),
   *   RuleSet.append(Declaration.make('--depth', Calc.var('depth'))),
   * ) // RuleSet<'depth'>
   * ```
   * @since 0.1.0
   */
  <Vars extends Var.Any, M extends Member<Var.Any>>(
    self: RuleSet<Vars>,
    member: M,
  ): RuleSet<Vars | MemberVars<M>>
  /**
   * Appends a nested style rule from its parts — sugar for
   * `append(self, StyleRule.make(selector, block))`, so blocks compose
   * without naming `StyleRule` at the call site.
   *
   * @param self - The block to extend.
   * @param selector - The nested rule's selector.
   * @param block - The nested rule's block.
   * @returns The extended block, with the nested block's variable names joined in.
   * @example
   * ```ts
   * RuleSet.empty.pipe(RuleSet.append(Selector.class('btn'), RuleSet.make(Declaration.make('color', 'red'))))
   * ```
   * @since 0.1.0
   */
  <Vars extends Var.Any, B extends Var.Any>(
    self: RuleSet<Vars>,
    selector: Selector,
    block: RuleSet<B>,
  ): RuleSet<Vars | B>
  /**
   * Appends a nested media rule from its parts — sugar for
   * `append(self, MediaRule.make(query, block))`, so blocks compose
   * without naming `MediaRule` at the call site.
   *
   * @param self - The block to extend.
   * @param query - The nested rule's media query.
   * @param block - The nested rule's block.
   * @returns The extended block, with the nested block's variable names joined in.
   * @example
   * ```ts
   * RuleSet.make(Declaration.make('--gutter', 16)).pipe(
   *   RuleSet.append(MediaQuery.minWidth(768), RuleSet.make(Declaration.make('--gutter', 24))),
   * )
   * ```
   * @since 0.1.0
   */
  <Vars extends Var.Any, B extends Var.Any>(
    self: RuleSet<Vars>,
    query: MediaQuery,
    block: RuleSet<B>,
  ): RuleSet<Vars | B>
} = internal.append

export const concat: {
  /**
   * Returns a function that appends `that`'s members after its argument's.
   *
   * @param that - The block whose members come second.
   * @returns A function producing the concatenated block.
   * @since 0.1.0
   */
  <B extends Var.Any>(that: RuleSet<B>): <A extends Var.Any>(self: RuleSet<A>) => RuleSet<A | B>
  /**
   * Concatenates two blocks: `self`'s members followed by `that`'s, order
   * preserved on both sides. No deduplication happens here — repeated
   * declarations are legal CSS and their repetition is cascade behavior.
   *
   * @param self - The block whose members come first.
   * @param that - The block whose members come second.
   * @returns The concatenated block, with both sides' variable names unioned.
   * @since 0.1.0
   */
  <A extends Var.Any, B extends Var.Any>(self: RuleSet<A>, that: RuleSet<B>): RuleSet<A | B>
} = internal.concat

export const forSelector: {
  /**
   * Returns a function that wraps its argument as the block of a style
   * rule applying to `selector`.
   *
   * @param selector - The selector the resulting rule's block applies to.
   * @returns A function that takes a block and returns the style rule applying it to `selector`.
   * @since 0.2.0
   */
  (selector: Selector): <Vars extends Var.Any>(self: RuleSet<Vars>) => StyleRule<Vars>
  /**
   * Lifts a block into a style rule applying to `selector` — sugar for
   * `StyleRule.make(selector, self)` with the arguments flipped, so a
   * block built up through `pipe` caps off as a rule without naming
   * `StyleRule` at the call site. The rule carries the block's variable
   * names unchanged; a selector contributes none.
   *
   * @param self - The block the rule applies.
   * @param selector - The selector the block applies to.
   * @returns The style rule pairing `selector` with the block.
   * @example
   * ```ts
   * RuleSet.make(Declaration.make('--depth', Calc.var('depth'))).pipe(
   *   RuleSet.forSelector(Selector.root),
   * ) // StyleRule<'depth'>
   * ```
   * @since 0.2.0
   */
  <Vars extends Var.Any>(self: RuleSet<Vars>, selector: Selector): StyleRule<Vars>
} = internal.forSelector

export const forMediaQuery: {
  /**
   * Returns a function that wraps its argument as the block of a nested
   * `@media` rule gated by `query`.
   *
   * @param query - The media query gating the resulting rule's block.
   * @returns A function that takes a block and returns the media rule gating it by `query`.
   * @since 0.2.0
   */
  (query: MediaQuery): <Vars extends Var.Any>(self: RuleSet<Vars>) => MediaRule<Vars>
  /**
   * Lifts a block into a nested `@media` rule gated by `query` — sugar
   * for `MediaRule.make(query, self)` with the arguments flipped, so a
   * block built up through `pipe` caps off as a rule without naming
   * `MediaRule` at the call site. The rule carries the block's variable
   * names unchanged; a query contributes none.
   *
   * @param self - The block the rule gates.
   * @param query - The media query gating the block.
   * @returns The media rule pairing `query` with the block.
   * @example
   * ```ts
   * RuleSet.make(Declaration.make('--gutter', Calc.var('gutter'))).pipe(
   *   RuleSet.forMediaQuery(MediaQuery.minWidth(768)),
   * ) // MediaRule<'gutter'>
   * ```
   * @since 0.2.0
   */
  <Vars extends Var.Any>(self: RuleSet<Vars>, query: MediaQuery): MediaRule<Vars>
} = internal.forMediaQuery

/**
 * The block's unbound variable names, unioned across members —
 * including everything nested rules contribute.
 *
 * @param set - The block to inspect.
 * @returns The set of unbound variable names.
 * @since 0.1.0
 */
export const vars: <Vars extends Var.Any>(set: RuleSet<Vars>) => ReadonlySet<Var.Name<Vars>> =
  internal.refs

/**
 * Options for `render`, extending `Declaration.RenderOptions` (and
 * through it the family base, `MediaQuery.RenderOptions`) with the
 * indentation unit — the block renderers' shared shape, which
 * `StyleRule.render` and `MediaRule.render` take unchanged.
 *
 * @since 0.1.0
 */
export interface RenderOptions extends DeclarationRenderOptions {
  /**
   * The indentation unit, applied once per nesting level. Defaults to a
   * tab.
   */
  readonly indent?: string
}

/**
 * Renders the block's body — the text between a rule's braces, without
 * the braces: one line per declaration, nested `@media` rules as
 * indented sub-blocks, in member order. Empty blocks (and nested rules
 * whose blocks are empty) render as the empty string.
 *
 * A fragment renderer: use it to compose blocks the model does not
 * represent. Whole sheets render via `Stylesheet.render`.
 *
 * @param set - The block to render.
 * @param options - Optional indentation unit, precision context, and media syntax.
 * @returns Deterministic CSS text.
 * @throws `Error` when the block nests a style rule — selector composition (`&`) is a later extension, not part of v1 rendering.
 * @example
 * ```ts
 * RuleSet.render(RuleSet.make(Declaration.make('--depth', 4), Declaration.make('color', 'red')))
 * // '--depth: 4;\ncolor: red;'
 * ```
 * @since 0.1.0
 */
export const render: (set: RuleSet<Var.Any>, options?: RenderOptions) => string = internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The block to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: RuleSet<Var.Any>): (self: RuleSet<Var.Any>) => boolean
  /**
   * Structural equality over members, in order. Order participates —
   * `make(a, b)` and `make(b, a)` are different blocks, because they
   * cascade differently.
   *
   * @param self - The first block.
   * @param that - The second block.
   * @returns `true` if the blocks are structurally equal.
   * @since 0.1.0
   */
  (self: RuleSet<Var.Any>, that: RuleSet<Var.Any>): boolean
} = internal.equals
