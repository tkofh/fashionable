import type { FontFaceRule } from '#fontFace/fontFaceRule'
import type { PropertyRule } from '#property/propertyRule'
import type { RenderOptions as RuleSetRenderOptions, RuleSet } from '#rule/ruleSet'
import type { StyleRule } from '#rule/styleRule'
import type { Selector } from '#selector/selector'
import type { Pipeable } from '#util'
import type { Var } from '#var'
import type { StylesheetTypeId } from './stylesheet.internal.ts'
import * as internal from './stylesheet.internal.ts'

/**
 * The top level of a CSS file: an ordered sequence of style rules and
 * declaration-block at-rules, kept structurally distinct.
 *
 * Node order is preserved exactly as authored — never sorted, because
 * top-level order is cascade behavior — but a node structurally equal to
 * an earlier one is dropped at construction, the first occurrence
 * winning. That distinctness invariant is what makes `merge` a lawful
 * monoid: sheets from independent emitters fold without duplicating the
 * rules they share.
 *
 * The `Vars` parameter unions the nodes' unbound variable names, as on
 * `Calc` — read `Stylesheet<'depth'>` as "this sheet reads
 * `var(--depth)`": a dependency report, not an error state. `vars` is
 * the runtime set.
 *
 * Construct via `make` (or `empty` and `append`).
 *
 * @since 0.1.0
 */
export interface Stylesheet<out Vars extends Var.Any = Var.Any> extends Pipeable {
  readonly [StylesheetTypeId]: StylesheetTypeId
  /**
   * The sheet's nodes, in authored order, structurally distinct.
   */
  readonly nodes: ReadonlyArray<Node<Vars>>
}

/**
 * The forms a stylesheet may contain at its top level: style rules and
 * the declaration-block at-rules (`@font-face`, `@property`).
 *
 * Deliberately absent are `Declaration` — CSS has no top-level
 * declarations — and `MediaRule`: media enters the model nested inside a
 * style rule's block, and renders there. The full unrepresentability
 * scheme lives in `docs/design.md`.
 *
 * @since 0.1.0
 */
export type Node<Vars extends Var.Any = Var.Any> = StyleRule<Vars> | FontFaceRule | PropertyRule

/**
 * The unbound variable names of a `Node`, or the union of them for a
 * union of nodes — the type-level counterpart of `vars`, used by the
 * constructors to thread node names into the result. Only style rules
 * carry variables; the at-rule forms contribute `never`, since
 * `@property` initial values are closed by construction.
 *
 * @since 0.1.0
 */
export type NodeVars<N extends Node<Var.Any>> = N extends StyleRule<infer R> ? R : never

/**
 * Checks if a value is a `Stylesheet`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `Stylesheet`, `false` otherwise.
 * @since 0.1.0
 */
export const isStylesheet: (u: unknown) => u is Stylesheet<Var.Any> = internal.isStylesheet

/**
 * The empty stylesheet — the identity for `merge`.
 *
 * @since 0.1.0
 */
export const empty: Stylesheet<never> = internal.empty

/**
 * Checks if the sheet has no nodes.
 *
 * Structural emptiness only: a non-empty sheet can still *render* as the
 * empty string, when every node is a style rule whose block renders
 * empty — `render` guarantees the empty string in both cases.
 *
 * @param sheet - The sheet to inspect.
 * @returns `true` if the sheet has no nodes.
 * @since 0.2.0
 */
export const isEmpty: (sheet: Stylesheet<Var.Any>) => boolean = internal.isEmpty

/**
 * Creates a stylesheet holding the given nodes, in the given order, with
 * structural duplicates dropped — the first occurrence wins.
 *
 * @param nodes - Style rules and at-rules, in authored order.
 * @returns A `Stylesheet` whose `Vars` unions the nodes' variable names.
 * @example
 * ```ts
 * const sheet = Stylesheet.make(
 *   PropertyRule.make('--depth', PropertySyntax.number, 0),
 *   StyleRule.make(
 *     Selector.class('card'),
 *     RuleSet.make(Declaration.make('--indent', Calc.multiply(Calc.var('depth'), 8))),
 *   ),
 * ) // Stylesheet<'depth'>
 * ```
 * @since 0.1.0
 */
export const make: <Nodes extends ReadonlyArray<Node<Var.Any>>>(
  ...nodes: Nodes
) => Stylesheet<NodeVars<Nodes[number]>> = internal.make

