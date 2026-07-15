import type { Calc } from '#calc'
import type { Color, Unit } from '#data'
import type { Pipeable } from '#util'
import type { PropertySyntaxTypeId } from './propertySyntax.internal.ts'
import * as internal from './propertySyntax.internal.ts'

declare const AcceptedValue: unique symbol
declare const UniversalMarker: unique symbol

/**
 * A modeled `@property` syntax descriptor: the universal syntax, a data
 * type, a keyword, a multiplied list, or a `|` combination of these.
 *
 * The point of modeling the descriptor as a value is twofold. The
 * supported grammar becomes discoverable — the data types are constants
 * (`number`, `color`, `lengthPercentage`, ...), and the combinators
 * (`keyword`, `oneOf`, `listOf`, `commaListOf`) enforce the grammar's
 * constraints at construction. And the `V` parameter tracks the
 * initial-value forms the syntax accepts, so `PropertyRule.make` can
 * type its `initialValue` from the syntax it is registered under.
 *
 * Construct via the data type constants, `universal`, `keyword`,
 * `keywords`, `oneOf`, `listOf`, and `commaListOf`.
 *
 * @since 0.1.0
 */
export interface PropertySyntax<out V = Value> extends Pipeable {
  readonly [PropertySyntaxTypeId]: PropertySyntaxTypeId
  readonly [AcceptedValue]?: V
}

/**
 * The full initial-value domain — what the universal syntax accepts.
 * Individual syntaxes narrow this: number-land syntaxes take numbers and
 * closed `Calc` expressions, dimensioned syntaxes take a closed `Calc` of
 * their kind (a `<length>` initial value must be computationally independent,
 * so only absolute units), `color` takes closed `Color` expressions or text,
 * keyword sets take exactly their literals, and the rest take literal text.
 *
 * @since 0.1.0
 */
export type Value = string | number | Calc.Calc<never, Unit.Any, unknown> | Color.Color<never>

/**
 * The initial-value forms a syntax accepts — the type-level counterpart
 * of the `V` parameter, extracted from a syntax (or union of syntaxes).
 *
 * @since 0.1.0
 */
export type ValueOf<S extends PropertySyntax<unknown>> =
  S extends PropertySyntax<infer V> ? V : never

/**
 * Checks if a value is a `PropertySyntax`.
 *
 * True only for values built by this module's constructors, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `PropertySyntax`, `false` otherwise.
 * @since 0.1.0
 */
export const isPropertySyntax: (u: unknown) => u is PropertySyntax = internal.isPropertySyntax

/**
 * The type of `universal` alone. Naming it lets `PropertyRule.make`
 * recognize the universal syntax in overload resolution — the one syntax
 * under which the initial value is optional.
 *
 * @since 0.1.0
 */
export interface Universal extends PropertySyntax<Value> {
  readonly [UniversalMarker]: true
}

/**
 * The universal syntax, `*` — any value at all. The one syntax under
 * which `@property` may omit its initial value.
 *
 * @since 0.1.0
 */
export const universal: Universal = internal.universal

/**
 * The `<angle>` data type. Initial values are a closed angle-kind `Calc`
 * (`Angle.rad(...)`) or literal text carrying an angle unit (`'90deg'`).
 *
 * @since 0.1.0
 */
export const angle: PropertySyntax<string | Calc.Calc<never, Unit.Angle, Unit.Angle>> =
  internal.angle

/**
 * The `<color>` data type. Initial values are closed `Color` expressions
 * or literal text (`'transparent'`, `'#fff'`).
 *
 * @since 0.1.0
 */
export const color: PropertySyntax<string | Color.Color<never>> = internal.color

/**
 * The `<custom-ident>` data type — any custom identifier. To accept a
 * fixed set of identifiers instead, combine `keyword` values with
 * `oneOf`.
 *
 * @since 0.1.0
 */
export const customIdent: PropertySyntax<string> = internal.customIdent

/**
 * The `<image>` data type. Initial values are literal text.
 *
 * @since 0.1.0
 */
export const image: PropertySyntax<string> = internal.image

