import type { ContextFree, UnitContext } from '#data/units'
import type { Pipeable } from '#util'
import type { CalcTypeId } from './calc.internal.ts'
import * as internal from './calc.internal.ts'
import type { Precision } from './precision.ts'

declare const CalcVariance: unique symbol
declare const IdentId: unique symbol

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
 * The leaf brand of a bare CSS identifier — a token like a relative color's
 * `l` that serializes as itself and is resolved by the CSS construct around
 * it, not read from the cascade. It rides the `Leaves` parameter of `Calc`,
 * so `solve` demands a value for the token through the `idents` section of
 * its options, the way a relative unit demands a ratio through `units`.
 *
 * Constructs that introduce identifiers refine this brand: the `Channel`
 * keywords (`Channel.L`, ...) carry a subtype scoped to their color space,
 * and `Color.from` admits them by that subtype. Generic machinery — the
 * solve options, `idents` — keys on this base, so every identifier source
 * is covered without new plumbing.
 *
 * @since 0.2.0
 */
export interface Ident<Name extends string = string> {
  readonly [IdentId]: Name
}

/**
 * A CSS value expression: a tree of constants, unbound variables, and math
 * operations that can be solved to a number, serialized to CSS `calc()`
 * text, or partially bound and passed along.
 *
 * Three type parameters track the expression structurally:
 *
 * - `Vars` — the unbound variable names. `var('u')` is a `Calc<'u'>`;
 *   combining expressions unions their variables; `bind` subtracts the
 *   names it binds. A fully bound (or constant) expression is a
 *   `Calc<never>`.
 * - `Kind` — the CSS dimension (`'number'` by default, or `'length'` /
 *   `'angle'`). `add`/`subtract` require a shared kind; `multiply` and
 *   `divide` combine kinds (a `<length>` over a `<length>` is a
 *   `<number>`); an invalid pairing (a `<length>` plus a `<number>`) is a
 *   type error.
 * - `Leaves` — the solve-relevant leaves the tree contains: `Unit` brands
 *   for its dimensioned constants and `Ident` brands for its bare
 *   identifiers (`never` when it has neither). It types the `units` and
 *   `idents` sections of the options `solve` needs to lower the tree to a
 *   number.
 *
 * Values are immutable and structurally comparable via `equals`.
 * Construction folds constant subtrees eagerly: `add(1, 2)` is the
 * constant `3`, and binding every variable of a tree collapses it to a
 * constant.
 *
 * An unbound variable serializes as `var(--name)` — the read side of a CSS
 * custom property.
 *
 * Construct via `of`, `var`, the `Length`/`Angle` constructors in
 * `fashionable/data`, and the math combinators.
 *
 * @since 0.1.0
 */
export interface Calc<
  out Vars extends string = string,
  out K extends Kind = 'number',
  out Leaves = never,
