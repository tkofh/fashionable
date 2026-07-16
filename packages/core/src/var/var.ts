import type { Pipeable } from '#util'
import type { VarTypeId } from './var.internal.ts'
import * as internal from './var.internal.ts'

declare const VarVariance: unique symbol

/**
 * A read of a CSS custom property: one `var()` invocation, modeled as a
 * value. A bare read (`Var.of('gap')`) doubles as the property's canonical
 * handle — the one value a consumer exports for a property — and
 * site-specific reads derive from it through `fallback` without disturbing
 * it.
 *
 * Three type parameters track the read:
 *
 * - `Name` — the property name, without the `--` prefix. This is the
 *   read's identity: it is what the `Vars` parameter of `Calc`, `Color`,
 *   and the containers unions, and what the runtime `vars()` reports list.
 * - `Type` — the declared value type, `unknown` while undeclared. Typed
 *   constructors are a planned extension (see `docs/vars.md`); every read
 *   this module builds today is `unknown`-typed and lifts as a `<number>`.
 * - `Fallback` — the fallback value, `undefined` on a bare read. The slot
 *   is generic here: what a fallback may be depends on where the read
 *   lands, and each admitting context (`Declaration.Value`, `Calc.var`,
 *   `Color.var`) constrains it there.
 *
 * A read is not itself an expression. `Calc.var` and `Color.var` lift it
 * into their worlds, and a declaration accepts it directly as a whole
 * value (`Declaration.make('font-family', stack)` renders
 * `font-family: var(--stack)`).
 *
 * Values are immutable and structurally comparable via `equals` — two
 * reads of the same property with different fallbacks are different
 * values that report the same dependency.
 *
 * @since 0.4.0
 */
/* oxlint-disable no-shadow -- the parameters deliberately share the
   extractors' names: `Var<Name, Type, Fallback>` is the hover shape the
   design contract spells, and `Var.Name<V>`/`Var.Type<V>`/`Var.Fallback<V>`
   are its projections. */
export interface Var<
  out Name extends string = string,
  out Type = unknown,
  out Fallback = undefined,
> extends Pipeable {
  readonly [VarTypeId]: VarTypeId
  readonly [VarVariance]?: {
    readonly name: Name
    readonly type: Type
    readonly fallback: Fallback
  }
}
/* oxlint-enable no-shadow */

/**
 * The widest read — any name, any declared type, any fallback. The
 * supertype every read extends, used to constrain a parameter before its
 * facets are extracted.
 *
 * @since 0.4.0
 */
export type Any = Var<string, unknown, unknown>

/**
 * The property name a read carries — `Name<Var<'gap'>>` is `'gap'`.
 * Distributes over unions, so applying it to a `Vars` phantom recovers the
 * name union the runtime `vars()` sets mirror.
 *
 * @since 0.4.0
 */
export type Name<V extends Any> = V extends Var<infer N, unknown, unknown> ? N : never

/**
 * The declared value type a read carries — `unknown` while undeclared.
 *
 * @since 0.4.0
 */
export type Type<V extends Any> = V extends Var<string, infer T, unknown> ? T : never

/**
 * The fallback value a read carries — `undefined` on a bare read.
 *
 * @since 0.4.0
 */
export type Fallback<V extends Any> = V extends Var<string, unknown, infer F> ? F : never

/**
 * A read stripped to its identity: the name-and-type pair, fallback slot
 * cleared. This is what phantoms union — `Calc.var` on
 * `var(--x, var(--y))` returns a `Calc<Var<'x'> | Var<'y'>>`, identities
 * flattened, never a nested read.
 *
 * @since 0.4.0
 */
export type Identity<V extends Any> = V extends Var<infer N, infer T, unknown> ? Var<N, T> : never

/**
 * Checks if a value is a `Var`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `Var`, `false` otherwise.
 * @since 0.4.0
 */
export const isVar: (u: unknown) => u is Any = internal.isVar

/**
 * Creates a bare read of a custom property — the property's canonical
 * handle. Accepted wherever a read is: as a declaration value, lifted by
 * `Calc.var` or `Color.var`, and (as sugar) both lifts also take the bare
 * name directly, so `Calc.var('gap')` and `Calc.var(Var.of('gap'))` are
 * the same expression.
 *
 * Repeated calls with the same name return the same instance.
 *
 * @param name - The property name, without the `--` prefix. Must be non-empty.
 * @returns A bare read of `--name`.
 * @throws `Error` when `name` is empty.
 * @example
 * ```ts
 * const gap = Var.of('gap')
 * Calc.serialize(Calc.var(gap)) // 'var(--gap)'
 * ```
 * @since 0.4.0
 */
export const of: <Name extends string>(name: Name) => Var<Name> = internal.of

export const fallback: {
  /**
   * Returns a function that derives a read carrying `fb` as its fallback.
   *
   * @param fb - The fallback value.
   * @returns A function that takes a read and returns the same property's read with `fb` as its fallback.
   * @since 0.4.0
   */
  <const F>(fb: F): <V extends Any>(v: V) => Var<Name<V>, Type<V>, F>
  /**
   * Derives a read of the same property carrying a fallback — the second
   * argument of the rendered `var()`, used by the browser when the
   * property is unset. The original read is untouched: fallback is a
   * property of the read site, not the variable, so one canonical handle
   * derives as many site-specific reads as needed.
   *
   * The fallback is held opaquely here. What it may be is constrained
   * where the read is used: a declaration value accepts any declaration
   * value (nested reads included), `Calc.var` accepts numeric fallbacks,
   * `Color.var` color-valued ones.
   *
   * A fallback joins the dependency report (`var(--x, var(--y))` reads
   * both names) but is discarded by `bind` when its read's own name is
   * bound, and does not reduce what `solve` requires — see `docs/vars.md`.
   *
   * @param v - The read to derive from.
   * @param fb - The fallback value. Must not be `undefined`.
   * @returns A read of the same property with `fb` as its fallback.
   * @throws `Error` when `fb` is `undefined`.
   * @example
   * ```ts
   * const gap = Var.of('gap')
   * Calc.serialize(Calc.var(gap.pipe(Var.fallback(8)))) // 'var(--gap, 8)'
   * ```
   * @since 0.4.0
   */
  <V extends Any, const F>(v: V, fb: F): Var<Name<V>, Type<V>, F>
} = internal.fallback

/**
 * The property name a read carries, without the `--` prefix.
 *
 * @param v - The read to inspect.
 * @returns The bare property name.
 * @since 0.4.0
 */
export const name: <V extends Any>(v: V) => Name<V> = internal.nameOf

/**
 * The names a read reads: its own, plus everything its fallback chain
 * reads (`var(--x, var(--y))` reads `x` and `y`). The runtime mirror of
 * the identities the read contributes to a `Vars` phantom when lifted.
 *
 * @param v - The read to inspect.
 * @returns The set of property names read.
 * @since 0.4.0
 */
export const vars: (v: Any) => ReadonlySet<string> = internal.refs

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The read to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.4.0
   */
  (that: Any): (self: Any) => boolean
  /**
   * Structural equality: names compare as text, fallbacks by their own
   * structural equality (expression fallbacks as expression trees,
   * primitive fallbacks by value). A bare read never equals a
   * fallback-carrying one.
   *
   * @param self - The first read.
   * @param that - The second read.
   * @returns `true` if the reads are structurally equal.
   * @since 0.4.0
   */
  (self: Any, that: Any): boolean
} = internal.equals
