import type { Unit } from '#data'
import type { Pipeable } from '#util'
import type { Var } from '#var'
import type { CalcTypeId } from './calc.internal.ts'
import * as internal from './calc.internal.ts'
import type { Precision } from './precision.ts'

declare const CalcVariance: unique symbol
declare const IdentId: unique symbol

/**
 * The CSS dimension vocabulary: `<number>`, `<length>`, `<angle>`, or
 * `<percentage>`. The algebra itself runs on `Result` unit brands compared by
 * `Unit.Family` — CSS type-checks `calc()` at this dimension level, and the
 * family comparison implements exactly that — so `Kind` remains as the prose
 * and runtime vocabulary: dimensioned constants carry it, and the docs speak
 * it. A `<percentage>` is its own dimension, not a length: it adds only to
 * another percentage — unless the expression is anchored on a
 * `<length-percentage>` value (a `Var.lengthPercentage` read, or
 * `LengthPercentage.of`), which admits both families (see `docs/design.md`).
 *
 * @since 0.2.0
 */
export type Kind = 'number' | 'length' | 'angle' | 'percentage'

/**
 * The leaf brand of a bare CSS identifier — a token like a relative color's
 * `l` that serializes as itself and is resolved by the CSS construct around
 * it, not read from the cascade. It rides the `Requires` parameter of `Calc`,
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
 * - `Vars` — the identities of the custom-property reads still unbound,
 *   as `Var` values from `fashionable/var`: `var('u')` is a
 *   `Calc<Var<'u'>>`. Combining expressions unions their reads; `bind`
 *   subtracts the names it binds. A fully bound (or constant) expression
 *   is a `Calc<never>`. Names stay the value-level currency — binding
 *   records are keyed by bare name, and `vars` reports names — while the
 *   phantom carries the identities.
 * - `Result` — what the expression produces, as a set of `Unit` brands:
 *   `Unit.Px` for a pure pixel length, `Unit.Px | Unit.Vw` for a mixed sum
 *   (a composition, not an uncertainty), `Unit.None` for a `<number>`. The
 *   algebra enforces the CSS dimension rules through it — same-family
 *   addition, family-merging multiplication, same-family division producing
 *   `Unit.None` — so a `<length>` plus a `<number>` is a type error.
 * - `Requires` — what stands between the expression and a number: the unit
 *   ratios and identifier values the matching sections of `solve`'s options
 *   must supply (`never` when nothing is needed). Absolute units ride it
 *   with default supplies — `px`, `rad`, and `deg` demand no entry.
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
  out Vars extends Var.Any = Var.Any,
  out Result = Unit.None,
  out Requires = never,
> extends Pipeable {
  readonly [CalcTypeId]: CalcTypeId
  readonly [CalcVariance]?: {
    readonly vars: Vars
    readonly result: Result
    readonly requires: Requires
  }
}

/**
 * The widest `Calc` — the supertype every expression extends, used to
 * constrain a combinator operand before its facets are extracted.
 *
 * @since 0.2.0
 */
export type Top = Calc<Var.Any, Unit.Any, unknown>

// ---------------------------------------------------------------------------
// combinator type machinery (internal): facet extractors and the family/
// requirement algebra the combinator signatures below are built from.
// Validated by the Result spike recorded in docs/result-calc.md.
// ---------------------------------------------------------------------------

/** Any operand a combinator accepts: an expression of any dimension, or a bare number. */
type In = Top | number

type VarsOf<A> = A extends Calc<infer X, Unit.Any, unknown> ? X : never
type ResultOf<A> = A extends Calc<Var.Any, infer R, unknown> ? R : Unit.None
type RequiresOf<A> = A extends Calc<Var.Any, Unit.Any, infer Q> ? Q : never

/** An operand constrained to number-result (or a bare number). */
type NumberIn = number | Calc<Var.Any, Unit.None, unknown>

/** An operand accepted by `sin`/`cos`: a plain number (radians) or an angle. */
type NumberOrAngleIn = number | Calc<Var.Any, Unit.None | Unit.Angle, unknown>

/**
 * An operand constrained to `A`'s dimension family — a bare number only when
 * `A` is number-result, so `add(length, 1)` is rejected while
 * `add(length, length)` holds.
 */
type SameKindIn<A> =
  | Calc<Var.Any, Unit.Family<ResultOf<A>>, unknown>
  | (Unit.Family<ResultOf<A>> extends Unit.None ? number : never)

