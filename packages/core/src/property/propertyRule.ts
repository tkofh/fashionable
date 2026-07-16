import type { Calc } from '#calc'
import type { Color, Unit } from '#data'
import type { RenderOptions as DeclarationRenderOptions } from '#declaration/declaration'
import type { Pipeable } from '#util'
import type { Var } from '#var'
import type { PropertyRuleTypeId } from './propertyRule.internal.ts'
import * as internal from './propertyRule.internal.ts'
import type { PropertySyntax, Universal } from './propertySyntax.ts'

/**
 * An `@property` rule: the registration that gives a custom property a
 * syntax, an inheritance behavior, and an initial value.
 *
 * A declaration-block at-rule lives at the top level of a stylesheet —
 * it is deliberately not a rule-block member, so it cannot nest.
 *
 * The registration is what turns a custom property into a typed,
 * animatable channel; a computed-property chain pairs one of these with
 * a `Declaration` writing the property and `Calc.var` reads downstream.
 *
 * Construct via `make`.
 *
 * @since 0.1.0
 */
export interface PropertyRule extends Pipeable {
  readonly [PropertyRuleTypeId]: PropertyRuleTypeId
  /**
   * The registered custom property name, `--` prefix included.
   */
  readonly name: `--${string}`
  /**
   * The modeled `syntax` descriptor; `render` emits it single-quoted.
   */
  readonly syntax: PropertySyntax
  /**
   * The `inherits` descriptor. `make` registers `false`; `inheritable`
   * flips it.
   */
  readonly inherits: boolean
  /**
   * The `initial-value` descriptor: literal text or a closed expression.
   * Absent only under the universal syntax.
   */
  readonly initialValue: Value | undefined
}

/**
 * The value forms an `initial-value` descriptor can hold once
 * constructed. The closed (`never`-ref) parameter is the spec rule in the
 * types: `@property` initial values must be computationally independent, so
 * only closed expressions — no unbound variables — are accepted. A `Calc`
 * of any dimension is admitted here; `make` narrows to the forms the declared
 * syntax accepts (the syntax's `V` parameter), where a `<length>` is limited
 * to absolute units.
 *
 * @since 0.1.0
 */
export type Value = string | Calc.Calc<never, Unit.Any, unknown> | Color.Color<never>

/**
 * Options for `render`, in the render-options family rooted at
 * `MediaQuery.RenderOptions` (via `Declaration.RenderOptions`). This
 * renderer consumes `indent` and the inherited `precision` (for an
 * expression-valued `initial-value`); `mediaSyntax` is accepted and
 * ignored.
 *
 * @since 0.1.0
 */
export interface RenderOptions extends DeclarationRenderOptions {
  /**
   * The indentation unit for the block's declarations. Defaults to a tab.
   */
  readonly indent?: string
}

/**
 * Checks if a value is a `PropertyRule`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `PropertyRule`, `false` otherwise.
 * @since 0.1.0
 */
export const isPropertyRule: (u: unknown) => u is PropertyRule = internal.isPropertyRule

/**
 * A handle usable in name position: a bare (fallback-free) read. A
 * fallback belongs to a read site, so a fallback-carrying read is rejected
 * structurally here.
 */
type Handle<T = unknown> = Var.Var<string, T, undefined>

// The initial-value forms a declared type admits — each arm mirrors the
// `V` of the syntax the declaration derives, so `make(handle, initial)`
// and `make(name, derivedSyntax, initial)` type identically.
type DeclaredValue<T> =
  T extends Color.Color<Var.Any>
    ? string | Color.Color<never>
    : T extends Calc.Calc<Var.Any, infer R, unknown>
      ? [Unit.Family<R>] extends [Unit.None]
        ? number | Calc.Calc<never>
        : [Unit.Family<R>] extends [Unit.Length]
          ? string | Calc.Calc<never, Unit.Length, Unit.AbsoluteLength>
          : [Unit.Family<R>] extends [Unit.Angle]
            ? string | Calc.Calc<never, Unit.Angle, Unit.Angle>
            : [Unit.Family<R>] extends [Unit.Percentage]
              ? string | Calc.Calc<never, Unit.Percentage, Unit.Percentage>
              :
                  | string
                  | Calc.Calc<never, Unit.Length, Unit.AbsoluteLength>
                  | Calc.Calc<never, Unit.Percentage, Unit.Percentage>
      : never

// Guards a name-position handle to undeclared reads: a declared handle
// derives its syntax, so it never registers universal. Exclusion is not
// expressible as a constraint (the `Type` slot's top is `unknown`), so the
// parameter intersects this — `unknown` for valid, an error string
// otherwise, the `Calc.var` pattern.
type UndeclaredGuard<H> = H extends `--${string}`
  ? unknown
  : H extends Var.Var<string, infer T, undefined>
    ? [unknown] extends [T]
      ? unknown
      : 'a declared handle derives its syntax: pass the initial value directly'
    : never