/**
 * The `<integer>` data type. Initial values are numbers or closed `Calc`
 * expressions; that the value is a whole number is the browser's parse
 * check, not this library's.
 *
 * @since 0.1.0
 */
export const integer: PropertySyntax<number | Calc.Calc<never>> = internal.integer

/**
 * The `<length>` data type. Initial values are a closed length-kind `Calc`
 * (`Length.px(8)`) or literal text carrying a length unit (`'8px'` — a bare
 * `0` is not a valid registered length). An `@property` initial value must be
 * computationally independent, so an expression may carry only absolute units
 * (`px`) — a viewport- or font-relative length (`Length.vw(8)`) is rejected.
 *
 * @since 0.1.0
 */
export const length: PropertySyntax<string | Calc.Calc<never, Unit.Length, Unit.AbsoluteLength>> =
  internal.length

/**
 * The `<length-percentage>` data type. Initial values are a closed
 * absolute-length or percentage `Calc`, or literal text.
 *
 * @since 0.1.0
 */
export const lengthPercentage: PropertySyntax<
  | string
  | Calc.Calc<never, Unit.Length, Unit.AbsoluteLength>
  | Calc.Calc<never, Unit.Percentage, Unit.Percentage>
> = internal.lengthPercentage

/**
 * The `<number>` data type. Initial values are numbers or closed `Calc`
 * expressions — the typed channel this library models; text is not
 * accepted where the number form exists.
 *
 * @since 0.1.0
 */
export const number: PropertySyntax<number | Calc.Calc<never>> = internal.number

/**
 * The `<percentage>` data type. Initial values are a closed percentage-kind
 * `Calc` (`Percentage.of(50)`) or literal text carrying the `%` unit (`'50%'`).
 *
 * @since 0.1.0
 */
export const percentage: PropertySyntax<
  string | Calc.Calc<never, Unit.Percentage, Unit.Percentage>
> = internal.percentage

/**
 * The `<resolution>` data type. Initial values are literal text.
 *
 * @since 0.1.0
 */
export const resolution: PropertySyntax<string> = internal.resolution

/**
 * The `<string>` data type. Initial values are literal text including
 * their own quotes (`'"hello"'`).
 *
 * @since 0.1.0
 */
export const string: PropertySyntax<string> = internal.string

/**
 * The `<time>` data type. Initial values are literal text carrying a
 * time unit (`'200ms'`).
 *
 * @since 0.1.0
 */
export const time: PropertySyntax<string> = internal.time

/**
 * The `<transform-function>` data type. Initial values are literal text.
 *
 * @since 0.1.0
 */
export const transformFunction: PropertySyntax<string> = internal.transformFunction

/**
 * The `<transform-list>` data type — a list of transform functions. It
 * is pre-multiplied, so `listOf`/`commaListOf` reject it. Initial values
 * are literal text.
 *
 * @since 0.1.0
 */
export const transformList: PropertySyntax<string> = internal.transformList

/**
 * The `<url>` data type. Initial values are literal text.
 *
 * @since 0.1.0
 */
export const url: PropertySyntax<string> = internal.url

/**
 * A keyword component: one specific custom identifier, rendered bare.
 * Combined under `oneOf`, keywords give the registered property an
 * enum-like domain — and the `V` parameter carries the literal, so
 * `initialValue` autocompletes and checks against exactly the declared
 * set.
 *
 * @param name - The identifier. Must be non-empty and not a CSS-wide keyword (`inherit`, `initial`, `unset`, `revert`, `revert-layer`, `default`), which the specification excludes.
 * @returns A `PropertySyntax` accepting exactly `name`.
 * @throws `Error` when `name` is empty or a CSS-wide keyword.
 * @since 0.1.0
 */
export const keyword: <const K extends string>(name: K) => PropertySyntax<K> = internal.keyword