type VarsOfAll<T extends ReadonlyArray<unknown>> = { [K in keyof T]: VarsOf<T[K]> }[number]
type ResultOfAll<T extends ReadonlyArray<unknown>> = { [K in keyof T]: ResultOf<T[K]> }[number]
type RequiresOfAll<T extends ReadonlyArray<unknown>> = {
  [K in keyof T]: RequiresOf<T[K]>
}[number]

// Requirement discharge under division. Cancellation is sound only where eager
// folding guarantees the division folds once bound: same-single-unit constants
// always do, ident leaves never do (an `Ident` is not a constant), and a
// number-result divisor can itself carry requirements (`divide(vw, px)` is a
// number), so its requirements always survive. The Result side needs none of
// this: same-family division is `Unit.None` unconditionally.
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
type DivRequires<A, B> =
  Unit.Family<ResultOf<B>> extends Unit.None
    ? RequiresOf<A> | RequiresOf<B>
    : SameSingleton<RequiresOf<A>, RequiresOf<B>> extends true
      ? [Extract<RequiresOf<A>, Ident<string>>] extends [never]
        ? never
        : RequiresOf<A> | RequiresOf<B>
      : RequiresOf<A> | RequiresOf<B>

/**
 * A value accepted where an expression is expected: an existing `Calc` or
 * a bare number, which is coerced to an unannotated constant.
 *
 * @since 0.1.0
 */
export type Input<Vars extends Var.Any = Var.Any> = Calc<Vars> | number

/**
 * The declared type of the read named `N` in `Vars` — the identity's
 * `Type` slot, recovered per name. `unknown` while the name is undeclared;
 * a union when a name is declared twice (a violation of the one-name,
 * one-type contract, met leniently).
 *
 * @since 0.4.0
 */
export type DeclaredType<Vars extends Var.Any, N extends string> = Var.Type<
  Extract<Vars, Var.Var<N, unknown, unknown>>
>

// The values a binding may supply for a name: the declared type is
// directly the domain — the slot holds the value type — plus the
// bare-number sugar when the family is number. Undeclared names keep the
// unconstrained Input, and so do color-declared ones (a color read is
// never substitutable by bind; see the Color.var docs).
type BindingValue<T> = [unknown] extends [T]
  ? Input
  : T extends Calc<Var.Any, infer R, unknown>
    ?
        | Calc<Var.Any, Unit.Family<R>, unknown>
        | ([Unit.Family<R>] extends [Unit.None] ? number : never)
    : Input

/**
 * A bindings record: bare variable names to the values that replace them.
 * A value may itself be an expression, whose own reads join the result.
 *
 * Keys are names, not `Var` values — names are the value-level currency
 * of the variables channel; the identities live in the `Vars` phantom the
 * record is derived from (mapped over `Var.Name<Vars>`). A declared name
 * types its value: a `Var.length` read binds only to length-family
 * expressions, while undeclared names accept any `Input`.
 *
 * @since 0.1.0
 */
export type Bindings<Vars extends Var.Any = Var.Any> = {
  readonly [N in Var.Name<Vars>]: BindingValue<DeclaredType<Vars, N>>
}

type ValueVars<V> = V extends Calc<infer R> ? R : never

type BindingVars<T> = T extends Record<string, infer V> ? ValueVars<V> : never

/**
 * The read identities remaining after applying the bindings `B` to an
 * expression with reads `Vars`: identities whose names are bound are
 * removed, and the reads of any expression-valued bindings are added.
 *
 * @since 0.1.0
 */
export type ApplyBindings<Vars extends Var.Any, B> =
  | (Vars extends unknown ? (Var.Name<Vars> extends keyof B ? never : Vars) : never)
  | BindingVars<Pick<B, Extract<keyof B, Var.Name<Vars>>>>

type ValueRequires<V> = V extends Calc<Var.Any, Unit.Any, infer Q> ? Q : never
type RecordRequires<T> = T extends Record<string, infer V> ? ValueRequires<V> : never

/**
 * What `bind` accepts for an expression with reads `Vars`: `Bindings`
 * with every name optional (binding may be partial), intersected with a
 * wide index signature so a record sharing no names with the expression
 * stays legal — unread names are ignored, and without the index signature
 * the all-optional record would be a weak type that rejects exactly the
 * spread-a-wider-object usage the contract promises. Present names still
 * check against their declared types through the `Bindings` half.
 *
 * @since 0.4.0
 */
export type PartialBindings<Vars extends Var.Any> = Partial<Bindings<Vars>> & {
  readonly [name: string]: Calc<Var.Any, Unit.Any, unknown> | number | undefined
}