export const append: {
  /**
   * Returns a function that appends `node` to its argument's sheet.
   *
   * @param node - The node to append.
   * @returns A function producing the extended sheet.
   * @since 0.1.0
   */
  <N extends Node<Var.Any>>(
    node: N,
  ): <Vars extends Var.Any>(self: Stylesheet<Vars>) => Stylesheet<Vars | NodeVars<N>>
  /**
   * Returns a function that appends the style rule `selector { block }`
   * to its argument's sheet.
   *
   * @param selector - The rule's selector.
   * @param block - The rule's block.
   * @returns A function producing the extended sheet.
   * @since 0.1.0
   */
  <B extends Var.Any>(
    selector: Selector,
    block: RuleSet<B>,
  ): <Vars extends Var.Any>(self: Stylesheet<Vars>) => Stylesheet<Vars | B>
  /**
   * Appends a node at the end of the sheet — unless a structurally equal
   * node is already present, in which case the same sheet comes back
   * unchanged (the first occurrence wins). Otherwise the result is a new
   * sheet; the original is untouched.
   *
   * @param self - The sheet to extend.
   * @param node - The node to append.
   * @returns The extended sheet, with the node's variable names joined in.
   * @since 0.1.0
   */
  <Vars extends Var.Any, N extends Node<Var.Any>>(
    self: Stylesheet<Vars>,
    node: N,
  ): Stylesheet<Vars | NodeVars<N>>
  /**
   * Appends a style rule from its parts — sugar for
   * `append(self, StyleRule.make(selector, block))`, so sheets compose
   * without naming `StyleRule` at the call site. Deduplication applies
   * as usual: a sheet already carrying an equal rule comes back
   * unchanged.
   *
   * @param self - The sheet to extend.
   * @param selector - The rule's selector.
   * @param block - The rule's block.
   * @returns The extended sheet, with the block's variable names joined in.
   * @example
   * ```ts
   * Stylesheet.empty.pipe(
   *   Stylesheet.append(Selector.root, RuleSet.make(Declaration.make('--depth', 0))),
   * )
   * ```
   * @since 0.1.0
   */
  <Vars extends Var.Any, B extends Var.Any>(
    self: Stylesheet<Vars>,
    selector: Selector,
    block: RuleSet<B>,
  ): Stylesheet<Vars | B>
} = internal.append

export const merge: {
  /**
   * Returns a function that merges `that`'s novel nodes after its
   * argument's.
   *
   * @param that - The sheet whose novel nodes come second.
   * @returns A function producing the merged sheet.
   * @since 0.1.0
   */
  <B extends Var.Any>(
    that: Stylesheet<B>,
  ): <A extends Var.Any>(self: Stylesheet<A>) => Stylesheet<A | B>
  /**
   * Merges two sheets: `self`'s nodes followed by the nodes of `that`
   * not already present, order preserved on both sides — structural
   * duplicates collapse to their first occurrence. With `empty` as
   * identity this is a lawful monoid (associative, idempotent), which is
   * the multi-emitter fold: emitters that each register the rules they
   * share merge to a sheet carrying one copy.
   *
   * Identity and idempotence hold by reference, not just structurally:
   * merging `empty` on either side, or a sheet with itself, returns that
   * same instance.
   *
   * @param self - The sheet whose nodes come first.
   * @param that - The sheet whose novel nodes follow.
   * @returns The merged sheet, with both sides' variable names unioned.
   * @example
   * ```ts
   * const contract = Stylesheet.make(PropertyRule.make('--depth', PropertySyntax.number, 0))
   * Stylesheet.merge(contract, contract) // === contract — merge is idempotent
   * ```
   * @since 0.1.0
   */
  <A extends Var.Any, B extends Var.Any>(
    self: Stylesheet<A>,
    that: Stylesheet<B>,
  ): Stylesheet<A | B>
} = internal.merge

/**
 * Folds any number of sheets with `merge`, left to right — `empty` when
 * given none.
 *
 * The element type is inferred whole and its vars extracted, so a
 * heterogeneous array unions every sheet's reads (inferring the phantom
 * directly would pin it to the first element's).
 *
 * @param sheets - The sheets to fold, in order.
 * @returns The merged sheet, with every sheet's variable names unioned.
 * @since 0.1.0
 */
export const mergeAll: <S extends Stylesheet<Var.Any>>(
  sheets: ReadonlyArray<S>,
) => Stylesheet<S extends Stylesheet<infer V> ? V : never> = internal.mergeAll

/**
 * Options for `coalesce`.
 *
 * @since 0.2.0
 */
