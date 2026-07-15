import type { Calc } from '#calc/calc'
import type { Color } from '#color/color'
import type { RenderOptions as DeclarationRenderOptions } from '#declaration/declaration'
import type { Pipeable } from '#util'
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
 * a `Declaration` writing the property and `Calc.ref` reads downstream.
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
 * constructed. The `never` parameters are the spec rule in the types:
 * `@property` initial values must be computationally independent, so
 * only closed expressions — no unbound references — are accepted.
 *
 * `make` narrows further: its `initialValue` option takes only the forms
 * the declared syntax accepts (the syntax's `V` parameter).
 *
 * @since 0.1.0
 */
export type Value = string | Calc<never> | Color<never>

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

export const make: {
  /**
   * Registers under the universal syntax — the default when `syntax` is
   * omitted — where the initial value is optional.
   *
   * @param name - The custom property name to register, `--` prefix included.
   * @param syntax - The universal syntax; omit for the same effect.
   * @param initialValue - Optional under the universal syntax: any value form.
   * @returns A `PropertyRule` with `inherits: false`.
   * @throws `Error` when `name` is not a `--`-prefixed custom property name (bare `--` included), or an expression value has unbound references.
   * @since 0.1.0
   */
  (name: `--${string}`, syntax?: Universal, initialValue?: Value | number): PropertyRule
  /**
   * Creates an `@property` rule.
   *
   * The syntax value types the initial value: only forms the syntax
   * accepts are admitted — numbers and closed `Calc` expressions under
   * `PropertySyntax.number`, exactly the declared literals under a
   * keyword set, and so on — and the computational-independence rule
   * rides along, since an expression with unbound references is not a
   * `Calc<never>` (backed by a runtime check for untyped callers). Bare
   * numbers coerce to unannotated constants. That literal-text values
   * parse under the syntax is not checked — this library does not parse
   * CSS.
   *
   * Rules register with `inherits: false`; pipe through `inheritable` to
   * opt in.
   *
   * @param name - The custom property name to register, `--` prefix included.
   * @param syntax - The modeled `syntax` descriptor; see `PropertySyntax`.
   * @param initialValue - The `initial-value` descriptor, required for every non-universal syntax and typed by it.
   * @returns A `PropertyRule` with `inherits: false`.
   * @throws `Error` when `name` is not a `--`-prefixed custom property name (bare `--` included), `initialValue` is missing under a non-universal syntax, or an expression value has unbound references.
   * @example
   * ```ts
   * PropertyRule.make('--depth', PropertySyntax.number, 0)
   * ```
   * @since 0.1.0
   */
  <V extends Value | number>(
    name: `--${string}`,
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