/**
 * The requirements the bindings `B` contribute to an expression with reads
 * `Vars`: the union of the bound values' own `Requires`, over the names
 * the expression actually reads. This is `bind`'s side of the split with
 * `solve` — `bind` is partial evaluation, so a bound `Length.vw(2)` may
 * carry its `vw` requirement into the result, where `solve` is total and
 * accepts only pre-satisfied values (see `docs/vars.md`).
 *
 * @since 0.4.0
 */
export type BindingRequires<Vars extends Var.Any, B> = RecordRequires<
  Pick<B, Extract<keyof B, Var.Name<Vars>>>
>

/**
 * Options for `serialize`.
 *
 * @since 0.1.0
 */
export interface SerializeOptions<Vars extends Var.Any = Var.Any> {
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
 * bare-identifier token in the requirements `R`. The value is the token's
 * own — read directly, not multiplied as a ratio — so `{ l: 0.62 }` supplies
 * the relative-color `l` keyword.
 *
 * @since 0.4.0
 */
export type IdentValues<R> = {
  readonly [K in IdentName<Extract<R, Ident<string>>> & string]: number
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
// A solve binding is total: closed (no reads of its own) and pre-satisfied
// (only `px`/`rad`/`deg` requirements), because `SolveOptions` cannot
// demand ratios for units the bindings introduce — the `units` section's
// type is fixed by the expression's `R` before the bindings beside it are
// seen. Bind first to accumulate requirements, then solve.
type SolveBindingValue<T> = [unknown] extends [T]
  ? Input<never>
  : T extends Calc<Var.Any, infer R, unknown>
    ?
        | Calc<never, Unit.Family<R>, Unit.ContextFree>
        | ([Unit.Family<R>] extends [Unit.None] ? number : never)
    : Input<never>

export type SolveOptions<Vars extends Var.Any, R> = ([Vars] extends [never]
  ? { readonly bindings?: Record<string, Input<never>> }
  : {
      readonly bindings: {
        readonly [N in Var.Name<Vars>]: SolveBindingValue<DeclaredType<Vars, N>>
      }
    }) &
  ([Exclude<R, Unit.ContextFree | Ident<string>>] extends [never]
    ? { readonly units?: Unit.UnitContext<R> }
    : { readonly units: Unit.UnitContext<R> }) &
  ([Extract<R, Ident<string>>] extends [never]
    ? { readonly idents?: IdentValues<R> }
    : { readonly idents: IdentValues<R> })

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
export const isCalc: (u: unknown) => u is Calc<Var.Any, Unit.Any, unknown> = internal.isCalc

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
 * The Result a lifted read produces: its declared type's Result when the
 * declaration is calc-shaped — the trait is the `Result` parameter itself,
 * read structurally — and `Unit.None` while the read is undeclared.
 *
 * @since 0.4.0
 */
export type ReadResult<T> = T extends Calc<Var.Any, infer R, unknown> ? R : Unit.None

// The identities a read contributes to the phantom, flattened: the read's
// own name-and-type pair, then its fallback chain's — a Calc fallback hands
// over its Vars, a nested read recurses, a number contributes nothing.
type ReadVars<V> =
  V extends Var.Var<infer N, infer T, infer F> ? Var.Var<N, T> | ReadFallbackVars<F> : never
type ReadFallbackVars<F> =
  F extends Calc<infer W, Unit.Any, unknown> ? W : F extends Var.Any ? ReadVars<F> : never

// The lift's admission rules, as a guard the read parameter intersects:
// `unknown` (a no-op) for a valid read, a string-literal error type
// otherwise, so the compile error names the rule that failed. A constraint
// cannot carry these rules — the `Type` slot's top is `unknown`, so every
// declared read is assignable wherever an undeclared one is (that
// covariance is the typed-handle forward-compat), and admission must be
// checked, not bounded. `docs/vars.md` section 8 records the derivation.
type ReadGuard<V> =
  V extends Var.Var<string, infer T, infer F>
    ? [unknown] extends [T]
      ? FallbackGuard<F, Unit.None>
      : T extends Calc<Var.Any, Unit.Any, unknown>
        ? FallbackGuard<F, Unit.Family<ReadResult<T>>>
        : 'this read is declared outside calc: a color-typed read lifts with Color.var'
    : never

// A fallback must land in the read's family: it substitutes where the read
// does, so a differently-dimensioned fallback would hand the surrounding
// tree a value the algebra rejected everywhere else.
type FallbackGuard<F, Fam> = [F] extends [undefined]
  ? unknown
  : F extends number
    ? [Fam] extends [Unit.None]
      ? unknown
      : 'a bare-number fallback fits only a number-result read'
    : F extends Calc<Var.Any, infer R, unknown>
      ? [Unit.Family<R>] extends [Fam]
        ? unknown
        : "this fallback's family does not match the read's declared type"
      : F extends Var.Var<string, infer T2, infer F2>
        ? [unknown] extends [T2]
          ? [Unit.None] extends [Fam]
            ? FallbackGuard<F2, Fam>
            : "an undeclared nested read is number-result; declare it to match the outer read's family"
          : T2 extends Calc<Var.Any, Unit.Any, unknown>
            ? [Unit.Family<ReadResult<T2>>] extends [Fam]
              ? FallbackGuard<F2, Fam>
              : "a nested read's declared family must match the outer read's"
            : 'a color-typed read cannot fall back inside calc'
        : 'a calc fallback is a number, a Calc expression, or a Var read'

const _var: {
  /**
   * Creates a read of a CSS variable (custom property): `var('width')`
   * serializes as `var(--width)`. Variables are the substitutable
   * dependency channel — `bind` replaces them with values or other
   * expressions, and an expression's `Vars` parameter tracks the reads
   * still unbound. Exported as `var` (`Calc.var('width')`) because `var`
   * is reserved in declaration position.
   *
   * Sugar for the read overload: `Calc.var('width')` is
   * `Calc.var(Var.of('width'))`. Repeated calls with the same name return
   * the same instance.
   *
   * @param name - The variable name, without the `--` prefix. Must be non-empty.
   * @returns A `Calc` reading `name`, its one unbound variable.
   * @throws `Error` when `name` is empty.
   * @example
   * ```ts
   * Calc.serialize(Calc.var('width')) // 'var(--width)'
   * ```
   * @since 0.1.0
   */
  <Name extends string>(name: Name): Calc<Var.Var<Name>>
  /**
   * Lifts a `Var` read into an expression. The read's declared type sets
   * the expression's Result: a `Var.length` read is a length-family
   * expression that composes through the ordinary dimension algebra, an
   * undeclared read is a `<number>` as before, and a color-typed read is
   * rejected — it lifts with `Color.var`.
   *
   * A fallback-carrying read renders its fallback (`var(--gap, 8)`),
   * which must land in the read's family: a bare number only under a
   * number-result read, a `Calc` of the declared family (rendered under
   * the normal rules, so arithmetic gets a nested `calc()` wrapper), or
   * another read of the same family, recursively. Anything else is a type
   * error at this lift, backed by a runtime check on the world (family
   * fidelity within calc is the type level's job alone, as everywhere
   * else in the algebra).
   *
   * The returned expression's `Vars` unions the read's identity with its
   * fallback chain's, flattened — `var(--x, var(--y))` is a
   * `Calc<Var<'x'> | Var<'y'>>`, and both names join the dependency
   * report. Binding the read's own name replaces the whole read and
   * discards the fallback; a fallback never reduces what `solve`
   * requires (see `docs/vars.md`).
   *
   * @param read - The read to lift, from `Var.of` or a typed constructor (optionally through `Var.fallback`).
   * @returns A `Calc` of the read's declared family, with its fallback chain's reads unioned in.
   * @throws `Error` when the read is color-declared, or its fallback chain holds anything but numbers, `Calc` expressions, and reads.
   * @example
   * ```ts
   * const gap = Var.length('gap')
   * Calc.serialize(Calc.add(Calc.var(gap), Length.px(4))) // 'calc(var(--gap) + 4px)'
   * ```
   * @since 0.4.0
   */
  <V extends Var.Any>(read: V & ReadGuard<V>): Calc<ReadVars<V>, ReadResult<Var.Type<V>>, never>
} = internal.ref
export { _var as var }

/**
 * Adds expressions. Constant operands fold at construction.
 *
 * Serializes as `a + b + ...` inside a `calc()` wrapper; negative constant
 * terms (and products led by a negative constant) render subtractively:
 * `a + (-2)` serializes as `a - 2`.
 *
 * @param a - The first operand.
 * @param b - The second operand, sharing `a`'s dimension.
 * @returns The sum, with the operands' variables, results, and requirements unioned.
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
  ResultOf<A> | ResultOf<B> | ResultOfAll<Rest>,
  RequiresOf<A> | RequiresOf<B> | RequiresOfAll<Rest>
> = internal.add

/**
 * Subtracts `right` from `left`. Constant operands fold at construction.
 *
 * @param left - The minuend.
 * @param right - The subtrahend, sharing `left`'s dimension.
 * @returns The difference, with the operands' variables, results, and requirements unioned.
 * @since 0.1.0
 */
export const subtract: <A extends In, B extends SameKindIn<A>>(
  left: A,
  right: B,
) => Calc<VarsOf<A> | VarsOf<B>, ResultOf<A> | ResultOf<B>, RequiresOf<A> | RequiresOf<B>> =
  internal.subtract

/**
 * The CSS `mod()` of `dividend` and `divisor` — the remainder that takes the
 * sign of the divisor (the floored modulo), so `mod(x, 360)` lands in
 * `[0, 360)` for a positive divisor. Same-dimension operands, as `subtract`;
 * constant operands fold at construction.
 *
 * @param dividend - The value to reduce.
 * @param divisor - The modulus, sharing `dividend`'s dimension.
 * @returns The modulo, with the operands' variables, results, and requirements unioned.
 * @example
 * ```ts
 * Calc.serialize(Calc.mod(Calc.var('h'), 360)) // 'mod(var(--h), 360)'
 * ```
 * @since 0.2.0
 */
export const mod: <A extends In, B extends SameKindIn<A>>(
  dividend: A,
  divisor: B,
) => Calc<VarsOf<A> | VarsOf<B>, ResultOf<A> | ResultOf<B>, RequiresOf<A> | RequiresOf<B>> =
  internal.mod

/**
 * Multiplies expressions. One factor must be a `<number>`; the dimensioned
 * factor's result rides through. Constant operands fold at construction.
 *
 * Addition and subtraction operands are parenthesized when serialized
 * under a product: `(a + b) * c`.
 *
 * @param left - The first factor.
 * @param right - The second factor.
 * @returns The product, carrying the dimensioned factor's result and both operands' variables and requirements.
 * @since 0.1.0
 */
export const multiply: {
  <A extends NumberIn, B extends In>(
    left: A,
    right: B,
  ): Calc<VarsOf<A> | VarsOf<B>, ResultOf<B>, RequiresOf<A> | RequiresOf<B>>
  <A extends In, B extends NumberIn>(
    left: A,
    right: B,
  ): Calc<VarsOf<A> | VarsOf<B>, ResultOf<A>, RequiresOf<A> | RequiresOf<B>>
} = internal.multiply

/**
 * Divides `left` by `right`. Constant operands fold at construction.
 *
 * Dividing by a `<number>` keeps the dividend's result; dividing two
 * same-dimension expressions produces a `<number>` (`Unit.None`) — the
 * units cancel. The requirements discharge only where folding guarantees
 * they can: a same-single-unit division always folds once bound, so its
 * requirement drops; anything mixed keeps both operands'.
 *
 * @param left - The dividend.
 * @param right - The divisor: a number, or an expression sharing `left`'s dimension.
 * @returns The quotient, with the operands' variables unioned.
 * @since 0.1.0
 */
export const divide: {
  <A extends In, B extends NumberIn>(
    left: A,
    right: B,
  ): Calc<VarsOf<A> | VarsOf<B>, ResultOf<A>, DivRequires<A, B>>
  <A extends In, B extends SameKindIn<A>>(
    left: A,
    right: B,
  ): Calc<VarsOf<A> | VarsOf<B>, Unit.None, DivRequires<A, B>>
} = internal.divide

/**
 * Raises `base` to `exponent`. Serializes as the CSS `pow()` function,
 * whose operands are `<number>`s — so both take number-result expressions,
 * which may carry identifier requirements (`pow(l, 2.2)` gamma-adjusts a
 * relative-color channel).
 *
 * @param base - The base.
 * @param exponent - The exponent.
 * @returns The power, a `<number>`, with the operands' variables and requirements unioned.
 * @since 0.1.0
 */
export const pow: <A extends NumberIn, B extends NumberIn>(
  base: A,
  exponent: B,
) => Calc<VarsOf<A> | VarsOf<B>, Unit.None, RequiresOf<A> | RequiresOf<B>> = internal.pow

/**
 * Sign-preserving power: `abs(base) ^ exponent * sign(base)`. Unlike
 * `pow`, well-defined for negative bases with fractional exponents.
 * Serializes as `pow(abs(base), exponent) * sign(base)`.
 *
 * @param base - The base.
 * @param exponent - The exponent.
 * @returns The signed power, a `<number>`, with the operands' variables and requirements unioned.
 * @since 0.1.0
 */
export const signedPow: <A extends NumberIn, B extends NumberIn>(
  base: A,
  exponent: B,
) => Calc<VarsOf<A> | VarsOf<B>, Unit.None, RequiresOf<A> | RequiresOf<B>> = internal.signedPow

/**
 * The minimum of the operands. Serializes as the CSS `min()` function.
 *
 * @param a - The first operand.
 * @param b - The second operand, sharing `a`'s dimension.
 * @returns The minimum, with the operands' variables, results, and requirements unioned.
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
  ResultOf<A> | ResultOf<B> | ResultOfAll<Rest>,
  RequiresOf<A> | RequiresOf<B> | RequiresOfAll<Rest>
> = internal.min

/**
 * The maximum of the operands. Serializes as the CSS `max()` function.
 *
 * @param a - The first operand.
 * @param b - The second operand, sharing `a`'s dimension.
 * @returns The maximum, with the operands' variables, results, and requirements unioned.
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
  ResultOf<A> | ResultOf<B> | ResultOfAll<Rest>,
  RequiresOf<A> | RequiresOf<B> | RequiresOfAll<Rest>
> = internal.max

/**
 * Clamps `value` between `minimum` and `maximum`. Serializes as the CSS
 * `clamp()` function, with the CSS argument order `(min, value, max)`.
 *
 * @param minimum - The lower bound.
 * @param value - The value to clamp, sharing `minimum`'s dimension.
 * @param maximum - The upper bound, likewise.
 * @returns The clamped expression, with the operands' variables, results, and requirements unioned.
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
  ResultOf<A> | ResultOf<B> | ResultOf<C>,
  RequiresOf<A> | RequiresOf<B> | RequiresOf<C>
> = internal.clamp

/**
 * Linear interpolation from `a` to `b` by `t`. This is sugar, not a node:
 * it desugars to `(1 - t) * a + t * b`, and serializes as that expanded
 * form. `t` contributes its variables and requirements but never the
 * result — the endpoints alone fix the dimension.
 *
 * @param a - The value at `t = 0`.
 * @param b - The value at `t = 1`, sharing `a`'s dimension.
 * @param t - The interpolation parameter, a `<number>`.
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
    ResultOf<A> | ResultOf<B>,
    RequiresOf<A> | RequiresOf<B> | RequiresOf<T>
  >
} = internal.lerp

/**
 * The absolute value. Serializes as the CSS `abs()` function.
 *
 * @param argument - The operand.
 * @returns The absolute value expression, preserving the operand's result.
 * @since 0.1.0
 */
export const abs: {
  <A extends In>(argument: A): Calc<VarsOf<A>, ResultOf<A>, RequiresOf<A>>
} = internal.abs

/**
 * The sign (`-1`, `0`, or `1`). Serializes as the CSS `sign()` function,
 * which accepts a calculation of any dimension and returns a `<number>` —
 * so any operand is accepted here.
 *
 * @param argument - The operand, of any dimension.
 * @returns The sign, a `<number>`, carrying the operand's requirements.
 * @since 0.1.0
 */
export const sign: {
  <A extends In>(argument: A): Calc<VarsOf<A>, Unit.None, RequiresOf<A>>
} = internal.sign

/**
 * The sine of its argument. Serializes as the CSS `sin()` function, which
 * accepts an `<angle>` or a plain number treated as radians — so this takes
 * either an angle expression or a number, and returns a number.
 *
 * @param argument - An angle, or a plain number in radians.
 * @returns The sine, a `<number>`, carrying the argument's requirements.
 * @since 0.1.0
 */
export const sin: {
  <A extends NumberOrAngleIn>(argument: A): Calc<VarsOf<A>, Unit.None, RequiresOf<A>>
} = internal.sin

/**
 * The cosine of its argument. Serializes as the CSS `cos()` function, which
 * accepts an `<angle>` or a plain number treated as radians — so this takes
 * either an angle expression or a number, and returns a number.
 *
 * @param argument - An angle, or a plain number in radians.
 * @returns The cosine, a `<number>`, carrying the argument's requirements.
 * @since 0.1.0
 */
export const cos: {
  <A extends NumberOrAngleIn>(argument: A): Calc<VarsOf<A>, Unit.None, RequiresOf<A>>
} = internal.cos

/**
 * The tangent of its argument. Serializes as the CSS `tan()` function, which
 * accepts an `<angle>` or a plain number treated as radians. Paired with
 * `atan2`, `tan(atan2(a, b))` divides two same-dimension expressions to a
 * `<number>` — the length ratio that works where `a / b` does not, since
 * Firefox does not yet support `<length> / <length>` in `calc()`.
 *
 * @param argument - An angle, or a plain number in radians.
 * @returns The tangent, a `<number>`, carrying the argument's requirements.
 * @since 0.2.0
 */
export const tan: {
  <A extends NumberOrAngleIn>(argument: A): Calc<VarsOf<A>, Unit.None, RequiresOf<A>>
} = internal.tan

/**
 * The arccosine of a value in `[-1, 1]`, an `<angle>` in radians — the
 * result is `Unit.Rad`, matching what solving evaluates (`Math.acos`) and
 * what constant folding emits (`rad` constants); CSS's `acos()` returns an
 * `<angle>` and serialization is unchanged.
 *
 * Because the result is an angle, it composes only with other angles: divide
 * or scale it by a number, and add or subtract an `Angle.rad(...)` phase. A
 * plain number added to it is a type error — supply the phase as an angle.
 *
 * @param argument - The cosine value, in `[-1, 1]`.
 * @returns The arccosine in radians, carrying the argument's requirements.
 * @example
 * ```ts
 * const phase = Angle.rad(2.0943951)
 * Calc.serialize(Calc.cos(Calc.subtract(Calc.divide(Calc.acos(Calc.var('u')), 3), phase)))
 * // 'cos(acos(var(--u)) / 3 - 2.0944rad)'
 * ```
 * @since 0.1.0
 */
export const acos: {
  <A extends NumberIn>(argument: A): Calc<VarsOf<A>, Unit.Rad, RequiresOf<A>>
} = internal.acos

/**
 * The angle, in radians, of the vector from the origin to `(x, y)` — CSS's
 * `atan2()`, which returns an `<angle>`; the result is `Unit.Rad`, as
 * `acos`. The operands must share a dimension (two numbers, two lengths,
 * two angles); their units cancel in the ratio, so `tan(atan2(a, b))`
 * recovers `a / b` as a `<number>` and is the portable way to divide two
 * `<length>`s.
 *
 * @param y - The vertical component.
 * @param x - The horizontal component, sharing `y`'s dimension.
 * @returns The angle in radians, with the operands' variables and requirements unioned.
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
  ): Calc<VarsOf<A> | VarsOf<B>, Unit.Rad, RequiresOf<A> | RequiresOf<B>>
} = internal.atan2

export const bind: {
  /**
   * Returns a function that binds the given names in an expression.
   *
   * The data-last form cannot see its eventual expression, so the
   * per-name declared-type checking rides the data-first overload only;
   * requirement threading works in both.
   *
   * @param bindings - Variable names to values or expressions. Names the expression does not read are ignored, as are `undefined` values.
   * @returns A function replacing bound variables in its argument, preserving its result and joining the bound values' requirements to its own.
   * @since 0.1.0
   */
  <const B extends Bindings>(
    bindings: B,
  ): // `[B] extends [unknown]` is always true (`B extends Bindings`); it wraps the
  // return as a deferred conditional rather than a function type, so this curried
  // overload fails TypeScript's `isGenericFunctionReturningFunction` predicate.
  // Without the wrapper that predicate defers a data-first `bind` call sited
  // inline in `solve`'s argument position, collapsing solve's type parameters to
  // their constraints and rejecting a correct call. Always true — do not unwrap.
  // The `docs/solve-inference.md` spike records the derivation.
  [B] extends [unknown]
    ? <A extends Top>(
        expr: A,
      ) => Calc<
        ApplyBindings<VarsOf<A>, B>,
        ResultOf<A>,
        RequiresOf<A> | BindingRequires<VarsOf<A>, B>
      >
    : never
  /**
   * Replaces variables with values or other expressions. Binding is
   * partial evaluation: substituted subtrees re-fold, so binding every
   * variable collapses the tree to a constant. The expression's result is
   * preserved — binding touches only the variable channel — and the bound
   * values' own requirements join the expression's, so a `Length.vw(2)`
   * binding carries its `vw` ratio demand into the result for `solve` to
   * collect later.
   *
   * A declared name types its value: binding a `Var.length` read to a
   * bare number (or any non-length) is a type error, the check the
   * declaration exists for. Undeclared names accept any `Input`.
   *
   * Names the expression does not read are ignored (spreading a wider
   * bindings object is fine), as are `undefined` values. Binding a
   * variable to another expression composes trees; the bound expression's
   * own variables join the result, tracked in the return type by
   * `ApplyBindings`.
   *
   * @param expr - The expression to bind.
   * @param bindings - Variable names to values or expressions, typed per name by its declared type. May be partial: unbound names stay in the result.
   * @returns The bound expression.
   * @example
   * ```ts
   * const half = Calc.bind(Calc.divide(Calc.var('x'), 2), { x: Calc.var('width') })
   * Calc.serialize(half) // 'calc(var(--width) / 2)'
   * Calc.solve(Calc.bind(half, { width: 100 })) // 50
   * ```
   * @since 0.1.0
   */
  <A extends Top, const B extends PartialBindings<VarsOf<A>>>(
    expr: A,
    bindings: B,
  ): Calc<ApplyBindings<VarsOf<A>, B>, ResultOf<A>, RequiresOf<A> | BindingRequires<VarsOf<A>, B>>
} = internal.bind

export const solve: {
  /**
   * Evaluates a closed expression to a number. Absolute lengths (`px`) and
   * angles (radians and degrees) lower with no options; an unbound
   * variable, a relative unit, a percentage, or a bare identifier needs the
   * options overload.
   *
   * @param expr - The expression. No unbound variables, only pre-satisfied requirements.
   * @returns The numeric value.
   * @throws `Error` when unbound variables or unresolvable requirements remain at runtime.
   * @since 0.1.0
   */
  (expr: Calc<never, Unit.Any, Unit.ContextFree>): number
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
  <Vars extends Var.Any, R>(expr: Calc<Vars, Unit.Any, R>, options: SolveOptions<Vars, R>): number
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
export const serialize: <Vars extends Var.Any>(
  expr: Calc<Vars, Unit.Any, unknown>,
  options?: SerializeOptions<Vars>,
) => string = internal.serialize

/**
 * The expression's unbound variable names — bare names, the value-level
 * mirror of the read identities in `Vars`. A fallback chain's names are
 * included: `var(--x, var(--y))` reads both.
 *
 * @param expr - The expression to inspect.
 * @returns The set of unbound variable names.
 * @since 0.1.0
 */
export const vars: <Vars extends Var.Any>(
  expr: Calc<Vars, Unit.Any, unknown>,
) => ReadonlySet<Var.Name<Vars>> = internal.refs

/**
 * The bare-identifier tokens the expression reads — leaves that serialize
 * as themselves (`l`, not `var(--l)`) and are resolved by the CSS construct
 * around them, the `Channel` keywords being the only source today. Empty
 * for an expression with none.
 *
 * The runtime mirror of the `Ident` brands in `Requires`: it reports which
 * values the `idents` section of `solve`'s options must supply, exactly as
 * `vars` reports what `bindings` must — and, unlike the type parameter, it
 * survives on a `Calc<Vars, Unit.Any, unknown>` whose requirements have
 * been erased. Identifiers are not variables, so `vars` never lists them
 * and they never reach a `Stylesheet`'s dependency report.
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
export const idents: (expr: Calc<Var.Any, Unit.Any, unknown>) => ReadonlySet<string> =
  internal.idents

/**
 * The unit tokens the expression's dimensioned constants carry (`'vw'`,
 * `'px'`, `'%'`). Empty for a unit-free expression.
 *
 * The runtime mirror of the `Unit` brands in `Requires`: it reports which
 * ratios the `units` section of `solve`'s options may need to supply, and —
 * unlike the type parameter — it survives on a `Calc<Vars, Unit.Any, unknown>`
 * whose requirements have been erased. Pre-satisfied units (`px`, `rad`,
 * `deg`) are reported too; they lower with no entry.
 *
 * @param expr - The expression to inspect.
 * @returns The set of unit tokens the expression's constants carry.
 * @example
 * ```ts
 * Calc.units(Calc.subtract(Length.vw(100), Length.px(320))) // Set { 'vw', 'px' }
 * ```
 * @since 0.4.0
 */
export const units: (expr: Calc<Var.Any, Unit.Any, unknown>) => ReadonlySet<string> = internal.units

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The expression to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: Calc<Var.Any, Unit.Any, unknown>): (self: Calc<Var.Any, Unit.Any, unknown>) => boolean
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
  (self: Calc<Var.Any, Unit.Any, unknown>, that: Calc<Var.Any, Unit.Any, unknown>): boolean
} = internal.equals
