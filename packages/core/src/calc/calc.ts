import type { Pipeable } from '../utils.ts'
import type { CalcTypeId } from './calc.internal.ts'
import * as internal from './calc.internal.ts'
import type { Precision } from './precision.ts'

declare const CalcRefs: unique symbol

/**
 * A CSS number expression: a tree of constants, unbound references, and
 * math operations that can be solved to a number, serialized to CSS
 * `calc()` text, or partially bound and passed along.
 *
 * The `Refs` parameter tracks the expression's unbound reference names at
 * the type level. `ref('u')` is a `Calc<'u'>`; combining expressions
 * unions their parameters; `bind` subtracts the names it binds. A fully
 * bound (or constant) expression is a `Calc<never>`, which is what `solve`
 * accepts without bindings.
 *
 * Values are immutable and structurally comparable via `equals`.
 * Construction folds constant subtrees eagerly: `add(1, 2)` is the
 * constant `3`, and binding every reference of a tree collapses it to a
 * constant.
 *
 * An unbound reference serializes as `var(--name)` — the reference channel
 * is the custom-property channel.
 *
 * Construct via `of`, `ref`, and the math combinators.
 *
 * @since 0.1.0
 */
export interface Calc<out Refs extends string = string> extends Pipeable {
  readonly [CalcTypeId]: CalcTypeId
  readonly [CalcRefs]?: Refs
}

/**
 * A value accepted where an expression is expected: an existing `Calc` or
 * a bare number, which is coerced to an unannotated constant.
 *
 * @since 0.1.0
 */
export type Input<Refs extends string = string> = Calc<Refs> | number

/**
 * A bindings record: reference names to the values that replace them. A
 * value may itself be an expression, whose own references join the result.
 *
 * @since 0.1.0
 */
export type Bindings<Refs extends string = string> = Record<Refs, Input>

type ValueRefs<V> = V extends Calc<infer R> ? R : never

type BindingRefs<T> = T extends Record<string, infer V> ? ValueRefs<V> : never

/**
 * The reference names remaining after applying the bindings `B` to an
 * expression with references `Refs`: bound names are removed, and the
 * references of any expression-valued bindings are added.
 *
 * @since 0.1.0
 */
export type ApplyBindings<Refs extends string, B> =
  | Exclude<Refs, keyof B & string>
  | BindingRefs<Pick<B, Extract<keyof B, Refs>>>

/**
 * Options for `serialize`.
 *
 * @since 0.1.0
 */
export interface SerializeOptions<Refs extends string = string> {
  /**
   * Bindings applied before rendering. May be partial: references left
   * unbound render as `var(--name)`.
   */
  readonly bindings?: Partial<Bindings<Refs>>
  /**
   * The precision for constants that carry no annotation of their own.
   * Defaults to `Precision.decimals(5)`.
   */
  readonly precision?: Precision
}

/**
 * Checks if a value is a `Calc`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `Calc`, `false` otherwise.
 * @since 0.1.0
 */
export const isCalc: (u: unknown) => u is Calc<string> = internal.isCalc

/**
 * Creates a constant expression, optionally annotated with a serialization
 * precision that overrides the context default wherever the constant lands
 * — including in constants produced by folding it with others (the
 * highest-fidelity operand annotation wins).
 *
 * Bare numbers passed to combinators become unannotated constants; `of`
 * exists to name a value or pin its precision.
 *
 * @param value - The constant value. Must be finite.
 * @param precision - Optional precision annotation.
 * @returns A constant `Calc<never>`.
 * @throws `Error` when `value` is not finite.
 * @example
 * ```ts
 * const k = Calc.of(0.8377580409572781, Precision.significant(10))
 * Calc.serialize(Calc.multiply(k, Calc.ref('t'))) // 'calc(0.837758041 * var(--t))'
 * ```
 * @since 0.1.0
 */
export const of: (value: number, precision?: Precision) => Calc<never> = internal.of

/**
 * Creates a reference to an unbound name. References serialize as
 * `var(--name)` and are the channel through which expressions read CSS
 * custom properties; `bind` replaces them with values or other
 * expressions.
 *
 * Repeated calls with the same name return the same instance.
 *
 * @param name - The reference name, without the `--` prefix. Must be non-empty.
 * @returns A `Calc` with `name` as its one unbound reference.
 * @throws `Error` when `name` is empty.
 * @example
 * ```ts
 * Calc.serialize(Calc.ref('width')) // 'var(--width)'
 * ```
 * @since 0.1.0
 */
export const ref: <Name extends string>(name: Name) => Calc<Name> = internal.ref

