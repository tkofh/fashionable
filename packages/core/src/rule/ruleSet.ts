import type {
  Declaration,
  RenderOptions as DeclarationRenderOptions,
} from '#declaration/declaration'
import type { MediaQuery } from '#query/mediaQuery'
import type { Parent, Requirement, Selector } from '#selector/selector'
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
 * The `Requires` parameter unions the members' context requirements
 * (`Selector.Requirement`, section 4.4 of `docs/design.md`): `Parent`
 * from every bare declaration and from every nested rule whose selector
 * references `&`. A style rule discharges its block's requirements
 * against its own selector; a block of closed style rules and nothing
 * else is `RuleSet<Vars, never>`, the only form a top-level `@media`
 * block may take.
 *
 * Construct via `make` (or `empty` and `append`).
 *
 * @since 0.1.0
 */
export interface RuleSet<
  out Vars extends Var.Any = Var.Any,
  out Requires extends Requirement = Requirement,
> extends Pipeable {
  readonly [RuleSetTypeId]: RuleSetTypeId
  /**
   * The block's members, in authored order.
   */
  readonly members: ReadonlyArray<Member<Vars, Requires>>
}

/**
 * The forms a rule block may contain: declarations, nested style rules,
 * and nested `@media` rules. `Requires` bounds the rule arms'
 * requirements; `MemberRequires` computes a member's contribution.
 *
 * Deliberately absent are the declaration-block at-rules (`@font-face`,
 * `@property`) — the CSS grammar keeps them at the top level, so this
 * union keeps them out of blocks at the type level.
 *
 * @since 0.1.0
 */
export type Member<Vars extends Var.Any = Var.Any, Requires extends Requirement = Requirement> =
  | Declaration<Vars>
  | StyleRule<Vars, Requires>
  | MediaRule<Vars, Requires>

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
    : M extends StyleRule<infer R, Requirement>
      ? R
      : M extends MediaRule<infer R, Requirement>
        ? R
        : never

/**
 * The requirement contribution of a `Member`, or the union of them for a
 * union of members — the type-level counterpart of the containers'
 * `Requires` parameter, used by the constructors to thread member
 * requirements into the result.
 *
 * A bare declaration contributes `Parent`: without a host selector it
 * has no subject. A style rule contributes its selector's requirements —
 * its block's are its own to discharge. A media rule is transparent and
 * contributes its block's.
 *
 * @since 0.4.0
 */
export type MemberRequires<M extends Member<Var.Any>> =
  M extends Declaration<Var.Any>
    ? Parent
    : M extends StyleRule<Var.Any, infer R>
      ? R
      : M extends MediaRule<Var.Any, infer R>
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
export const empty: RuleSet<never, never> = internal.empty

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
 * @returns A `RuleSet` whose `Vars` unions the members' variable names and whose `Requires` unions their requirement contributions.
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
) => RuleSet<MemberVars<Members[number]>, MemberRequires<Members[number]>> = internal.make

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
  ): <Vars extends Var.Any, Requires extends Requirement>(
    self: RuleSet<Vars, Requires>,
  ) => RuleSet<Vars | MemberVars<M>, Requires | MemberRequires<M>>
  /**
   * Returns a function that appends the style rule `selector { block }`
   * to its argument's block.
   *
   * @param selector - The nested rule's selector. Must reference `&` by the time an enclosing rule binds the block.
   * @param block - The nested rule's block.
   * @returns A function producing the extended block.
   * @since 0.1.0
   */
  <B extends Var.Any, S extends Requirement>(
    selector: Selector<S>,
    block: RuleSet<B>,
  ): <Vars extends Var.Any, Requires extends Requirement>(
    self: RuleSet<Vars, Requires>,
  ) => RuleSet<Vars | B, Requires | S>
  /**
   * Returns a function that appends the media rule `@media query { block }`
   * to its argument's block.
   *
   * @param query - The nested rule's media query.
   * @param block - The nested rule's block.
   * @returns A function producing the extended block.
   * @since 0.1.0
   */
  <B extends Var.Any, BR extends Requirement>(
    query: MediaQuery,
    block: RuleSet<B, BR>,
  ): <Vars extends Var.Any, Requires extends Requirement>(
    self: RuleSet<Vars, Requires>,
  ) => RuleSet<Vars | B, Requires | BR>
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
  <Vars extends Var.Any, Requires extends Requirement, M extends Member<Var.Any>>(
    self: RuleSet<Vars, Requires>,
    member: M,
  ): RuleSet<Vars | MemberVars<M>, Requires | MemberRequires<M>>
  /**
   * Appends a nested style rule from its parts — sugar for
   * `append(self, StyleRule.make(selector, block))`, so blocks compose
   * without naming `StyleRule` at the call site.
   *
   * The nested rule's selector must reference `&` (`Selector.nest`) by
   * the time an enclosing rule binds this block — `StyleRule.make`
   * enforces it there, as the binder.
   *
   * @param self - The block to extend.
   * @param selector - The nested rule's selector.
   * @param block - The nested rule's block.
   * @returns The extended block, with the nested block's variable names joined in.
   * @throws `Error` when a style rule nested in `block` has a selector that does not reference `&`.
   * @example
   * ```ts
   * RuleSet.empty.pipe(
   *   RuleSet.append(
   *     Selector.and(Selector.nest, Selector.pseudoClass('hover')),
   *     RuleSet.make(Declaration.make('color', 'red')),
   *   ),
   * )
   * ```
   * @since 0.1.0
   */
  <Vars extends Var.Any, Requires extends Requirement, B extends Var.Any, S extends Requirement>(
    self: RuleSet<Vars, Requires>,
    selector: Selector<S>,
    block: RuleSet<B>,
  ): RuleSet<Vars | B, Requires | S>
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
  <Vars extends Var.Any, Requires extends Requirement, B extends Var.Any, BR extends Requirement>(
    self: RuleSet<Vars, Requires>,
    query: MediaQuery,
    block: RuleSet<B, BR>,
  ): RuleSet<Vars | B, Requires | BR>
} = internal.append

