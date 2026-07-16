import type { Pipeable } from '#util'
import type { SelectorTypeId } from './selector.internal.ts'
import * as internal from './selector.internal.ts'
import type { Specificity } from './specificity.ts'

declare const ParentId: unique symbol
declare const SelectorRequires: unique symbol

/**
 * The requirement carried by a selector that references the nesting
 * selector (`&`): a parent rule must bind the reference before the
 * selector means anything on its own.
 *
 * Nesting the selector's rule inside another style rule discharges it —
 * the enclosing rule's selector is what `&` reads. Top-level positions
 * and `specificity` reject selectors that still carry it. The channel's
 * design is derived in `docs/selector-nesting.md`.
 *
 * @since 0.4.0
 */
export type Parent = { readonly [ParentId]: 'parent' }

/**
 * The union of context requirements a selector can carry — `Parent`
 * today, joined by sibling brands if the model grows other
 * context-dependent selectors.
 *
 * A parameter typed `Selector<Requirement>` admits every selector; bare
 * `Selector` (`Requires = never`) admits only closed ones.
 *
 * @since 0.4.0
 */
export type Requirement = Parent

/**
 * The requirements of a `Selector`, or the union of them for a union of
 * selectors — the type-level extractor the list and combinator
 * constructors use to thread their arguments' requirements into the
 * result.
 *
 * @since 0.4.0
 */
export type SelectorRequires<S extends Selector<Requirement>> =
  S extends Selector<infer R> ? R : never

/**
 * A CSS selector: one compound, or a sequence of compounds joined by
 * combinators, canonically ordered within each compound.
 *
 * Part constructors (`type`, `id`, `class`, `attribute`, `pseudoClass`,
 * `pseudoElement`, `universal`, `nest`) return one-part compounds; `and`
 * merges compounds; `descendant`, `child`, `nextSibling`, and
 * `subsequentSibling` join selectors into complex selectors; `is`,
 * `where`, `has`, and `not` wrap selector lists. Construction
 * canonically orders compound parts and list arguments, so structurally
 * equal selectors compare equal however they were built, and rendering
 * is deterministic. Combinator sequences are never reordered — their
 * order is their meaning. Duplicate parts are kept — `.a.a` legally has
 * specificity `(0, 2, 0)`.
 *
 * `Requires` is the requirements channel: `Parent` while the selector
 * references `&`, `never` once nothing outside the selector is needed.
 * Positions gate by covariance — a parameter typed `Selector` admits
 * only closed selectors, one typed `Selector<Requirement>` admits any.
 *
 * @since 0.1.0
 */
export interface Selector<out Requires extends Requirement = never> extends Pipeable {
  readonly [SelectorTypeId]: SelectorTypeId
  readonly [SelectorRequires]?: Requires
}

/**
 * CSS's six attribute-match operators: exact (`=`), word (`~=`),
 * hyphen-prefix (`|=`), prefix (`^=`), suffix (`$=`), and substring
 * (`*=`).
 *
 * @since 0.1.0
 */
export type AttributeOperator = '=' | '~=' | '|=' | '^=' | '$=' | '*='

/**
 * Checks if a value is a `Selector`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand. The guard widens to `Selector<Requirement>` — it proves the
 * brand, not closedness.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `Selector`, `false` otherwise.
 * @since 0.1.0
 */
export const isSelector: (u: unknown) => u is Selector<Requirement> = internal.isSelector

/**
 * The universal selector, `*`. Contributes nothing to specificity.
 *
 * @since 0.1.0
 */
export const universal: Selector = internal.universal

/**
 * The nesting selector, `&` — a reference to the enclosing rule's
 * selector, usable anywhere a simple selector is: merged into a compound
 * (`&.active`), under a combinator (`& *`), or inside a selector list
 * (`:is(&, & *)`).
 *
 * Carrying it marks the selector `Parent`-requiring: nested style rules
 * must reference it, and top-level positions reject it. Its specificity
 * is the parent selector's, so `specificity` refuses it unresolved —
 * substitute the parent with `under` first.
 *
 * In a compound it sorts just after the type slot: a type selector must
 * come first even beside `&` (`div&`, never `&div`).
 *
 * @since 0.4.0
 */
export const nest: Selector<Parent> = internal.nest