export interface CoalesceOptions {
  /**
   * When `true`, unsafe pulls throw instead of rewriting the cascade.
   * Defaults to `false`.
   *
   * A pull moves the coalesced rule's block backward across every rule
   * between the first occurrence of its selector and the later one. The
   * pull throws when an intervening style rule ties the coalesced
   * selector on specificity, unless every moved declaration is provably
   * shadowed by that rule.
   *
   * Shadowed means the crossed rule, in its final coalesced form,
   * re-establishes the declaration. It contains a structurally equal
   * declaration under a media query implied by the moved one's query.
   * No later member whose query can hold alongside the moved one's sets
   * a different value.
   *
   * The check never reasons about whether tying selectors can match the
   * same element. It refuses what it cannot prove: a crossing whose
   * blocks nest style rules, or a moved declaration without a
   * re-establishing twin.
   */
  readonly strict?: boolean
}

/**
 * Coalesces style rules that share a selector: each later rule's block
 * is concatenated onto the first rule with a structurally equal selector
 * (in sheet order, as `RuleSet.concat` would), and the later rule is
 * dropped. Other node kinds pass through untouched.
 *
 * Deliberately separate from `merge`, and order-sensitive: pulling a
 * block backward past an intervening rule can change the cascade when
 * the intervening selector ties on specificity, so coalescing is an
 * explicit opt-in normalization. `strict` turns that caution into a
 * checked invariant — a build gate that proves the sheet's coalesce is
 * cascade-preserving.
 *
 * Coalesce is a repair operation for sheets whose construction you
 * don't control. If strict mode refuses a sheet you built yourself,
 * don't weaken the check — assemble in the target shape instead:
 * refusal usually means the operation is reconstructing an intent you
 * could express directly.
 *
 * @param sheet - The sheet to normalize.
 * @param options - Optional strictness.
 * @returns The coalesced sheet; the same instance when no selector repeats, so coalesce is idempotent.
 * @throws `Error` in strict mode, when a pull crosses an intervening tying rule that does not provably shadow every moved declaration.
 * @since 0.1.0
 */
export const coalesce: <Vars extends Var.Any>(
  sheet: Stylesheet<Vars>,
  options?: CoalesceOptions,
) => Stylesheet<Vars> = internal.coalesce

/**
 * The sheet's unbound variable names, unioned across nodes — the custom
 * properties the sheet reads via `var()`, including everything nested
 * rules contribute.
 *
 * @param sheet - The sheet to inspect.
 * @returns The set of unbound variable names.
 * @since 0.1.0
 */
export const vars: <Vars extends Var.Any>(sheet: Stylesheet<Vars>) => ReadonlySet<Var.Name<Vars>> =
  internal.refs

/**
 * Options for `render`: the indentation unit, precision context, and
 * media syntax, shared with the rule renderers. One options value
 * composes across every `render` in the library — the renderers that
 * take fewer keys accept it and ignore the rest.
 *
 * Options change text, never meaning: the same sheet renders the same
 * cascade under any of them.
 *
 * @since 0.1.0
 */
export type RenderOptions = RuleSetRenderOptions

/**
 * Renders the whole sheet as CSS text: at-rule nodes as their own
 * blocks, style rules in nested form with their `@media` blocks kept
 * inside, in member order.
 *
 * Empty blocks emit nothing, so a sheet whose every node renders empty —
 * `empty` itself, or style rules with empty blocks — renders the empty
 * string; composing renders into a larger file never needs to reach into
 * `nodes`. Top-level sections join with one blank line, without a
 * trailing newline. Unbound variables render as `var(--name)`.
 *
 * @param sheet - The stylesheet to render.
 * @param options - Optional indentation unit, precision context, and media syntax.
 * @returns Deterministic CSS text.
 * @throws `Error` when a style rule nests inside another rule's block — selector composition (`&`) is a later extension, not part of v1 rendering.
 * @example
 * ```ts
 * const sheet = Stylesheet.empty.pipe(
 *   Stylesheet.append(
 *     Selector.root,
 *     RuleSet.make(Declaration.make('--gutter', 16)).pipe(
 *       RuleSet.append(MediaQuery.minWidth(768), RuleSet.make(Declaration.make('--gutter', 24))),
 *     ),
 *   ),
 * )
 * Stylesheet.render(sheet)
 * // ":root {\n\t--gutter: 16;\n\t@media (min-width: 768px) {\n\t\t--gutter: 24;\n\t}\n}"
 * ```
 * @since 0.1.0
 */
export const render: (sheet: Stylesheet<Var.Any>, options?: RenderOptions) => string =
  internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The sheet to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: Stylesheet<Var.Any>): (self: Stylesheet<Var.Any>) => boolean
  /**
   * Structural equality over nodes, in order. Order participates —
   * sheets holding the same nodes in different orders cascade
   * differently, so they compare unequal.
   *
   * @param self - The first sheet.
   * @param that - The second sheet.
   * @returns `true` if the sheets are structurally equal.
   * @since 0.1.0
   */
  (self: Stylesheet<Var.Any>, that: Stylesheet<Var.Any>): boolean
} = internal.equals
