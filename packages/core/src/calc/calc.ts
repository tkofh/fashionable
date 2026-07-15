import type { ContextFree, UnitContext } from '#data/units'
import type { Pipeable } from '#util'
import type { CalcTypeId } from './calc.internal.ts'
import * as internal from './calc.internal.ts'
import type { Precision } from './precision.ts'

declare const CalcVariance: unique symbol

/**
 * The CSS dimension an expression carries: `<number>`, `<length>`, `<angle>`,
 * or `<percentage>`. It is the `Kind` parameter of `Calc`, and the algebra
 * enforces it — same-kind addition, kind-merging multiplication, same-kind
 * division yielding a number. A `<percentage>` is its own kind, not a
 * length: it adds only to another percentage, and `<length-percentage>`
 * mixing stays out of the model (see `docs/design.md`).
 *
 * @since 0.2.0
 */
export type Kind = 'number' | 'length' | 'angle' | 'percentage'

/**
 * A CSS value expression: a tree of constants, unbound references, and math
 * operations that can be solved to a number, serialized to CSS `calc()`
 * text, or partially bound and passed along.
 *
 * Three type parameters track the expression structurally:
 *
 * - `Refs` — the unbound reference names. `ref('u')` is a `Calc<'u'>`;
 *   combining expressions unions their parameters; `bind` subtracts the
 *   names it binds. A fully bound (or constant) expression is a
 *   `Calc<never>`.
 * - `Kind` — the CSS dimension (`'number'` by default, or `'length'` /
 *   `'angle'`). `add`/`subtract` require a shared kind; `multiply` and
 *   `divide` combine kinds (a `<length>` over a `<length>` is a
 *   `<number>`); an invalid pairing (a `<length>` plus a `<number>`) is a
 *   type error.
 * - `Leaves` — the units the tree contains, as a set of `Unit` brands
 *   (`never` when the tree is unit-free). It types the context `solve`
 *   needs to lower the tree to a number.
 *
 * Values are immutable and structurally comparable via `equals`.
 * Construction folds constant subtrees eagerly: `add(1, 2)` is the
 * constant `3`, and binding every reference of a tree collapses it to a
 * constant.
 *
 * An unbound reference serializes as `var(--name)` — the reference channel
 * is the custom-property channel.
 *
 * Construct via `of`, `ref`, the `Length`/`Angle` constructors in
 * `fashionable/data`, and the math combinators.
 *
 * @since 0.1.0
 */
export interface Calc<
  out Refs extends string = string,
  out K extends Kind = 'number',
  out Leaves = never,
> extends Pipeable {
  readonly [CalcTypeId]: CalcTypeId
  readonly [CalcVariance]?: { readonly refs: Refs; readonly kind: K; readonly leaves: Leaves }
}

/**
 * The widest `Calc` — the supertype every expression extends, used to
 * constrain a combinator operand before its facets are extracted.
 *
 * @since 0.2.0
 */
export type Top = Calc<string, Kind, unknown>

// ---------------------------------------------------------------------------
// dimensioned-combinator type machinery (internal): facet extractors and the
// kind/leaf algebra the combinator signatures below are built from. Validated
// by the spike in docs/dimensioned-calc.md.
// ---------------------------------------------------------------------------

/** Any operand a combinator accepts: an expression of any kind, or a bare number. */
type In = Top | number

type RefsOf<A> = A extends Calc<infer R, Kind, unknown> ? R : never
type KindOf<A> = A extends Calc<string, infer K, unknown> ? K : 'number'
type LeavesOf<A> = A extends Calc<string, Kind, infer L> ? L : never

/** An operand constrained to number-kind (or a bare number). */
type NumberIn = number | Calc<string, 'number', unknown>

/** An operand accepted by `sin`/`cos`: a plain number (radians) or an angle. */
type NumberOrAngleIn = number | Calc<string, 'number' | 'angle', unknown>

/**
 * An operand constrained to `A`'s kind — a bare number only when `A` is
 * number-kind, so `add(length, 1)` is rejected while `add(length, length)`
 * holds.
 */
type SameKindIn<A> =
  | Calc<string, KindOf<A> & Kind, unknown>
  | (KindOf<A> extends 'number' ? number : never)

type RefsOfAll<T extends ReadonlyArray<unknown>> = { [K in keyof T]: RefsOf<T[K]> }[number]
type LeavesOfAll<T extends ReadonlyArray<unknown>> = { [K in keyof T]: LeavesOf<T[K]> }[number]

