import type { ApplyBindings, Bindings, Calc } from '#calc/calc'
import type { Precision } from '#calc/precision'
import type { Color } from '#color/color'
import type { RenderOptions as MediaQueryRenderOptions } from '#query/mediaQuery'
import type { Pipeable } from '#util'
import type { DeclarationTypeId } from './declaration.internal.ts'
import * as internal from './declaration.internal.ts'

/**
 * A CSS declaration: a property name paired with a value.
 *
 * This is the seam where the library's two halves meet — the value is
 * either literal CSS text, passed through verbatim, or a value-layer
 * expression (`Calc` or `Color`) serialized when the declaration renders.
 * Expression values stay number-land: units are applied by the consumer,
 * in text or at the property's `@property` syntax.
 *
 * The `Refs` parameter carries the value's unbound reference names, as on
 * `Calc`; literal text binds nothing and a text-valued declaration is a
 * `Declaration<never>`.
 *
 * Construct via `make`.
 *
 * @since 0.1.0
 */
export interface Declaration<out Refs extends string = string> extends Pipeable {
  readonly [DeclarationTypeId]: DeclarationTypeId
  /**
   * The property name, exactly as it renders — `font-size`, or `--depth`
   * for a custom property.
   */
  readonly name: string
  /**
   * The declaration's value: literal CSS text or a value-layer expression.
   */
  readonly value: Value<Refs>
}

/**
 * The value forms a declaration can hold: literal CSS text, a `Calc`
 * number expression, or a `Color` expression.
 *
 * @since 0.1.0
 */
export type Value<Refs extends string = string> = string | Calc<Refs> | Color<Refs>

/**
 * Checks if a value is a `Declaration`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `Declaration`, `false` otherwise.
 * @since 0.1.0
 */
export const isDeclaration: (u: unknown) => u is Declaration<string> = internal.isDeclaration

/**
 * Creates a declaration.
 *
 * Literal text is stored verbatim — no parsing, no escaping. A bare
 * number is coerced to an unannotated constant expression, as anywhere
 * else an expression is accepted, so it serializes under the precision
 * context rather than as raw text.
 *
 * @param name - The property name, exactly as it renders (`--x` keeps its dashes). Must be non-empty.
 * @param value - Literal CSS text, a number, or a `Calc`/`Color` expression.
 * @returns A `Declaration` carrying the value's reference names — `Declaration<never>` for text and numbers.
 * @throws `Error` when `name` is empty.
 * @example
 * ```ts
 * Declaration.make('color', 'red')
 * Declaration.make('--fluid', Calc.add(14, Calc.multiply(Calc.ref('vw'), 0.01)))
 * ```
 * @since 0.1.0
 */
export const make: <Refs extends string = never>(
  name: string,
  value: Value<Refs> | number,
) => Declaration<Refs> = internal.make

export const bind: {
  /**
   * Returns a function that binds the given names in a declaration's
   * value.
   *
   * @param bindings - Reference names to values or expressions.
   * @returns A function replacing bound references in its argument's value.
   * @since 0.1.0
   */
  <const B extends Bindings>(
    bindings: B,
  ): <Refs extends string>(declaration: Declaration<Refs>) => Declaration<ApplyBindings<Refs, B>>
  /**
   * Replaces references in the declaration's value with values or other
   * expressions, re-folding constant subtrees. Semantics match
   * `Calc.bind`: unreferenced names and `undefined` values are ignored,
   * and expression-valued bindings contribute their own references. A
   * literal-text value binds nothing; the declaration is returned as-is.
   *
   * @param declaration - The declaration to bind.
   * @param bindings - Reference names to values or expressions.
   * @returns The bound declaration.
   * @since 0.1.0
   */
  <Refs extends string, const B extends Bindings>(
    declaration: Declaration<Refs>,
    bindings: B,
  ): Declaration<ApplyBindings<Refs, B>>
} = internal.bind

/**
 * The declaration's unbound reference names — empty for literal text,
 * the value's references otherwise.
 *
 * @param declaration - The declaration to inspect.
 * @returns The set of unbound reference names.
 * @since 0.1.0
 */
export const refs: <Refs extends string>(declaration: Declaration<Refs>) => ReadonlySet<Refs> =
  internal.refs

/**
 * Options for `render`, extending `MediaQuery.RenderOptions` — the
 * render-options family's base — with the precision context.
 *
 * @since 0.1.0
 */
export interface RenderOptions extends MediaQueryRenderOptions {
  /**
   * The precision for expression constants that carry no annotation of
   * their own. Defaults to `Precision.decimals(5)`, as in
   * `Calc.serialize`.
   */
  readonly precision?: Precision
}

/**
 * Renders the declaration as one CSS declaration, semicolon included:
 * `name: value;`. Literal text passes through verbatim; expression
 * values serialize as `Calc.serialize`/`Color.serialize` would, with
 * unbound references rendering as `var(--name)`.
 *
 * @param declaration - The declaration to render.
 * @param options - Optional precision context for expression values.
 * @returns Deterministic CSS text.
 * @example
 * ```ts
 * Declaration.render(Declaration.make('--indent', Calc.multiply(Calc.ref('depth'), 8)))
 * // '--indent: calc(var(--depth) * 8);'
 * ```
 * @since 0.1.0
 */
export const render: (declaration: Declaration<string>, options?: RenderOptions) => string =
  internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The declaration to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: Declaration<string>): (self: Declaration<string>) => boolean
  /**
   * Structural equality: names compare as text, expression values as
   * expression trees (`Calc.equals` semantics, precision annotations
   * included). Literal text never equals an expression, even one that
   * would serialize to the same characters.
   *
   * @param self - The first declaration.
   * @param that - The second declaration.
   * @returns `true` if the declarations are structurally equal.
   * @since 0.1.0
   */
  (self: Declaration<string>, that: Declaration<string>): boolean
} = internal.equals
