import type { ApplyBindings, Bindings, Calc, PartialBindings } from '#calc/calc'
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

/**
 * A handle usable in name position: a bare (fallback-free) read, written
 * as its property (`make(gap, ...)` renders `--gap: ...`). A fallback
 * belongs to a read site, so a fallback-carrying read is rejected
 * structurally here.
 *
 * @since 0.4.0
 */
type Handle<T = unknown> = Var.Var<string, T, undefined>

// The value forms a declared write admits: the declared type itself (with
// the writing expression's own reads in its Vars), the bare-number sugar
// under a number declaration, and literal text always (the library does
// not parse CSS, so text is every declaration's escape hatch).
type DeclaredWrite<T, V2 extends Var.Any> =
  T extends Color<Var.Any>
    ? Color<V2> | string
    : T extends Calc<Var.Any, infer R, unknown>
      ?
          | Calc<V2, Unit.Family<R>, unknown>
          | ([Unit.Family<R>] extends [Unit.None] ? number : never)
          | string
      : never

// Guards a name-position handle to undeclared reads for the untyped write
// overload — a declared handle types its value through DeclaredWrite. The
// `Type` slot's `unknown` top makes the exclusion inexpressible as a
// constraint, so the parameter intersects this (the `Calc.var` pattern).
type UndeclaredGuard<H> =
  H extends Var.Var<string, infer T, undefined>
    ? [unknown] extends [T]
      ? unknown
      : "a declared handle types its write: pass a value of the handle's declared type"
    : never

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
  /**
   * Writes a property through its handle with a read as the whole value —
   * the alias pattern, `--gap: var(--spacing)`. The read's names join the
   * report; the written property contributes none (writing is not
   * reading).
   *
   * @param handle - The property's canonical handle. Must be fallback-free.
   * @param value - The read to write, from `Var.of` or a typed constructor (optionally through `Var.fallback`).
   * @returns A `Declaration` carrying the read's names.
   * @throws `Error` when the handle carries a fallback, or the value's fallback chain holds a form no declaration can.
   * @since 0.4.0
   */
  <V extends Read>(handle: Handle, value: V): Declaration<ReadVars<V>>
  /**
   * Writes a declared property through its handle, the value typed by the
   * declared type: a `Var.length` handle takes length-family expressions
   * (or literal text), a `Var.color` handle takes colors — so a write
   * that contradicts the registration is a type error at the declaration.
   * The name renders with its `--` prefix.
   *
   * @param handle - The property's canonical handle, from a typed `Var` constructor. Must be fallback-free.
   * @param value - The value to write, typed by the handle's declared type; its own reads become the declaration's `Vars`.
   * @returns A `Declaration` carrying the value's names.
   * @throws `Error` when the handle carries a fallback.
   * @example
   * ```ts
   * const gap = Var.length('gap')
   * Declaration.render(Declaration.make(gap, Length.px(8))) // '--gap: 8px;'
   * ```
   * @since 0.4.0
   */
  <T extends Calc<Var.Any, Unit.Any, unknown> | Color<Var.Any>, V2 extends Var.Any = never>(
    handle: Handle<T>,
    value: DeclaredWrite<T, V2>,
  ): Declaration<V2>
  /**
   * Writes a property through its undeclared handle: any declaration
   * value, exactly as the string-name form. The name renders with its
   * `--` prefix.
   *
   * @param handle - The property's canonical handle, from `Var.of`. Must be fallback-free.
   * @param value - Literal CSS text, a number, or a `Calc`/`Color` expression.
   * @returns A `Declaration` carrying the value's names.
   * @throws `Error` when the handle carries a fallback.
   * @since 0.4.0
   */
  <H extends Handle, V2 extends Var.Any = never>(
    handle: H & UndeclaredGuard<H>,
    value: Value<V2> | number,
  ): Declaration<V2>
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
  <Vars extends Var.Any, const B extends PartialBindings<Vars>>(
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