export const concat: {
  /**
   * Returns a function that appends `that`'s members after its argument's.
   *
   * @param that - The block whose members come second.
   * @returns A function producing the concatenated block.
   * @since 0.1.0
   */
  <B extends Var.Any, BR extends Requirement>(
    that: RuleSet<B, BR>,
  ): <A extends Var.Any, AR extends Requirement>(self: RuleSet<A, AR>) => RuleSet<A | B, AR | BR>
  /**
   * Concatenates two blocks: `self`'s members followed by `that`'s, order
   * preserved on both sides. No deduplication happens here — repeated
   * declarations are legal CSS and their repetition is cascade behavior.
   *
   * @param self - The block whose members come first.
   * @param that - The block whose members come second.
   * @returns The concatenated block, with both sides' variable names and requirements unioned.
   * @since 0.1.0
   */
  <A extends Var.Any, AR extends Requirement, B extends Var.Any, BR extends Requirement>(
    self: RuleSet<A, AR>,
    that: RuleSet<B, BR>,
  ): RuleSet<A | B, AR | BR>
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
  <S extends Requirement>(
    selector: Selector<S>,
  ): <Vars extends Var.Any>(self: RuleSet<Vars>) => StyleRule<Vars, S>
  /**
   * Lifts a block into a style rule applying to `selector` — sugar for
   * `StyleRule.make(selector, self)` with the arguments flipped, so a
   * block built up through `pipe` caps off as a rule without naming
   * `StyleRule` at the call site. The rule carries the block's variable
   * names unchanged; its requirements are the selector's, the block's
   * discharged. The binder check runs here, as in `StyleRule.make`.
   *
   * @param self - The block the rule applies.
   * @param selector - The selector the block applies to.
   * @returns The style rule pairing `selector` with the block.
   * @throws `Error` when a style rule nested in `self` has a selector that does not reference `&`.
   * @example
   * ```ts
   * RuleSet.make(Declaration.make('--depth', Calc.var('depth'))).pipe(
   *   RuleSet.forSelector(Selector.root),
   * ) // StyleRule<'depth'>
   * ```
   * @since 0.2.0
   */
  <Vars extends Var.Any, S extends Requirement>(
    self: RuleSet<Vars>,
    selector: Selector<S>,
  ): StyleRule<Vars, S>
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
  (
    query: MediaQuery,
  ): <Vars extends Var.Any, Requires extends Requirement>(
    self: RuleSet<Vars, Requires>,
  ) => MediaRule<Vars, Requires>
  /**
   * Lifts a block into a `@media` rule gated by `query` — sugar for
   * `MediaRule.make(query, self)` with the arguments flipped, so a block
   * built up through `pipe` caps off as a rule without naming
   * `MediaRule` at the call site. The rule carries the block's variable
   * names and requirements unchanged; a query contributes neither.
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
  <Vars extends Var.Any, Requires extends Requirement>(
    self: RuleSet<Vars, Requires>,
    query: MediaQuery,
  ): MediaRule<Vars, Requires>
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
 * the braces: one line per declaration, nested `@media` and style rules
 * as indented sub-blocks (`&` kept verbatim), in member order. Empty
 * blocks (and nested rules whose blocks are empty) render as the empty
 * string.
 *
 * A fragment renderer: use it to compose blocks the model does not
 * represent. Whole sheets render via `Stylesheet.render`, and the binder
 * invariant on nested selectors is `StyleRule.make`'s — a free-standing
 * block renders without it.
 *
 * @param set - The block to render.
 * @param options - Optional indentation unit, precision context, and media syntax.
 * @returns Deterministic CSS text.
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