// same-single-unit division cancels to a unit-free number; anything else keeps
// both operands' units (conservative, but sound)
type IsUnion<T, U = T> = [T] extends [never]
  ? false
  : T extends T
    ? [U] extends [T]
      ? false
      : true
    : never
type Singleton<T> = [T] extends [never] ? false : IsUnion<T> extends true ? false : true
type LeafFn<X> = <T>() => T extends X ? 1 : 2
type LeafEqual<A, B> = LeafFn<A> extends LeafFn<B> ? true : false
type SameSingleton<A, B> = LeafEqual<A, B> extends true ? Singleton<A> : false
type DivLeaves<A, B> =
  KindOf<B> extends 'number'
    ? LeavesOf<A>
    : SameSingleton<LeavesOf<A>, LeavesOf<B>> extends true
      ? never
      : LeavesOf<A> | LeavesOf<B>

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
export const isCalc: (u: unknown) => u is Calc<string, Kind, unknown> = internal.isCalc

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
export const add: <
  A extends In,
  B extends SameKindIn<A>,
  Rest extends ReadonlyArray<SameKindIn<A>>,
>(
  a: A,
  b: B,
  ...rest: Rest
) => Calc<
  RefsOf<A> | RefsOf<B> | RefsOfAll<Rest>,
  KindOf<A> & Kind,
  LeavesOf<A> | LeavesOf<B> | LeavesOfAll<Rest>
> = internal.add

/**
 * Subtracts `right` from `left`. Constant operands fold at construction.
 *
 * @param left - The minuend.
 * @param right - The subtrahend.
 * @returns The difference, with the operands' references unioned.
 * @since 0.1.0
 */
export const subtract: <A extends In, B extends SameKindIn<A>>(
  left: A,
  right: B,
) => Calc<RefsOf<A> | RefsOf<B>, KindOf<A> & Kind, LeavesOf<A> | LeavesOf<B>> = internal.subtract

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
export const multiply: {
  <A extends NumberIn, B extends In>(
    left: A,
    right: B,
  ): Calc<RefsOf<A> | RefsOf<B>, KindOf<B> & Kind, LeavesOf<A> | LeavesOf<B>>
  <A extends In, B extends NumberIn>(
    left: A,
    right: B,
  ): Calc<RefsOf<A> | RefsOf<B>, KindOf<A> & Kind, LeavesOf<A> | LeavesOf<B>>
} = internal.multiply

/**
 * Divides `left` by `right`. Constant operands fold at construction.
 *
 * @param left - The dividend.
 * @param right - The divisor.
 * @returns The quotient, with the operands' references unioned.
 * @since 0.1.0
 */
export const divide: {
  <A extends In, B extends NumberIn>(
    left: A,
    right: B,
  ): Calc<RefsOf<A> | RefsOf<B>, KindOf<A> & Kind, DivLeaves<A, B>>
  <A extends In, B extends SameKindIn<A>>(
    left: A,
    right: B,
  ): Calc<RefsOf<A> | RefsOf<B>, 'number', DivLeaves<A, B>>
} = internal.divide

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
export const min: <
  A extends In,
  B extends SameKindIn<A>,
  Rest extends ReadonlyArray<SameKindIn<A>>,
>(
  a: A,
  b: B,
  ...rest: Rest
) => Calc<
  RefsOf<A> | RefsOf<B> | RefsOfAll<Rest>,
  KindOf<A> & Kind,
  LeavesOf<A> | LeavesOf<B> | LeavesOfAll<Rest>
> = internal.min

/**
 * The maximum of the operands. Serializes as the CSS `max()` function.
 *
 * @param a - The first operand.
 * @param b - The second operand.
 * @returns The maximum, with the operands' references unioned.
 * @since 0.1.0
 */
export const max: <
  A extends In,
  B extends SameKindIn<A>,
  Rest extends ReadonlyArray<SameKindIn<A>>,
>(
  a: A,
  b: B,
  ...rest: Rest
) => Calc<
  RefsOf<A> | RefsOf<B> | RefsOfAll<Rest>,
  KindOf<A> & Kind,
  LeavesOf<A> | LeavesOf<B> | LeavesOfAll<Rest>
> = internal.max

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
export const clamp: <A extends In, B extends SameKindIn<A>, C extends SameKindIn<A>>(
  minimum: A,
  value: B,
  maximum: C,
) => Calc<
  RefsOf<A> | RefsOf<B> | RefsOf<C>,
  KindOf<A> & Kind,
  LeavesOf<A> | LeavesOf<B> | LeavesOf<C>
