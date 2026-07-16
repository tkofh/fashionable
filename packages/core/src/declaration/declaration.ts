import type { ApplyBindings, Bindings, Calc } from '#calc/calc'
import type { Precision } from '#calc/precision'
import type { Unit } from '#data'
import type { Color } from '#data/color'
import type { RenderOptions as MediaQueryRenderOptions } from '#query/mediaQuery'
import type { Pipeable } from '#util'
import type { Var } from '#var'
import type { DeclarationTypeId } from './declaration.internal.ts'
import * as internal from './declaration.internal.ts'

/**
 * A CSS declaration: a property name paired with a value.
 *
 * This is the seam where the library's two halves meet — the value is
 * either literal CSS text, passed through verbatim, or a value-layer
 * expression (`Calc` or `Color`) serialized when the declaration renders.
 * A `Calc` of any dimension is accepted: a `<number>`, or a `<length>` /
 * `<angle>` built from `fashionable/data`, which carries its own units.
 *
 * The `Vars` parameter carries the value's unbound reads, as on `Calc`;
 * literal text binds nothing and a text-valued declaration is a
 * `Declaration<never>`. A whole-value custom-property read is spelled as a
 * `Var` value, not literal text, so it joins the report:
 * `make('font-family', Var.of('stack'))` is a `Declaration<Var<'stack'>>`.
 *
 * Construct via `make`.
 *
 * @since 0.1.0
 */
export interface Declaration<out Vars extends Var.Any = Var.Any> extends Pipeable {
  readonly [DeclarationTypeId]: DeclarationTypeId
  /**
   * The property name, exactly as it renders — `font-size`, or `--depth`
   * for a custom property.
   */
  readonly name: string
  /**
   * The declaration's value: literal CSS text or a value-layer expression.
   */
  readonly value: Value<Vars>
}

/**
 * The fallbacks a declaration-level read admits: any declaration value —
 * literal text, a number, an expression of either world, or another read,
 * recursively. This is the widest projection of the generic fallback slot
 * on `Var`: at the declaration level a fallback is an arbitrary token
 * sequence, so every value form qualifies.
 *
 * @since 0.4.0
 */
export type ValueFallback =
  | string
  | number
  | Calc<Var.Any, Unit.Any, unknown>
  | Color<Var.Any>
  | Var.Var<string, unknown, ValueFallback | undefined>

/**
 * A custom-property read usable as a whole declaration value: bare, or
 * carrying any declaration value as its fallback.
 *
 * @since 0.4.0
 */
export type Read = Var.Var<string, unknown, ValueFallback | undefined>

/**
 * The value forms a declaration can hold: literal CSS text, a `Calc`
 * expression of any dimension, a `Color` expression, or a whole-value
 * custom-property read (`font-family: var(--stack, sans-serif)`), whose
 * fallback may be any declaration value.
 *
 * @since 0.1.0
 */
export type Value<Vars extends Var.Any = Var.Any> =
  | string
  | Calc<Vars, Unit.Any, unknown>
  | Color<Vars>
  | Var.Var<Var.Name<Vars>, unknown, ValueFallback | undefined>

// The identities a read contributes, flattened: its own name-and-type
// pair, then its fallback chain's across both expression worlds.
type ReadVars<V> =
  V extends Var.Var<infer N, infer T, infer F> ? Var.Var<N, T> | ReadFallbackVars<F> : never
type ReadFallbackVars<F> =
  F extends Calc<infer W, Unit.Any, unknown>
    ? W
    : F extends Color<infer W>
      ? W
      : F extends Var.Any
        ? ReadVars<F>
        : never

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
export const isDeclaration: (u: unknown) => u is Declaration<Var.Any> = internal.isDeclaration

export const make: {
  /**
   * Creates a declaration whose value is a whole custom-property read —
   * the honest spelling of `font-family: var(--stack, sans-serif)`, which
   * as literal text would drop the read from the dependency report. The
   * declaration's `Vars` unions the read's identity with its fallback
   * chain's, flattened.
   *
   * @param name - The property name, exactly as it renders. Must be non-empty.
   * @param value - The read, from `Var.of` (optionally through `Var.fallback`).
   * @returns A `Declaration` carrying the read's names.
   * @throws `Error` when `name` is empty, or the read's fallback chain holds a value no declaration can (anything but text, numbers, expressions, and reads).
   * @example
   * ```ts
   * Declaration.make('font-family', Var.of('stack').pipe(Var.fallback('sans-serif')))
   * // renders 'font-family: var(--stack, sans-serif);'
   * ```
   * @since 0.4.0
   */
  <V extends Read>(name: string, value: V): Declaration<ReadVars<V>>
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
   * @returns A `Declaration` carrying the value's variable names — `Declaration<never>` for text and numbers.
   * @throws `Error` when `name` is empty, or `value` is a non-finite number.
   * @example
   * ```ts
   * Declaration.make('color', 'red')
   * Declaration.make('--fluid', Calc.add(14, Calc.multiply(Calc.var('vw'), 0.01)))
   * ```
   * @since 0.1.0
   */
  <Vars extends Var.Any = never>(name: string, value: Value<Vars> | number): Declaration<Vars>
} = internal.make

export const bind: {
  /**
   * Returns a function that binds the given names in a declaration's
   * value.
   *
   * @param bindings - Variable names to values or expressions.
   * @returns A function replacing bound variables in its argument's value.
   * @since 0.1.0
   */
  <const B extends Bindings>(
    bindings: B,
  ): <Vars extends Var.Any>(declaration: Declaration<Vars>) => Declaration<ApplyBindings<Vars, B>>
  /**
   * Replaces variables in the declaration's value with values or other
   * expressions, re-folding constant subtrees. Semantics match
   * `Calc.bind`: unread names and `undefined` values are ignored, and
   * expression-valued bindings contribute their own variables. A
   * literal-text value binds nothing; the declaration is returned as-is.
   *
   * @param declaration - The declaration to bind.
   * @param bindings - Variable names to values or expressions.
   * @returns The bound declaration.
   * @since 0.1.0
   */
  <Vars extends Var.Any, const B extends Bindings>(
    declaration: Declaration<Vars>,
    bindings: B,
  ): Declaration<ApplyBindings<Vars, B>>
} = internal.bind

/**
 * The declaration's unbound variable names — empty for literal text,
 * the value's variables otherwise.
 *
 * @param declaration - The declaration to inspect.
 * @returns The set of unbound variable names.
 * @since 0.1.0
 */
export const vars: <Vars extends Var.Any>(
  declaration: Declaration<Vars>,
) => ReadonlySet<Var.Name<Vars>> = internal.refs

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
 * unbound variables rendering as `var(--name)`.
 *
 * @param declaration - The declaration to render.
 * @param options - Optional precision context for expression values.
 * @returns Deterministic CSS text.
 * @example
 * ```ts
 * Declaration.render(Declaration.make('--indent', Calc.multiply(Calc.var('depth'), 8)))
 * // '--indent: calc(var(--depth) * 8);'
 * ```
 * @since 0.1.0
 */
export const render: (declaration: Declaration<Var.Any>, options?: RenderOptions) => string =
  internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The declaration to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: Declaration<Var.Any>): (self: Declaration<Var.Any>) => boolean
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
  (self: Declaration<Var.Any>, that: Declaration<Var.Any>): boolean
} = internal.equals