/**
 * A keyword set: shorthand for `oneOf` over `keyword` values, accepting
 * — and narrowing `initialValue` to — exactly the given identifiers. A
 * single name is just that `keyword`.
 *
 * @param names - One or more identifiers, each under `keyword`'s constraints.
 * @returns A `PropertySyntax` accepting exactly the given names.
 * @throws `Error` when a name is empty or a CSS-wide keyword.
 * @example
 * ```ts
 * const size = PropertySyntax.keywords('small', 'medium', 'large')
 * PropertySyntax.render(size) // 'small | medium | large'
 * PropertyRule.make('--size', size, 'medium') // initialValue checks against the three names
 * ```
 * @since 0.1.0
 */
export const keywords: <const Names extends readonly [string, ...ReadonlyArray<string>]>(
  ...names: Names
) => PropertySyntax<Names[number]> = internal.keywords

/**
 * A `|` combination: the value may satisfy any one of the components,
 * tried in order — authored order is preserved (it is parse order, so
 * `'<length> | auto'` and `'auto | <length>'` are different syntaxes).
 * Nested combinations flatten into the enclosing one.
 *
 * @param components - Two or more components. The universal syntax stands alone and may not join a combination.
 * @returns A `PropertySyntax` accepting any component's values, unioned in `V`.
 * @throws `Error` when a component is the universal syntax.
 * @example
 * ```ts
 * const size = PropertySyntax.oneOf(PropertySyntax.keyword('small'), PropertySyntax.keyword('large'))
 * PropertySyntax.render(size) // 'small | large'
 * PropertyRule.make('--size', size, 'small') // initialValue is 'small' | 'large' only
 * ```
 * @since 0.1.0
 */
export const oneOf: <
  const Components extends readonly [
    PropertySyntax<unknown>,
    PropertySyntax<unknown>,
    ...ReadonlyArray<PropertySyntax<unknown>>,
  ],
>(
  ...components: Components
) => PropertySyntax<ValueOf<Components[number]>> = internal.oneOf

/**
 * A space-separated list of one component, rendered with the `+`
 * multiplier (`'<length>+'`).
 *
 * A one-item list is valid, so the component's own value forms stay
 * accepted; longer lists are literal text.
 *
 * @param component - The repeated component. Must be a single unmultiplied component — not the universal syntax, a combination, a list, or the pre-multiplied `transformList`.
 * @returns A `PropertySyntax` accepting the component's values or list text.
 * @throws `Error` when the component cannot take a multiplier.
 * @since 0.1.0
 */
export const listOf: <V>(component: PropertySyntax<V>) => PropertySyntax<V | (string & {})> =
  internal.listOf

/**
 * A comma-separated list of one component, rendered with the `#`
 * multiplier (`'<color>#'`). Constraints match `listOf`.
 *
 * @param component - The repeated component. Must be a single unmultiplied component — not the universal syntax, a combination, a list, or the pre-multiplied `transformList`.
 * @returns A `PropertySyntax` accepting the component's values or list text.
 * @throws `Error` when the component cannot take a multiplier.
 * @since 0.1.0
 */
export const commaListOf: <V>(component: PropertySyntax<V>) => PropertySyntax<V | (string & {})> =
  internal.commaListOf

/**
 * Renders the syntax as its descriptor string, unquoted: `'*'`,
 * `'<number>'`, `'<length>+'`, `'small | large'`. `PropertyRule.render`
 * wraps this in the quotes the descriptor requires.
 *
 * @param syntax - The syntax to render.
 * @returns Deterministic descriptor text.
 * @since 0.1.0
 */
export const render: (syntax: PropertySyntax) => string = internal.render

export const equals: {
  /**
   * Returns a function that checks structural equality against `that`.
   *
   * @param that - The syntax to compare against.
   * @returns A function testing its argument for structural equality with `that`.
   * @since 0.1.0
   */
  (that: PropertySyntax): (self: PropertySyntax) => boolean
  /**
   * Structural equality over the modeled grammar. Combination order
   * participates — it is parse order.
   *
   * @param self - The first syntax.
   * @param that - The second syntax.
   * @returns `true` if the syntaxes are structurally equal.
   * @since 0.1.0
   */
  (self: PropertySyntax, that: PropertySyntax): boolean
} = internal.equals