> = internal.clamp

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
export const lerp: {
  <A extends In, B extends SameKindIn<A>, T extends NumberIn>(
    a: A,
    b: B,
    t: T,
  ): Calc<
    RefsOf<A> | RefsOf<B> | RefsOf<T>,
    KindOf<A> & Kind,
    LeavesOf<A> | LeavesOf<B> | LeavesOf<T>
  >
} = internal.lerp

/**
 * The absolute value. Serializes as the CSS `abs()` function.
 *
 * @param argument - The operand.
 * @returns The absolute value expression.
 * @since 0.1.0
 */
export const abs: {
  <A extends In>(argument: A): Calc<RefsOf<A>, KindOf<A> & Kind, LeavesOf<A>>
} = internal.abs

/**
 * The sign (`-1`, `0`, or `1`). Serializes as the CSS `sign()` function.
 *
 * @param argument - The operand.
 * @returns The sign expression.
 * @since 0.1.0
 */
export const sign: <A extends string = never>(argument: Input<A>) => Calc<A> = internal.sign

/**
 * The sine of its argument. Serializes as the CSS `sin()` function, which
 * accepts an `<angle>` or a plain number treated as radians — so this takes
 * either an angle-kind expression or a number, and returns a number.
 *
 * @param argument - An angle, or a plain number in radians.
 * @returns The sine, a `<number>`, carrying the argument's units.
 * @since 0.1.0
 */
export const sin: {
  <A extends NumberOrAngleIn>(argument: A): Calc<RefsOf<A>, 'number', LeavesOf<A>>
} = internal.sin

/**
 * The cosine of its argument. Serializes as the CSS `cos()` function, which
 * accepts an `<angle>` or a plain number treated as radians — so this takes
 * either an angle-kind expression or a number, and returns a number.
 *
 * @param argument - An angle, or a plain number in radians.
 * @returns The cosine, a `<number>`, carrying the argument's units.
 * @since 0.1.0
 */
export const cos: {
  <A extends NumberOrAngleIn>(argument: A): Calc<RefsOf<A>, 'number', LeavesOf<A>>
} = internal.cos

/**
 * The tangent of its argument. Serializes as the CSS `tan()` function, which
 * accepts an `<angle>` or a plain number treated as radians. Paired with
 * `atan2`, `tan(atan2(a, b))` divides two same-kind dimensions to a `<number>` —
 * the length ratio that works where `a / b` does not, since Firefox does not
 * yet support `<length> / <length>` in `calc()`.
 *
 * @param argument - An angle, or a plain number in radians.
 * @returns The tangent, a `<number>`, carrying the argument's units.
 * @since 0.2.0
 */
export const tan: {
  <A extends NumberOrAngleIn>(argument: A): Calc<RefsOf<A>, 'number', LeavesOf<A>>
} = internal.tan

/**
 * The arccosine of a value in `[-1, 1]`, an `<angle>` in radians (CSS's
 * `acos()` returns an `<angle>`). Solving evaluates `Math.acos`, in radians.
 *
 * Because the result is angle-kind, it composes only with other angles: divide
 * or scale it by a number, and add or subtract an `Angle.rad(...)` phase. A
 * plain number added to it is a type error — supply the phase as an angle.
 *
 * @param argument - The cosine value, in `[-1, 1]`.
 * @returns The arccosine, an `<angle>`, carrying the argument's units.
 * @example
 * ```ts
 * const phase = Angle.rad(2.0943951)
 * Calc.serialize(Calc.cos(Calc.subtract(Calc.divide(Calc.acos(Calc.ref('u')), 3), phase)))
 * // 'cos(acos(var(--u)) / 3 - 2.0944rad)'
 * ```
 * @since 0.1.0
 */
export const acos: {
  <A extends NumberIn>(argument: A): Calc<RefsOf<A>, 'angle', LeavesOf<A>>
} = internal.acos

/**
 * The angle, in radians, of the vector from the origin to `(x, y)` — CSS's
 * `atan2()`, which returns an `<angle>`. The operands must share a kind (two
 * numbers, two lengths, two angles); their units cancel in the ratio, so
 * `tan(atan2(a, b))` recovers `a / b` as a `<number>` and is the portable way to
 * divide two `<length>`s.
 *
 * @param y - The vertical component.
 * @param x - The horizontal component, sharing `y`'s kind.
 * @returns The angle, an `<angle>`, with the operands' units unioned.
 * @example
 * ```ts
 * const ratio = Calc.tan(Calc.atan2(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160)))
 * Calc.serialize(ratio) // 'tan(atan2(100vw - 320px, 160px))'
 * ```
 * @since 0.2.0
 */