/**
 * Creates a type (element) selector, such as `div`.
 *
 * A compound may contain at most one type or universal selector; `and`
 * enforces this.
 *
 * @param name - The element name. Must be non-empty; passed through unescaped.
 * @returns A one-part `Selector`.
 * @throws `Error` when `name` is empty.
 * @since 0.1.0
 */
export const type: (name: string) => Selector = internal.type

/**
 * Creates an id selector, rendered `#name`.
 *
 * @param name - The id, without the `#` prefix. Must be non-empty; passed through unescaped.
 * @returns A one-part `Selector`.
 * @throws `Error` when `name` is empty.
 * @since 0.1.0
 */
export const id: (name: string) => Selector = internal.id

/**
 * Creates a class selector, rendered `.name`. Exported as `class`
 * (`Selector.class('btn')`) because `class` is reserved in declaration
 * position.
 *
 * @param name - The class name, without the `.` prefix. Must be non-empty; passed through unescaped.
 * @returns A one-part `Selector`.
 * @throws `Error` when `name` is empty.
 * @since 0.1.0
 */
const _class: (name: string) => Selector = internal._class
export { _class as class }

/**
 * Creates a pseudo-class selector, rendered `:name`.
 *
 * For the functional pseudo-classes over selector lists, use `is`,
 * `where`, `has`, or `not`, which take typed selector arguments.
 *
 * @param name - The pseudo-class name, without the `:` prefix. Must be non-empty.
 * @returns A one-part `Selector`.
 * @throws `Error` when `name` is empty.
 * @since 0.1.0
 */
export const pseudoClass: (name: string) => Selector = internal.pseudoClass

export const attribute: {
  /**
   * Creates a presence-only attribute selector, rendered `[name]`.
   *
   * @param name - The attribute name. Must be non-empty; passed through unescaped.
   * @returns A one-part `Selector`.
   * @throws `Error` when `name` is empty.
   * @since 0.1.0
   */
  (name: string): Selector
  /**
   * Creates an exact-match attribute selector, rendered `[name='value']`.
   * The two-argument form assumes the `=` operator.
   *
   * @param name - The attribute name. Must be non-empty; passed through unescaped.
   * @param value - The value to match. Renders single-quoted with embedded quotes and backslashes escaped.
   * @returns A one-part `Selector`.
   * @throws `Error` when `name` is empty.
   * @example
   * ```ts
   * Selector.render(Selector.attribute('data-scheme', 'dark')) // "[data-scheme='dark']"
   * ```
   * @since 0.1.0
   */
  (name: string, value: string): Selector
  /**
   * Creates an attribute selector with an explicit operator, rendered
   * `[name<operator>'value']`.
   *
   * @param name - The attribute name. Must be non-empty; passed through unescaped.
   * @param operator - One of the six `AttributeOperator` spellings.
   * @param value - The value to match. Renders single-quoted with embedded quotes and backslashes escaped.
   * @returns A one-part `Selector`.
   * @throws `Error` when `name` is empty or `operator` is not an attribute operator.
   * @example
   * ```ts
   * Selector.render(Selector.attribute('href', '^=', 'https:')) // "[href^='https:']"
   * ```
   * @since 0.1.0
   */
  (name: string, operator: AttributeOperator, value: string): Selector
} = internal.attribute

/**
 * Creates a matches-any pseudo-class, rendered `:is(a, b, ...)`. The
 * arguments form a selector list — compound or complex alike — and the
 * part matches an element matching any of them.
 *
 * The list canonically sorts (matching is order-independent), so
 * `is(a, b)` equals `is(b, a)`. The part's specificity is its most
 * specific argument's. Requirements union across arguments — an `&`
 * inside the list marks the whole selector `Parent`-requiring.
 *
 * @param selectors - The selector list. At least one.
 * @returns A one-part `Selector` carrying the arguments' requirements.
 * @throws `Error` when called with no arguments.
 * @example
 * ```ts
 * Selector.render(Selector.is(Selector.nest, Selector.descendant(Selector.nest, Selector.universal)))
 * // ':is(&, & *)'
 * ```
 * @since 0.4.0
 */
export const is: <Args extends ReadonlyArray<Selector<Requirement>>>(
  ...selectors: Args
) => Selector<SelectorRequires<Args[number]>> = internal.is