export const make: {
  /**
   * Registers a declared handle, deriving the syntax from its declared
   * type: `Var.length('gap')` registers `syntax: '<length>'`,
   * `Var.color('accent')` registers `'<color>'`, and so on — the handle
   * is the single source of truth for the property's name and type. The
   * initial value is typed exactly as under the derived syntax.
   *
   * @param handle - The property's canonical handle, from a typed `Var` constructor. Must be fallback-free.
   * @param initialValue - The `initial-value` descriptor, typed by the handle's declared type.
   * @returns A `PropertyRule` with `inherits: false`.
   * @throws `Error` when the handle carries a fallback, or an expression value has unbound variables.
   * @example
   * ```ts
   * const gap = Var.length('gap')
   * PropertyRule.render(PropertyRule.make(gap, Length.px(8)))
   * // "@property --gap {\n\tsyntax: '<length>';\n\tinherits: false;\n\tinitial-value: 8px;\n}"
   * ```
   * @since 0.4.0
   */
  <T extends Calc.Calc<Var.Any, Unit.Any, unknown> | Color.Color<Var.Any>>(
    handle: Handle<T>,
    initialValue: DeclaredValue<T>,
  ): PropertyRule
  /**
   * Registers under the universal syntax — the default when `syntax` is
   * omitted — where the initial value is optional. The name may be an
   * undeclared handle (`Var.of`); a declared handle takes the deriving
   * overload instead.
   *
   * @param name - The custom property name (`--` prefix included), or the property's undeclared handle.
   * @param syntax - The universal syntax; omit for the same effect.
   * @param initialValue - Optional under the universal syntax: any value form.
   * @returns A `PropertyRule` with `inherits: false`.
   * @throws `Error` when the name is not a `--`-prefixed custom property name (bare `--` included), the handle carries a fallback, or an expression value has unbound variables.
   * @since 0.1.0
   */
  <H extends `--${string}` | Handle>(
    name: H & UndeclaredGuard<H>,
    syntax?: Universal,
    initialValue?: Value | number,
  ): PropertyRule
  /**
   * Creates an `@property` rule.
   *
   * The syntax value types the initial value: only forms the syntax
   * accepts are admitted — numbers and closed `Calc` expressions under
   * `PropertySyntax.number`, exactly the declared literals under a
   * keyword set, and so on — and the computational-independence rule
   * rides along, since an expression with unbound variables is not a
   * `Calc<never>` (backed by a runtime check for untyped callers). Bare
   * numbers coerce to unannotated constants. That literal-text values
   * parse under the syntax is not checked — this library does not parse
   * CSS.
   *
   * Rules register with `inherits: false`; pipe through `inheritable` to
   * opt in.
   *
   * The name may be a handle. An explicit syntax with a declared handle is
   * consistency-checked at runtime against the canonical data types — a
   * `Var.length` handle cannot register `'<number>'` — while combinations
   * pass unchecked (whether a combination covers the declared type would
   * take grammar containment, which this library does not do).
   *
   * @param name - The custom property name (`--` prefix included), or the property's handle.
   * @param syntax - The modeled `syntax` descriptor; see `PropertySyntax`.
   * @param initialValue - The `initial-value` descriptor, required for every non-universal syntax and typed by it.
   * @returns A `PropertyRule` with `inherits: false`.
   * @throws `Error` when the name is not a `--`-prefixed custom property name (bare `--` included), the handle carries a fallback, the explicit syntax contradicts the handle's declared type, `initialValue` is missing under a non-universal syntax, or an expression value has unbound variables.
   * @example
   * ```ts
   * PropertyRule.make('--depth', PropertySyntax.number, 0)
   * ```
   * @since 0.1.0
   */
  <V extends Value | number>(
    name: `--${string}` | Handle,
    syntax: PropertySyntax<V>,
    initialValue: NoInfer<V>,
  ): PropertyRule
} = internal.make

/**
 * Registers the rule as inheriting. `make` constructs every rule with
 * `inherits: false` — the safe default for computed channels, where
 * inheritance would leak intermediate values down the tree — so
 * inheritance is an explicit opt-in.
 *
 * @param rule - The rule to opt in.
 * @returns The inheriting rule; the same rule when it already inherits.
 * @example
 * ```ts
 * PropertyRule.make('--fill', PropertySyntax.color, 'red').pipe(PropertyRule.inheritable)
 * ```
 * @since 0.1.0
 */
export const inheritable: (rule: PropertyRule) => PropertyRule = internal.inheritable

/**
 * Renders the rule as a complete `@property --name { ... }` block, the
 * descriptors in fixed order: `syntax`, `inherits`, `initial-value`.
 *
 * @param rule - The rule to render.
 * @param options - Optional indentation unit and precision context.
 * @returns Deterministic CSS text.
 * @example
 * ```ts
 * PropertyRule.render(PropertyRule.make('--depth', PropertySyntax.number, 0))
 * // "@property --depth {\n\tsyntax: '<number>';\n\tinherits: false;\n\tinitial-value: 0;\n}"
 * ```
 * @since 0.1.0
 */
export const render: (rule: PropertyRule, options?: RenderOptions) => string = internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The rule to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: PropertyRule): (self: PropertyRule) => boolean
  /**
   * Structural equality: `name` and `inherits` compare as data, the
   * syntax as its modeled grammar (`PropertySyntax.equals` semantics),
   * and expression initial values as expression trees (`Calc.equals`
   * semantics). Literal text never equals an expression.
   *
   * @param self - The first rule.
   * @param that - The second rule.
   * @returns `true` if the rules are structurally equal.
   * @since 0.1.0
   */
  (self: PropertyRule, that: PropertyRule): boolean
} = internal.equals