> extends Pipeable {
  readonly [CalcTypeId]: CalcTypeId
  readonly [CalcVariance]?: { readonly vars: Vars; readonly kind: K; readonly leaves: Leaves }
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
// kind/leaf algebra the combinator signatures below are built from.
// ---------------------------------------------------------------------------

/** Any operand a combinator accepts: an expression of any kind, or a bare number. */
type In = Top | number

type VarsOf<A> = A extends Calc<infer V, Kind, unknown> ? V : never
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

type VarsOfAll<T extends ReadonlyArray<unknown>> = { [K in keyof T]: VarsOf<T[K]> }[number]
type LeavesOfAll<T extends ReadonlyArray<unknown>> = { [K in keyof T]: LeavesOf<T[K]> }[number]

// same-single-unit division cancels to a unit-free number; anything else keeps
// both operands' leaves (conservative, but sound)
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
// Cancellation is sound only where eager folding guarantees the division
// folds once bound: same-single-unit constants always do, ident leaves never
// do (an `Ident` is not a constant), and a number-kind divisor can itself
// carry leaves (`divide(vw, px)` is a number), so its leaves always survive.
type DivLeaves<A, B> =
  KindOf<B> extends 'number'
    ? LeavesOf<A> | LeavesOf<B>
    : SameSingleton<LeavesOf<A>, LeavesOf<B>> extends true
      ? [Extract<LeavesOf<A>, Ident<string>>] extends [never]
        ? never
        : LeavesOf<A> | LeavesOf<B>
      : LeavesOf<A> | LeavesOf<B>

/**
 * A value accepted where an expression is expected: an existing `Calc` or
 * a bare number, which is coerced to an unannotated constant.
 *
 * @since 0.1.0
 */
export type Input<Vars extends string = string> = Calc<Vars> | number

/**
 * A bindings record: variable names to the values that replace them. A
 * value may itself be an expression, whose own variables join the result.
 *
 * @since 0.1.0
 */
export type Bindings<Vars extends string = string> = Record<Vars, Input>

type ValueVars<V> = V extends Calc<infer R> ? R : never

type BindingVars<T> = T extends Record<string, infer V> ? ValueVars<V> : never

/**
 * The variable names remaining after applying the bindings `B` to an
 * expression with variables `Vars`: bound names are removed, and the
 * variables of any expression-valued bindings are added.
 *
 * @since 0.1.0
 */
export type ApplyBindings<Vars extends string, B> =
  | Exclude<Vars, keyof B & string>
  | BindingVars<Pick<B, Extract<keyof B, Vars>>>

/**
 * Options for `serialize`.
 *
 * @since 0.1.0
 */
export interface SerializeOptions<Vars extends string = string> {
  /**
   * Bindings applied before rendering. May be partial: variables left
   * unbound render as `var(--name)`.
   */
  readonly bindings?: Partial<Bindings<Vars>>
  /**
   * The precision for constants that carry no annotation of their own.
   * Defaults to `Precision.decimals(5)`.
   */
  readonly precision?: Precision
}

type IdentName<I> = I extends Ident<infer Name> ? Name : never

/**
 * The `idents` section of `SolveOptions`: a numeric value for each
 * bare-identifier token in the leaves `L`. The value is the token's own —
 * read directly, not multiplied as a ratio — so `{ l: 0.62 }` supplies the
 * relative-color `l` keyword.
 *
 * @since 0.4.0
 */
export type IdentValues<L> = {
  readonly [K in IdentName<Extract<L, Ident<string>>> & string]: number
}

/**
 * Options for `solve`: the environments that satisfy an expression's
 * dependency channels. Each section is required exactly when the
 * expression's type demands it — `bindings` while unbound variables remain,
 * `units` while a relative unit or percentage is present, `idents` while a
 * bare identifier is — and optional otherwise.
 *
 * - `bindings` — a closed value (a number or a `Calc<never>`) for every
 *   unbound variable. Substitution, as in `bind`, but total: a value
 *   carrying its own unbound variables is a type error here, since nothing
 *   later could close it.
 * - `units` — a pixels-per-unit ratio for every context-dependent unit:
 *   `vw` is `sampleWidth / 100`, `%` is `basis / 100`. Absolute lengths
 *   default (`px` is `1`) unless overridden; angles never appear (radians
 *   and degrees lower on their own).
 * - `idents` — the value each bare-identifier token stands for
 *   (`{ l: 0.62 }`).
 *
 * @since 0.4.0
 */
export type SolveOptions<Vars extends string, L> = ([Vars] extends [never]
  ? { readonly bindings?: Record<string, Input<never>> }
  : { readonly bindings: Record<Vars, Input<never>> }) &
  ([Exclude<L, ContextFree | Ident<string>>] extends [never]
    ? { readonly units?: UnitContext<L> }
    : { readonly units: UnitContext<L> }) &
  ([Extract<L, Ident<string>>] extends [never]
    ? { readonly idents?: IdentValues<L> }
    : { readonly idents: IdentValues<L> })

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
 * Calc.serialize(Calc.multiply(k, Calc.var('t'))) // 'calc(0.837758041 * var(--t))'
 * ```
 * @since 0.1.0
 */
export const of: (value: number, precision?: Precision) => Calc<never> = internal.of

/**
 * Creates a read of a CSS variable (custom property): `var('width')`
 * serializes as `var(--width)`. Variables are the substitutable dependency
 * channel — `bind` replaces them with values or other expressions, and an
 * expression's `Vars` parameter tracks the names still unbound. Exported as
 * `var` (`Calc.var('width')`) because `var` is reserved in declaration
 * position.
 *
 * Repeated calls with the same name return the same instance.
 *
 * @param name - The variable name, without the `--` prefix. Must be non-empty.
 * @returns A `Calc` with `name` as its one unbound variable.
 * @throws `Error` when `name` is empty.
 * @example
 * ```ts
 * Calc.serialize(Calc.var('width')) // 'var(--width)'
 * ```
 * @since 0.1.0
 */
const _var: <Name extends string>(name: Name) => Calc<Name> = internal.ref
export { _var as var }

/**
 * Adds expressions. Constant operands fold at construction.
 *
 * Serializes as `a + b + ...` inside a `calc()` wrapper; negative constant
 * terms (and products led by a negative constant) render subtractively:
 * `a + (-2)` serializes as `a - 2`.
 *
 * @param a - The first operand.
 * @param b - The second operand.
 * @returns The sum, with the operands' variables unioned.
 * @example
 * ```ts
 * Calc.serialize(Calc.add(Calc.var('x'), 10)) // 'calc(var(--x) + 10)'
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
  VarsOf<A> | VarsOf<B> | VarsOfAll<Rest>,
  KindOf<A> & Kind,
  LeavesOf<A> | LeavesOf<B> | LeavesOfAll<Rest>
> = internal.add

/**
 * Subtracts `right` from `left`. Constant operands fold at construction.
 *
 * @param left - The minuend.
 * @param right - The subtrahend.
 * @returns The difference, with the operands' variables unioned.
 * @since 0.1.0
 */
export const subtract: <A extends In, B extends SameKindIn<A>>(
  left: A,
  right: B,
) => Calc<VarsOf<A> | VarsOf<B>, KindOf<A> & Kind, LeavesOf<A> | LeavesOf<B>> = internal.subtract

/**
 * The CSS `mod()` of `dividend` and `divisor` — the remainder that takes the
 * sign of the divisor (the floored modulo), so `mod(x, 360)` lands in
 * `[0, 360)` for a positive divisor. Same-kind operands, as `subtract`;
 * constant operands fold at construction.
 *
 * @param dividend - The value to reduce.
 * @param divisor - The modulus, sharing `dividend`'s kind.
 * @returns The modulo, with the operands' variables unioned.
 * @example
 * ```ts
 * Calc.serialize(Calc.mod(Calc.var('h'), 360)) // 'mod(var(--h), 360)'
 * ```
 * @since 0.2.0
 */
export const mod: <A extends In, B extends SameKindIn<A>>(
  dividend: A,
  divisor: B,
) => Calc<VarsOf<A> | VarsOf<B>, KindOf<A> & Kind, LeavesOf<A> | LeavesOf<B>> = internal.mod

/**
 * Multiplies expressions. Constant operands fold at construction.
 *
 * Addition and subtraction operands are parenthesized when serialized
 * under a product: `(a + b) * c`.
 *
 * @param left - The first factor.
 * @param right - The second factor.
 * @returns The product, with the operands' variables unioned.
 * @since 0.1.0
 */
export const multiply: {
  <A extends NumberIn, B extends In>(
    left: A,
    right: B,
  ): Calc<VarsOf<A> | VarsOf<B>, KindOf<B> & Kind, LeavesOf<A> | LeavesOf<B>>
  <A extends In, B extends NumberIn>(
    left: A,
    right: B,
  ): Calc<VarsOf<A> | VarsOf<B>, KindOf<A> & Kind, LeavesOf<A> | LeavesOf<B>>
} = internal.multiply

/**
 * Divides `left` by `right`. Constant operands fold at construction.
 *
 * @param left - The dividend.
 * @param right - The divisor.
 * @returns The quotient, with the operands' variables unioned.
 * @since 0.1.0
 */
export const divide: {
  <A extends In, B extends NumberIn>(
    left: A,
    right: B,
  ): Calc<VarsOf<A> | VarsOf<B>, KindOf<A> & Kind, DivLeaves<A, B>>
  <A extends In, B extends SameKindIn<A>>(
    left: A,
    right: B,
  ): Calc<VarsOf<A> | VarsOf<B>, 'number', DivLeaves<A, B>>
} = internal.divide

/**
 * Raises `base` to `exponent`. Serializes as the CSS `pow()` function,
 * whose operands are `<number>`s — so both take number-kind expressions,
 * which may carry identifier leaves (`pow(l, 2.2)` gamma-adjusts a
 * relative-color channel).
 *
 * @param base - The base.
 * @param exponent - The exponent.
 * @returns The power, with the operands' variables unioned.
 * @since 0.1.0
 */
export const pow: <A extends NumberIn, B extends NumberIn>(
  base: A,
  exponent: B,
) => Calc<VarsOf<A> | VarsOf<B>, 'number', LeavesOf<A> | LeavesOf<B>> = internal.pow

/**
 * Sign-preserving power: `abs(base) ^ exponent * sign(base)`. Unlike
 * `pow`, well-defined for negative bases with fractional exponents.
 * Serializes as `pow(abs(base), exponent) * sign(base)`.
 *
 * @param base - The base.
 * @param exponent - The exponent.
 * @returns The signed power, with the operands' variables unioned.
 * @since 0.1.0
 */
export const signedPow: <A extends NumberIn, B extends NumberIn>(
  base: A,
  exponent: B,
) => Calc<VarsOf<A> | VarsOf<B>, 'number', LeavesOf<A> | LeavesOf<B>> = internal.signedPow

/**
 * The minimum of the operands. Serializes as the CSS `min()` function.
 *
 * @param a - The first operand.
 * @param b - The second operand.
 * @returns The minimum, with the operands' variables unioned.
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
  VarsOf<A> | VarsOf<B> | VarsOfAll<Rest>,
  KindOf<A> & Kind,
  LeavesOf<A> | LeavesOf<B> | LeavesOfAll<Rest>
> = internal.min

/**
 * The maximum of the operands. Serializes as the CSS `max()` function.
 *
 * @param a - The first operand.
 * @param b - The second operand.
 * @returns The maximum, with the operands' variables unioned.
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
  VarsOf<A> | VarsOf<B> | VarsOfAll<Rest>,
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
 * @returns The clamped expression, with the operands' variables unioned.
 * @example
 * ```ts
 * Calc.serialize(Calc.clamp(-1, Calc.var('u'), 1)) // 'clamp(-1, var(--u), 1)'
 * ```
 * @since 0.1.0
 */
export const clamp: <A extends In, B extends SameKindIn<A>, C extends SameKindIn<A>>(
  minimum: A,
  value: B,
  maximum: C,
) => Calc<
  VarsOf<A> | VarsOf<B> | VarsOf<C>,
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
 * @returns The interpolated expression, with the operands' variables unioned.
 * @since 0.1.0
 */
export const lerp: {
  <A extends In, B extends SameKindIn<A>, T extends NumberIn>(
    a: A,
    b: B,
    t: T,
  ): Calc<
    VarsOf<A> | VarsOf<B> | VarsOf<T>,
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
  <A extends In>(argument: A): Calc<VarsOf<A>, KindOf<A> & Kind, LeavesOf<A>>
} = internal.abs

/**
 * The sign (`-1`, `0`, or `1`). Serializes as the CSS `sign()` function,
 * which accepts a calculation of any dimension and returns a `<number>` —
 * so any operand kind is accepted here.
 *
 * @param argument - The operand, of any kind.
 * @returns The sign, a `<number>`, carrying the operand's leaves.
 * @since 0.1.0
 */
export const sign: {
  <A extends In>(argument: A): Calc<VarsOf<A>, 'number', LeavesOf<A>>
} = internal.sign

/**
 * The sine of its argument. Serializes as the CSS `sin()` function, which
 * accepts an `<angle>` or a plain number treated as radians — so this takes
 * either an angle-kind expression or a number, and returns a number.
 *
 * @param argument - An angle, or a plain number in radians.
 * @returns The sine, a `<number>`, carrying the argument's leaves.
 * @since 0.1.0
 */
export const sin: {
  <A extends NumberOrAngleIn>(argument: A): Calc<VarsOf<A>, 'number', LeavesOf<A>>
} = internal.sin

/**
 * The cosine of its argument. Serializes as the CSS `cos()` function, which
 * accepts an `<angle>` or a plain number treated as radians — so this takes
 * either an angle-kind expression or a number, and returns a number.
 *
 * @param argument - An angle, or a plain number in radians.
 * @returns The cosine, a `<number>`, carrying the argument's leaves.
 * @since 0.1.0
 */
export const cos: {
  <A extends NumberOrAngleIn>(argument: A): Calc<VarsOf<A>, 'number', LeavesOf<A>>
} = internal.cos

/**
 * The tangent of its argument. Serializes as the CSS `tan()` function, which
 * accepts an `<angle>` or a plain number treated as radians. Paired with
 * `atan2`, `tan(atan2(a, b))` divides two same-kind dimensions to a `<number>` —
 * the length ratio that works where `a / b` does not, since Firefox does not
 * yet support `<length> / <length>` in `calc()`.
 *
 * @param argument - An angle, or a plain number in radians.
 * @returns The tangent, a `<number>`, carrying the argument's leaves.
 * @since 0.2.0
 */
export const tan: {
  <A extends NumberOrAngleIn>(argument: A): Calc<VarsOf<A>, 'number', LeavesOf<A>>
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
 * @returns The arccosine, an `<angle>`, carrying the argument's leaves.
 * @example
 * ```ts
 * const phase = Angle.rad(2.0943951)
 * Calc.serialize(Calc.cos(Calc.subtract(Calc.divide(Calc.acos(Calc.var('u')), 3), phase)))
 * // 'cos(acos(var(--u)) / 3 - 2.0944rad)'
 * ```
 * @since 0.1.0
 */
export const acos: {
  <A extends NumberIn>(argument: A): Calc<VarsOf<A>, 'angle', LeavesOf<A>>
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
 * @returns The angle, an `<angle>`, with the operands' leaves unioned.
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
  ): Calc<VarsOf<A> | VarsOf<B>, 'angle', LeavesOf<A> | LeavesOf<B>>
} = internal.atan2

export const bind: {
  /**
   * Returns a function that binds the given names in an expression.
   *
   * @param bindings - Variable names to values or expressions. Names the expression does not read are ignored, as are `undefined` values.
   * @returns A function replacing bound variables in its argument.
   * @since 0.1.0
   */
  <const B extends Bindings>(
    bindings: B,
  ): <Vars extends string>(expr: Calc<Vars>) => Calc<ApplyBindings<Vars, B>>
  /**
   * Replaces variables with values or other expressions. Binding is
   * partial evaluation: substituted subtrees re-fold, so binding every
   * variable collapses the tree to a constant.
   *
   * Names the expression does not read are ignored (spreading a wider
   * bindings object is fine), as are `undefined` values. Binding a
   * variable to another expression composes trees; the bound expression's
   * own variables join the result, tracked in the return type by
   * `ApplyBindings`.
   *
   * @param expr - The expression to bind.
   * @param bindings - Variable names to values or expressions.
   * @returns The bound expression.
   * @example
   * ```ts
   * const half = Calc.bind(Calc.divide(Calc.var('x'), 2), { x: Calc.var('width') })
   * Calc.serialize(half) // 'calc(var(--width) / 2)'
   * Calc.solve(Calc.bind(half, { width: 100 })) // 50
   * ```
   * @since 0.1.0
   */
  <Vars extends string, const B extends Bindings>(
    expr: Calc<Vars>,
    bindings: B,
  ): Calc<ApplyBindings<Vars, B>>
} = internal.bind

export const solve: {
  /**
   * Evaluates a closed expression to a number. Absolute lengths (`px`) and
   * angles (radians and degrees) lower with no options; an unbound
   * variable, a relative unit, a percentage, or a bare identifier needs the
   * options overload.
   *
   * @param expr - The expression. No unbound variables, only context-free units.
   * @returns The numeric value.
   * @throws `Error` when unbound variables or unresolvable leaves remain at runtime.
   * @since 0.1.0
   */
  (expr: Calc<never, Kind, ContextFree>): number
  /**
   * Applies bindings, lowers each unit and identifier through the matching
   * options section, then evaluates to a number. `SolveOptions` requires
   * each section exactly when the expression's type demands it: `bindings`
   * while variables are unbound, `units` while a relative unit or
   * percentage is present, `idents` while a bare identifier is.
   *
   * @param expr - The expression to evaluate.
   * @param options - The bindings, unit ratios, and identifier values the expression needs.
   * @returns The numeric value.
   * @throws `Error` when unbound variables remain after binding, or a unit or identifier has no entry at runtime.
   * @example
   * ```ts
   * Calc.solve(Calc.lerp(Calc.var('a'), Calc.var('b'), 0.5), { bindings: { a: 0, b: 10 } }) // 5
   * const position = Calc.divide(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160))
   * Calc.solve(position, { units: { vw: 1280 / 100 } }) // 6
   * Calc.solve(Calc.multiply(Channel.L, 0.8), { idents: { l: 0.62 } }) // 0.496
   * ```
   * @since 0.1.0
   */
  <Vars extends string, L>(expr: Calc<Vars, Kind, L>, options: SolveOptions<Vars, L>): number
} = internal.solve

/**
 * Renders an expression as CSS text. Arithmetic gets a `calc()` wrapper;
 * function forms (`min`, `clamp`, `sin`, ...) and leaves stand alone.
 * Variables render as `var(--name)`.
 *
 * Bindings in `options` are applied first and may be partial — this is
 * the serialize half of the solve/serialize duality, and unbound
 * variables are the values left for the browser. Constants render with
 * their annotated precision, or the context `precision` option (default
 * `Precision.decimals(5)`). Constants equal to pi render as the CSS
 * constant `pi` where a math function surrounds them.
 *
 * @param expr - The expression to render.
 * @param options - Optional bindings and precision context.
 * @returns Deterministic CSS text.
 * @example
 * ```ts
 * const fluid = Calc.add(10, Calc.var('runtime'))
 * Calc.serialize(fluid) // 'calc(10 + var(--runtime))'
 * Calc.serialize(fluid, { bindings: { runtime: 4 } }) // '14'
 * ```
 * @since 0.1.0
 */
export const serialize: <Vars extends string>(
  expr: Calc<Vars, Kind, unknown>,
  options?: SerializeOptions<Vars>,
) => string = internal.serialize

/**
 * The expression's unbound variable names.
 *
 * @param expr - The expression to inspect.
 * @returns The set of unbound variable names.
 * @since 0.1.0
 */
export const vars: <Vars extends string>(expr: Calc<Vars, Kind, unknown>) => ReadonlySet<Vars> =
  internal.refs

/**
 * The bare-identifier tokens the expression reads — leaves that serialize
 * as themselves (`l`, not `var(--l)`) and are resolved by the CSS construct
 * around them, the `Channel` keywords being the only source today. Empty
 * for an expression with none.
 *
 * The runtime mirror of the `Ident` brands in `Leaves`: it reports which
 * values the `idents` section of `solve`'s options must supply, exactly as
 * `vars` reports what `bindings` must — and, unlike the type parameter, it
 * survives on a `Calc<Vars, Kind, unknown>` whose leaves have been erased.
 * Identifiers are not variables, so `vars` never lists them and they never
 * reach a `Stylesheet`'s dependency report.
 *
 * @param expr - The expression to inspect.
 * @returns The set of bare-identifier tokens the expression reads.
 * @example
 * ```ts
 * Calc.idents(Calc.multiply(Channel.L, 0.8)) // Set { 'l' }
 * Calc.idents(Calc.var('x')) // Set {}
 * ```
 * @since 0.2.0
 */
export const idents: (expr: Calc<string, Kind, unknown>) => ReadonlySet<string> = internal.idents

/**
 * The unit tokens the expression's dimensioned constants carry (`'vw'`,
 * `'px'`, `'%'`). Empty for a unit-free expression.
 *
 * The runtime mirror of the `Unit` brands in `Leaves`: it reports which
 * ratios the `units` section of `solve`'s options may need to supply, and —
 * unlike the type parameter — it survives on a `Calc<Vars, Kind, unknown>`
 * whose leaves have been erased. Context-free units (`px`, `rad`, `deg`)
 * are reported too; they lower with no entry.
 *
 * @param expr - The expression to inspect.
 * @returns The set of unit tokens the expression's constants carry.
 * @example
 * ```ts
 * Calc.units(Calc.subtract(Length.vw(100), Length.px(320))) // Set { 'vw', 'px' }
 * ```
 * @since 0.4.0
 */
export const units: (expr: Calc<string, Kind, unknown>) => ReadonlySet<string> = internal.units

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