/**
 * Creates a zero-specificity matches-any pseudo-class, rendered
 * `:where(a, b, ...)`. Matching is identical to `is`; the part
 * contributes nothing to specificity regardless of its arguments.
 *
 * The list canonically sorts, and requirements union across arguments.
 *
 * @param selectors - The selector list. At least one.
 * @returns A one-part `Selector` carrying the arguments' requirements.
 * @throws `Error` when called with no arguments.
 * @since 0.4.0
 */
export const where: <Args extends ReadonlyArray<Selector<Requirement>>>(
  ...selectors: Args
) => Selector<SelectorRequires<Args[number]>> = internal.where

/**
 * Creates a relational pseudo-class, rendered `:has(a, b, ...)`: the
 * part matches an element whose subtree contains a match for any
 * argument.
 *
 * Arguments are ordinary selectors — the relative forms with a leading
 * combinator (`:has(> .x)`) are not modeled. The list canonically
 * sorts, the part's specificity is its most specific argument's, and
 * requirements union across arguments.
 *
 * @param selectors - The selector list. At least one.
 * @returns A one-part `Selector` carrying the arguments' requirements.
 * @throws `Error` when called with no arguments.
 * @since 0.4.0
 */
export const has: <Args extends ReadonlyArray<Selector<Requirement>>>(
  ...selectors: Args
) => Selector<SelectorRequires<Args[number]>> = internal.has

/**
 * Creates a functional negation, rendered `:not(a, b, ...)`. The
 * arguments form a selector list; the part matches an element matching
 * none of them.
 *
 * The list canonically sorts, the part's specificity is its most
 * specific argument's (`:not` itself contributes none), and
 * requirements union across arguments.
 *
 * @param selectors - The selector list to negate. At least one.
 * @returns A one-part `Selector` carrying the arguments' requirements.
 * @throws `Error` when called with no arguments.
 * @since 0.1.0
 */
export const not: <Args extends ReadonlyArray<Selector<Requirement>>>(
  ...selectors: Args
) => Selector<SelectorRequires<Args[number]>> = internal.not

/**
 * Creates a pseudo-element selector, rendered `::name`.
 *
 * A compound may contain at most one pseudo-element; `and` enforces
 * this. No combinator may follow one — the combinator constructors
 * enforce that.
 *
 * @param name - The pseudo-element name, without the `::` prefix. Must be non-empty.
 * @returns A one-part `Selector`.
 * @throws `Error` when `name` is empty.
 * @since 0.1.0
 */
export const pseudoElement: (name: string) => Selector = internal.pseudoElement

/**
 * The `:root` pseudo-class selector — sugar for `pseudoClass('root')`,
 * the usual anchor for custom-property rules.
 *
 * @since 0.1.0
 */
export const root: Selector = internal.root

export const and: {
  /**
   * Returns a function that merges `that` into its argument.
   *
   * @param that - The compound to merge in.
   * @returns A function that takes a compound and returns the merged compound.
   * @since 0.1.0
   */
  <B extends Requirement>(
    that: Selector<B>,
  ): <A extends Requirement>(self: Selector<A>) => Selector<A | B>
  /**
   * Merges two compounds into one, constraining the same element with
   * every part of both. Parts re-sort into canonical order, so `and` is
   * commutative; duplicates are kept. Requirements union across the two
   * sides.
   *
   * Compounds only: a complex selector has no single element to
   * constrain. Join complex selectors with a combinator, or wrap them
   * in a selector list.
   *
   * @param self - The first compound.
   * @param that - The second compound.
   * @returns The merged compound, carrying both sides' requirements.
   * @throws `Error` when either operand is a complex selector, or when the merge would contain two type/universal selectors or two pseudo-elements.
   * @example
   * ```ts
   * Selector.root.pipe(
   *   Selector.and(Selector.attribute('data-scheme', 'dark')),
   *   Selector.render,
   * ) // ":root[data-scheme='dark']"
   * ```
   * @since 0.1.0
   */
  <A extends Requirement, B extends Requirement>(
    self: Selector<A>,
    that: Selector<B>,
  ): Selector<A | B>
} = internal.and