/**
 * Adds expressions. Constant operands fold at construction.
 *
 * Serializes as `a + b + ...` inside a `calc()` wrapper; negative constant
 * terms (and products led by a negative constant) render subtractively:
 * `a + (-2)` serializes as `a - 2`.
 *
 * @param a - The first operand.
 * @param b - The second operand.
 * @returns The sum, with the operands' references unioned.
 * @example
 * ```ts
 * Calc.serialize(Calc.add(Calc.ref('x'), 10)) // 'calc(var(--x) + 10)'
 * ```
 * @since 0.1.0
 */
export const add: {
  <A extends string = never, B extends string = never>(a: Input<A>, b: Input<B>): Calc<A | B>
  <A extends string = never, B extends string = never, C extends string = never>(
    a: Input<A>,
    b: Input<B>,
    c: Input<C>,
  ): Calc<A | B | C>
  <
    A extends string = never,
    B extends string = never,
    C extends string = never,
    D extends string = never,
  >(
    a: Input<A>,
    b: Input<B>,
    c: Input<C>,
    d: Input<D>,
  ): Calc<A | B | C | D>
  (...args: readonly [Input, Input, ...ReadonlyArray<Input>]): Calc<string>
} = internal.add

/**
 * Subtracts `right` from `left`. Constant operands fold at construction.
 *
 * @param left - The minuend.
 * @param right - The subtrahend.
 * @returns The difference, with the operands' references unioned.
 * @since 0.1.0
 */
export const subtract: <A extends string = never, B extends string = never>(
  left: Input<A>,
  right: Input<B>,
) => Calc<A | B> = internal.subtract

/**
 * Multiplies expressions. Constant operands fold at construction.
 *
 * Addition and subtraction operands are parenthesized when serialized
 * under a product: `(a + b) * c`.
 *
 * @param left - The first factor.
 * @param right - The second factor.
 * @returns The product, with the operands' references unioned.
 * @since 0.1.0
 */
export const multiply: <A extends string = never, B extends string = never>(
  left: Input<A>,
  right: Input<B>,
) => Calc<A | B> = internal.multiply

/**
 * Divides `left` by `right`. Constant operands fold at construction.
 *
 * @param left - The dividend.
 * @param right - The divisor.
 * @returns The quotient, with the operands' references unioned.
 * @since 0.1.0
 */
export const divide: <A extends string = never, B extends string = never>(
  left: Input<A>,
  right: Input<B>,
) => Calc<A | B> = internal.divide

/**
 * Raises `base` to `exponent`. Serializes as the CSS `pow()` function.
 *
 * @param base - The base.
 * @param exponent - The exponent.
 * @returns The power, with the operands' references unioned.
 * @since 0.1.0
 */
export const pow: <A extends string = never, B extends string = never>(
  base: Input<A>,
  exponent: Input<B>,
) => Calc<A | B> = internal.pow

/**
 * Sign-preserving power: `abs(base) ^ exponent * sign(base)`. Unlike
 * `pow`, well-defined for negative bases with fractional exponents.
 * Serializes as `pow(abs(base), exponent) * sign(base)`.
 *
 * @param base - The base.
 * @param exponent - The exponent.
 * @returns The signed power, with the operands' references unioned.
 * @since 0.1.0
 */
export const signedPow: <A extends string = never, B extends string = never>(
  base: Input<A>,
  exponent: Input<B>,
) => Calc<A | B> = internal.signedPow

/**
 * The minimum of the operands. Serializes as the CSS `min()` function.
 *
 * @param a - The first operand.
 * @param b - The second operand.
 * @returns The minimum, with the operands' references unioned.
 * @since 0.1.0
 */
export const min: {
  <A extends string = never, B extends string = never>(a: Input<A>, b: Input<B>): Calc<A | B>
  <A extends string = never, B extends string = never, C extends string = never>(
    a: Input<A>,
    b: Input<B>,
    c: Input<C>,
  ): Calc<A | B | C>
  <
    A extends string = never,
    B extends string = never,
    C extends string = never,
    D extends string = never,
  >(
    a: Input<A>,
    b: Input<B>,
    c: Input<C>,
    d: Input<D>,
  ): Calc<A | B | C | D>
  (...args: readonly [Input, Input, ...ReadonlyArray<Input>]): Calc<string>
} = internal.min

/**
 * The maximum of the operands. Serializes as the CSS `max()` function.
 *
 * @param a - The first operand.
 * @param b - The second operand.
 * @returns The maximum, with the operands' references unioned.
 * @since 0.1.0
 */
