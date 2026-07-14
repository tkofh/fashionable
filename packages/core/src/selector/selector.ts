import type { Pipeable } from '../utils.ts'
import type { SelectorTypeId } from './selector.internal.ts'
import * as internal from './selector.internal.ts'
import type { Specificity } from './specificity.ts'

/**
 * A compound selector: a canonically ordered, non-empty collection of
 * simple-selector parts, all constraining the same element.
 *
 * Part constructors (`type`, `id`, `className`, `attribute`,
 * `pseudoClass`, `not`, `pseudoElement`, `universal`) return one-part
 * selectors; `and` merges compounds. Construction canonically orders the
 * parts, so structurally equal selectors compare equal however they were
 * built, and rendering is deterministic. Duplicate parts are kept —
 * `.a.a` legally has specificity `(0, 2, 0)`.
 *
 * Combinators (descendant, child) are a later extension layered above
 * this type; a `Selector` always describes one compound.
 *
 * @since 0.1.0
 */
export interface Selector extends Pipeable {
  readonly [SelectorTypeId]: SelectorTypeId
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
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `Selector`, `false` otherwise.
 * @since 0.1.0
 */
export const isSelector: (u: unknown) => u is Selector = internal.isSelector

/**
 * The universal selector, `*`. Contributes nothing to specificity.
 *
 * @since 0.1.0
 */
export const universal: Selector = internal.universal

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
 * (`Selector.class('btn')`) — the local binding is `_class` only because
 * `class` is reserved in declaration position.
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
 * For the functional negation pseudo-class, use `not`, which takes a
 * typed selector argument.
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
 * Creates a functional negation, rendered `:not(argument)`. The argument
 * is a full compound selector, and contributes its own specificity to the
 * enclosing selector (`:not` itself contributes none).
 *
 * @param argument - The selector to negate.
 * @returns A one-part `Selector`.
 * @since 0.1.0
 */
export const not: (argument: Selector) => Selector = internal.not

/**
 * Creates a pseudo-element selector, rendered `::name`.
 *
 * A compound may contain at most one pseudo-element; `and` enforces this.
 *
 * @param name - The pseudo-element name, without the `::` prefix. Must be non-empty.
 * @returns A one-part `Selector`.
 * @throws `Error` when `name` is empty.
 * @since 0.1.0
 */
export const pseudoElement: (name: string) => Selector = internal.pseudoElement

/**
 * The `:root` pseudo-class selector — `pseudoClass('root')`, named
 * because it anchors every custom-property rule this library's consumers
 * emit.
 *
 * @since 0.1.0
 */
export const root: Selector = internal.root

export const and: {
  /**
   * Returns a function that merges `that` into its argument.
   *
   * @param that - The selector to merge in.
   * @returns A function producing the merged compound.
   * @since 0.1.0
   */
  (that: Selector): (self: Selector) => Selector
  /**
   * Merges two compounds into one, constraining the same element with
   * every part of both. Parts re-sort into canonical order, so `and` is
   * commutative; duplicates are kept.
   *
   * @param self - The first compound.
   * @param that - The second compound.
   * @returns The merged compound.
   * @throws `Error` when the merge would contain two type/universal selectors or two pseudo-elements.
   * @example
   * ```ts
   * Selector.root.pipe(
   *   Selector.and(Selector.attribute('data-scheme', 'dark')),
   *   Selector.render,
   * ) // ":root[data-scheme='dark']"
   * ```
   * @since 0.1.0
   */
  (self: Selector, that: Selector): Selector
} = internal.and

/**
 * Computes the selector's specificity: ids into `a`;
 * classes, attributes, and pseudo-classes into `b`; types and
 * pseudo-elements into `c`. `:not(...)` adds its argument's specificity;
 * the universal selector adds nothing; duplicate parts count each time.
 *
 * This is what lets a consumer turn "these rules tie, so their order
 * encodes the override direction" into something checkable.
 *
 * @param selector - The selector to measure.
 * @returns The computed `Specificity`.
 * @since 0.1.0
 */
export const specificity: (selector: Selector) => Specificity = internal.specificity

/**
 * Renders the selector as CSS text: parts concatenated in canonical
 * order — type first, then ids, classes, pseudo-classes, attributes,
 * negations, and the pseudo-element last, alphabetically within each
 * kind. Any fixed order matches identically; this one keeps root-scoped
 * shapes in their conventional spelling.
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
export const render: (selector: Selector) => string = internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The selector to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: Selector): (self: Selector) => boolean
  /**
   * Structural equality over canonically ordered parts: two selectors
   * built from the same parts compare equal regardless of construction
   * order.
   *
   * @param self - The first selector.
   * @param that - The second selector.
   * @returns `true` if the selectors are structurally equal.
   * @since 0.1.0
   */
  (self: Selector, that: Selector): boolean
} = internal.equals