export const descendant: {
  /**
   * Returns a function that joins its argument to `that` with the
   * descendant combinator.
   *
   * @param that - The right (descendant) side.
   * @returns A function that takes a selector and returns the complex selector `self that`.
   * @since 0.4.0
   */
  <B extends Requirement>(
    that: Selector<B>,
  ): <A extends Requirement>(self: Selector<A>) => Selector<A | B>
  /**
   * Joins two selectors with the descendant combinator, rendered
   * `self that`: the right side matches anywhere inside the left side's
   * subtree.
   *
   * Either side may itself be complex; the compound sequence
   * concatenates in order, and nothing re-sorts across a combinator.
   * Requirements union across the two sides.
   *
   * @param self - The left (ancestor) side. Must not end in a compound containing a pseudo-element.
   * @param that - The right (descendant) side.
   * @returns The complex selector `self that`, carrying both sides' requirements.
   * @throws `Error` when `self` ends in a compound containing a pseudo-element — no combinator may follow one.
   * @example
   * ```ts
   * Selector.render(Selector.descendant(Selector.class('sidebar'), Selector.type('a')))
   * // '.sidebar a'
   * ```
   * @since 0.4.0
   */
  <A extends Requirement, B extends Requirement>(
    self: Selector<A>,
    that: Selector<B>,
  ): Selector<A | B>
} = internal.descendant

export const child: {
  /**
   * Returns a function that joins its argument to `that` with the child
   * combinator.
   *
   * @param that - The right (child) side.
   * @returns A function that takes a selector and returns the complex selector `self > that`.
   * @since 0.4.0
   */
  <B extends Requirement>(
    that: Selector<B>,
  ): <A extends Requirement>(self: Selector<A>) => Selector<A | B>
  /**
   * Joins two selectors with the child combinator, rendered
   * `self > that`: the right side matches direct children of the left
   * side's matches. Composition rules are `descendant`'s.
   *
   * @param self - The left (parent) side. Must not end in a compound containing a pseudo-element.
   * @param that - The right (child) side.
   * @returns The complex selector `self > that`, carrying both sides' requirements.
   * @throws `Error` when `self` ends in a compound containing a pseudo-element — no combinator may follow one.
   * @since 0.4.0
   */
  <A extends Requirement, B extends Requirement>(
    self: Selector<A>,
    that: Selector<B>,
  ): Selector<A | B>
} = internal.child

export const nextSibling: {
  /**
   * Returns a function that joins its argument to `that` with the
   * next-sibling combinator.
   *
   * @param that - The right (following sibling) side.
   * @returns A function that takes a selector and returns the complex selector `self + that`.
   * @since 0.4.0
   */
  <B extends Requirement>(
    that: Selector<B>,
  ): <A extends Requirement>(self: Selector<A>) => Selector<A | B>
  /**
   * Joins two selectors with the next-sibling combinator, rendered
   * `self + that`: the right side matches the element immediately
   * following a left-side match. Composition rules are `descendant`'s.
   *
   * @param self - The left side. Must not end in a compound containing a pseudo-element.
   * @param that - The right (following sibling) side.
   * @returns The complex selector `self + that`, carrying both sides' requirements.
   * @throws `Error` when `self` ends in a compound containing a pseudo-element — no combinator may follow one.
   * @since 0.4.0
   */
  <A extends Requirement, B extends Requirement>(
    self: Selector<A>,
    that: Selector<B>,
  ): Selector<A | B>
} = internal.nextSibling

export const subsequentSibling: {
  /**
   * Returns a function that joins its argument to `that` with the
   * subsequent-sibling combinator.
   *
   * @param that - The right (later sibling) side.
   * @returns A function that takes a selector and returns the complex selector `self ~ that`.
   * @since 0.4.0
   */
  <B extends Requirement>(
    that: Selector<B>,
  ): <A extends Requirement>(self: Selector<A>) => Selector<A | B>
  /**
   * Joins two selectors with the subsequent-sibling combinator, rendered
   * `self ~ that`: the right side matches any later sibling of a
   * left-side match. Composition rules are `descendant`'s.
   *
   * @param self - The left side. Must not end in a compound containing a pseudo-element.
   * @param that - The right (later sibling) side.
   * @returns The complex selector `self ~ that`, carrying both sides' requirements.
   * @throws `Error` when `self` ends in a compound containing a pseudo-element — no combinator may follow one.
   * @since 0.4.0
   */
  <A extends Requirement, B extends Requirement>(
    self: Selector<A>,
    that: Selector<B>,
  ): Selector<A | B>
} = internal.subsequentSibling