export const max: {
  <A extends string = never, B extends string = never>(a: Input<A>, b: Input<B>): Calc<A | B>
  <A extends string = never, B extends string = never, C extends string = never>(
    a: Input<A>,
    b: Input<B>,
    c: Input<C>,
  ): Calc<A | B | C>
  <
    A extends string = never,
    B extends string = never,
    C extends string = never,
    D extends string = never,
  >(
    a: Input<A>,
    b: Input<B>,
    c: Input<C>,
    d: Input<D>,
  ): Calc<A | B | C | D>
  (...args: readonly [Input, Input, ...ReadonlyArray<Input>]): Calc<string>
} = internal.max

/**
 * Clamps `value` between `minimum` and `maximum`. Serializes as the CSS
 * `clamp()` function, with the CSS argument order `(min, value, max)`.
 *
 * @param minimum - The lower bound.
 * @param value - The value to clamp.
 * @param maximum - The upper bound.
 * @returns The clamped expression, with the operands' references unioned.
 * @example
 * ```ts
 * Calc.serialize(Calc.clamp(-1, Calc.ref('u'), 1)) // 'clamp(-1, var(--u), 1)'
 * ```
 * @since 0.1.0
 */
export const clamp: <A extends string = never, B extends string = never, C extends string = never>(
  minimum: Input<A>,
  value: Input<B>,
  maximum: Input<C>,
) => Calc<A | B | C> = internal.clamp

/**
 * Linear interpolation from `a` to `b` by `t`. This is sugar, not a node:
 * it desugars to `(1 - t) * a + t * b`, and serializes as that expanded
 * form.
 *
 * @param a - The value at `t = 0`.
 * @param b - The value at `t = 1`.
 * @param t - The interpolation parameter.
 * @returns The interpolated expression, with the operands' references unioned.
 * @since 0.1.0
 */
export const lerp: <A extends string = never, B extends string = never, T extends string = never>(
  a: Input<A>,
  b: Input<B>,
  t: Input<T>,
) => Calc<A | B | T> = internal.lerp

/**
 * The absolute value. Serializes as the CSS `abs()` function.
 *
 * @param argument - The operand.
 * @returns The absolute value expression.
 * @since 0.1.0
 */
export const abs: <A extends string = never>(argument: Input<A>) => Calc<A> = internal.abs

/**
 * The sign (`-1`, `0`, or `1`). Serializes as the CSS `sign()` function.
 *
 * @param argument - The operand.
 * @returns The sign expression.
 * @since 0.1.0
 */
export const sign: <A extends string = never>(argument: Input<A>) => Calc<A> = internal.sign

/**
 * The sine of an angle in radians. Serializes as the CSS `sin()`
 * function; CSS treats a plain-number argument as radians, so no unit
 * conversion is involved.
 *
 * @param argument - The angle, in radians.
 * @returns The sine expression.
 * @since 0.1.0
 */
export const sin: <A extends string = never>(argument: Input<A>) => Calc<A> = internal.sin

/**
 * The cosine of an angle in radians. Serializes as the CSS `cos()`
 * function; CSS treats a plain-number argument as radians, so no unit
 * conversion is involved.
 *
 * @param argument - The angle, in radians.
 * @returns The cosine expression.
 * @since 0.1.0
 */
export const cos: <A extends string = never>(argument: Input<A>) => Calc<A> = internal.cos

/**
 * The arccosine of a value in `[-1, 1]`, in radians. Solving evaluates
 * `Math.acos`.
 *
 * Serialization note: CSS's `acos()` returns an `<angle>`, not a number.
 * The serializer keeps such subtrees angle-typed — plain-number terms
 * added to or subtracted from an acos-carrying term are rendered with a
 * `rad` suffix (constants) or a `* 1rad` factor (anything else), so the
 * emitted CSS stays valid without typed division. In v1, consume
 * acos-carrying subtrees with `sin` or `cos`; feeding one into a plain
 * number context serializes to angle-typed CSS.
 *
 * @param argument - The cosine value, in `[-1, 1]`.
 * @returns The arccosine expression, in radians.
 * @example
 * ```ts
 * Calc.serialize(Calc.cos(Calc.subtract(Calc.divide(Calc.acos(Calc.ref('u')), 3), 2.0943951)))
 * // 'cos(acos(var(--u)) / 3 - 2.0944rad)'
 * ```
 * @since 0.1.0
 */
export const acos: <A extends string = never>(argument: Input<A>) => Calc<A> = internal.acos