export const atan2: {
  <A extends In, B extends SameKindIn<A>>(
    y: A,
    x: B,
  ): Calc<RefsOf<A> | RefsOf<B>, 'angle', LeavesOf<A> | LeavesOf<B>>
} = internal.atan2

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
   * Evaluates a closed expression to a number. Absolute lengths (`px`) and
   * angles (radians) lower with no context; a viewport- or font-relative unit
   * needs the context overload, and an unbound reference needs the bindings
   * overload.
   *
   * @param expr - The expression. No unbound references, only context-free units.
   * @returns The numeric value.
   * @throws `Error` when unbound references or unresolvable units remain at runtime.
   * @since 0.1.0
   */
  (expr: Calc<never, Kind, ContextFree>): number
  /**
   * Applies bindings, then evaluates to a number. For expressions whose units,
   * if any, are all context-free.
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
  <Refs extends string, B extends Bindings<Refs>>(
    expr: Calc<Refs, Kind, ContextFree>,
    bindings: B,
  ): number
  /**
   * Applies bindings, lowers each context-dependent unit through the context,
   * then evaluates to a number. The context supplies a pixels-per-unit ratio
   * for every relative unit the expression carries (`vw` is `sampleWidth / 100`);
   * absolute lengths default (`px` is `1`) unless overridden.
   *
   * @param expr - The expression to evaluate.
   * @param bindings - Values for every unbound reference.
   * @param context - Ratios for the expression's context-dependent units.
   * @returns The numeric value.
   * @example
   * ```ts
   * const position = Calc.divide(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160))
   * Calc.solve(position, {}, { vw: 1280 / 100 }) // 6
   * ```
   * @since 0.2.0
   */
  <Refs extends string, B extends Bindings<Refs>, L>(
    expr: Calc<Refs, Kind, L>,
    bindings: B,
    context: UnitContext<L>,
  ): number
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
  expr: Calc<Refs, Kind, unknown>,
  options?: SerializeOptions<Refs>,
) => string = internal.serialize

/**
 * The expression's unbound reference names.
 *
 * @param expr - The expression to inspect.
 * @returns The set of unbound reference names.
 * @since 0.1.0
 */
export const refs: <Refs extends string>(expr: Calc<Refs, Kind, unknown>) => ReadonlySet<Refs> =
  internal.refs

/**
 * The channel-keyword tokens the expression reads — the `Channel` keywords a
 * relative color introduces (`l`, `c`, `h`, ...). Empty for an expression with
 * no channel keywords.
 *
 * This is the runtime companion to the `Leaves`-level scoping that `solve`'s
 * context requires: `channels` reports which values a context must supply,
 * exactly as `refs` reports the custom properties a binding must, and — unlike
 * a `Calc`'s `Kind`/`Leaves` type — survives on a `Calc<Refs, Kind, unknown>`
 * whose leaves have been erased. Channel keywords are not references, so `refs`
 * never lists them and they never reach a `Stylesheet`'s dependency report.
 *
 * @param expr - The expression to inspect.
 * @returns The set of channel-keyword tokens the expression reads.
 * @example
 * ```ts
 * Calc.channels(Calc.multiply(Channel.L, 0.8)) // Set { 'l' }
 * Calc.channels(Calc.ref('x')) // Set {}
 * ```
 * @since 0.2.0
 */
export const channels: (expr: Calc<string, Kind, unknown>) => ReadonlySet<string> =
  internal.channels

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The expression to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: Calc<string, Kind, unknown>): (self: Calc<string, Kind, unknown>) => boolean
  /**
   * Structural equality over expression trees. Two expressions are equal
   * when their trees match node for node — including constant units and
   * precision annotations, which affect serialization. Expression trees are
   * ordered syntax: `add(a, b)` and `add(b, a)` are not equal.
   *
   * @param self - The first expression.
   * @param that - The second expression.
   * @returns `true` if the expressions are structurally equal.
   * @since 0.1.0
   */
  (self: Calc<string, Kind, unknown>, that: Calc<string, Kind, unknown>): boolean
} = internal.equals