export const under: {
  /**
   * Returns a function that resolves its argument against `parent`.
   *
   * @param parent - The parent selector to substitute for `&`.
   * @returns A function that takes a nested selector and returns it resolved against `parent`.
   * @since 0.4.0
   */
  <P extends Requirement>(
    parent: Selector<P>,
  ): <C extends Requirement>(child: Selector<C>) => Selector<Exclude<C, Parent> | P>
  /**
   * Resolves a nested selector against its parent: every `&` in `child`,
   * including inside `is`/`where`/`has`/`not` argument lists, is
   * replaced by `parent`, discharging the `Parent` requirement.
   *
   * A compound parent merges in place (`&.active` under `.btn` is
   * `.btn.active`); a complex parent substitutes as `:is(parent)`, which
   * matches and scores identically. The result's specificity is
   * therefore the spec's — `&` counts as the parent selector. A child
   * without `&` returns unchanged. Chained nesting resolves innermost
   * binder first: resolve the grandchild against its parent, then the
   * result against the grandparent.
   *
   * @param child - The nested selector to resolve.
   * @param parent - The parent selector to substitute for `&`. May itself reference `&`; the result then still carries `Parent`.
   * @returns The resolved selector, carrying `child`'s requirements minus `Parent`, plus `parent`'s.
   * @throws `Error` when a substitution produces an invalid compound — merging a typed parent into a compound that already has a type selector, say.
   * @example
   * ```ts
   * const nested = Selector.is(Selector.nest, Selector.descendant(Selector.nest, Selector.universal))
   * Selector.render(Selector.under(nested, Selector.class('red')))
   * // ':is(.red, .red *)'
   * ```
   * @since 0.4.0
   */
  <C extends Requirement, P extends Requirement>(
    child: Selector<C>,
    parent: Selector<P>,
  ): Selector<Exclude<C, Parent> | P>
} = internal.under

/**
 * Computes the selector's specificity: ids into `a`; classes,
 * attributes, and pseudo-classes into `b`; types and pseudo-elements
 * into `c`. Compounds in a complex selector sum. `:is()`, `:has()`, and
 * `:not()` add their most specific argument; `:where()` and the
 * universal selector add nothing; duplicate parts count each time.
 *
 * Closed selectors only: an `&`-bearing selector takes its specificity
 * from the parent rule, so the parameter rejects `Parent`-requiring
 * selectors at compile time — resolve them with `under` first.
 *
 * This is what lets a consumer turn "these rules tie, so their order
 * encodes the override direction" into something checkable.
 *
 * @param selector - The selector to measure. Must be closed (no `&`).
 * @returns The computed `Specificity`.
 * @since 0.1.0
 */
export const specificity: (selector: Selector) => Specificity = internal.specificity

/**
 * Renders the selector as CSS text: each compound's parts concatenated
 * in canonical order — type first, then `&`, ids, classes,
 * pseudo-classes, attributes, functional pseudo-classes, and the
 * pseudo-element last, alphabetically within each kind — and compounds
 * joined by their combinators in authored order. Any fixed part order
 * matches identically; this one keeps root-scoped shapes in their
 * conventional spelling.
 *
 * @param selector - The selector to render.
 * @returns Deterministic CSS text.
 * @example
 * ```ts
 * Selector.render(Selector.and(Selector.pseudoClass('hover'), Selector.class('btn')))
 * // '.btn:hover'
 * ```
 * @since 0.1.0
 */
export const render: (selector: Selector<Requirement>) => string = internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The selector to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: Selector<Requirement>): (self: Selector<Requirement>) => boolean
  /**
   * Structural equality over canonically ordered parts: two selectors
   * built from the same parts compare equal regardless of construction
   * order. Combinator sequences compare in order — `a b` and `b a` are
   * different selectors.
   *
   * @param self - The first selector.
   * @param that - The second selector.
   * @returns `true` if the selectors are structurally equal.
   * @since 0.1.0
   */
  (self: Selector<Requirement>, that: Selector<Requirement>): boolean
} = internal.equals