export const bind: {
  /**
   * Returns a function that binds the given names in an expression.
   *
   * @param bindings - Reference names to values or expressions. Names the expression does not reference are ignored, as are `undefined` values.
   * @returns A function replacing bound references in its argument.
   * @since 0.1.0
   */
  <const B extends Bindings>(
    bindings: B,
  ): <Refs extends string>(expr: Calc<Refs>) => Calc<ApplyBindings<Refs, B>>
  /**
   * Replaces references with values or other expressions. Binding is
   * partial evaluation: substituted subtrees re-fold, so binding every
   * reference collapses the tree to a constant.
   *
   * Names the expression does not reference are ignored (spreading a wider
   * bindings object is fine), as are `undefined` values. Binding a
   * reference to another expression composes trees; the bound expression's
   * own references join the result, tracked in the return type by
   * `ApplyBindings`.
   *
   * @param expr - The expression to bind.
   * @param bindings - Reference names to values or expressions.
   * @returns The bound expression.
   * @example
   * ```ts
   * const half = Calc.bind(Calc.divide(Calc.ref('x'), 2), { x: Calc.ref('width') })
   * Calc.serialize(half) // 'calc(var(--width) / 2)'
   * Calc.solve(Calc.bind(half, { width: 100 })) // 50
   * ```
   * @since 0.1.0
   */
  <Refs extends string, const B extends Bindings>(
    expr: Calc<Refs>,
    bindings: B,
  ): Calc<ApplyBindings<Refs, B>>
} = internal.bind

export const solve: {
  /**
   * Evaluates a fully bound expression to a number.
   *
   * The parameter type `Calc<never>` makes closedness a compile-time
   * requirement; an expression with unbound references needs the bindings
   * overload.
   *
   * @param expr - The expression to evaluate. Must have no unbound references.
   * @returns The numeric value.
   * @throws `Error` when unbound references remain at runtime.
   * @since 0.1.0
   */
  (expr: Calc<never>): number
  /**
   * Applies bindings, then evaluates to a number. The bindings must cover
   * every unbound reference.
   *
   * @param expr - The expression to evaluate.
   * @param bindings - Values for every unbound reference.
   * @returns The numeric value.
   * @throws `Error` when unbound references remain after binding.
   * @example
   * ```ts
   * Calc.solve(Calc.lerp(Calc.ref('a'), Calc.ref('b'), 0.5), { a: 0, b: 10 }) // 5
   * ```
   * @since 0.1.0
   */
  <Refs extends string, B extends Bindings<Refs>>(expr: Calc<Refs>, bindings: B): number
} = internal.solve

/**
 * Renders an expression as CSS text. Arithmetic gets a `calc()` wrapper;
 * function forms (`min`, `clamp`, `sin`, ...) and leaves stand alone.
 * References render as `var(--name)`.
 *
 * Bindings in `options` are applied first and may be partial — this is
 * the serialize half of the solve/serialize duality, and unbound
 * references are the values left for the browser. Constants render with
 * their annotated precision, or the context `precision` option (default
 * `Precision.decimals(5)`). Constants equal to pi render as the CSS
 * constant `pi` where a math function surrounds them.
 *
 * @param expr - The expression to render.
 * @param options - Optional bindings and precision context.
 * @returns Deterministic CSS text.
 * @example
 * ```ts
 * const fluid = Calc.add(10, Calc.ref('runtime'))
 * Calc.serialize(fluid) // 'calc(10 + var(--runtime))'
 * Calc.serialize(fluid, { bindings: { runtime: 4 } }) // '14'
 * ```
 * @since 0.1.0
 */
export const serialize: <Refs extends string>(
  expr: Calc<Refs>,
  options?: SerializeOptions<Refs>,
) => string = internal.serialize

/**
 * The expression's unbound reference names.
 *
 * @param expr - The expression to inspect.
 * @returns The set of unbound reference names.
 * @since 0.1.0
 */
export const refs: <Refs extends string>(expr: Calc<Refs>) => ReadonlySet<Refs> = internal.refs

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The expression to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: Calc<string>): (self: Calc<string>) => boolean
  /**
   * Structural equality over expression trees. Two expressions are equal
   * when their trees match node for node — including constant precision
   * annotations, which affect serialization. Expression trees are ordered
   * syntax: `add(a, b)` and `add(b, a)` are not equal.
   *
   * @param self - The first expression.
   * @param that - The second expression.
   * @returns `true` if the expressions are structurally equal.
   * @since 0.1.0
   */
  (self: Calc<string>, that: Calc<string>): boolean
} = internal.equals
