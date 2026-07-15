/**
 * The unit vocabulary: the leaf-provenance brands threaded through `Calc`'s
 * third type parameter. Each unit is a distinct nominal type carrying its CSS
 * token, keyed by a per-dimension `unique symbol` so a length unit and an angle
 * unit never unify — that nominal split is what lets `solve` demand a context
 * for viewport-relative units while leaving absolute ones alone.
 *
 * You rarely name a unit type directly — `Length.px(10)` and `Angle.rad(2)`
 * stamp them — but they surface in `Calc<Refs, Kind, Leaves>` hovers as the set
 * of units an expression contains (`Calc<never, 'number', Unit.Vw | Unit.Px>`).
 *
 * Not every leaf provenance is a unit: a relative-color channel keyword
 * (`ChannelLeaf`) rides the same third parameter, so `solve` can demand a value
 * for it the way it demands a ratio for a viewport unit.
 *
 * @since 0.2.0
 */

declare const LengthUnitId: unique symbol
declare const AngleUnitId: unique symbol
declare const PercentageUnitId: unique symbol
declare const ChannelId: unique symbol

/**
 * The `px` unit (absolute length).
 *
 * @since 0.2.0
 */
export interface Px {
  readonly [LengthUnitId]: 'px'
}

/**
 * The `rem` unit (length relative to the root font size).
 *
 * @since 0.2.0
 */
export interface Rem {
  readonly [LengthUnitId]: 'rem'
}

/**
 * The `em` unit (length relative to the element font size).
 *
 * @since 0.2.0
 */
export interface Em {
  readonly [LengthUnitId]: 'em'
}

/**
 * The `vw` unit (length relative to 1% of viewport width).
 *
 * @since 0.2.0
 */
export interface Vw {
  readonly [LengthUnitId]: 'vw'
}

/**
 * The `vh` unit (length relative to 1% of viewport height).
 *
 * @since 0.2.0
 */
export interface Vh {
  readonly [LengthUnitId]: 'vh'
}

/**
 * The `vmin` unit (length relative to 1% of the smaller viewport axis).
 *
 * @since 0.2.0
 */
export interface Vmin {
  readonly [LengthUnitId]: 'vmin'
}

/**
 * The `vmax` unit (length relative to 1% of the larger viewport axis).
 *
 * @since 0.2.0
 */
export interface Vmax {
  readonly [LengthUnitId]: 'vmax'
}

/**
 * The `rad` unit (angle in radians).
 *
 * @since 0.2.0
 */
export interface Rad {
  readonly [AngleUnitId]: 'rad'
}

/**
 * The `%` unit (percentage). Keyed by its own dimension symbol, so a
 * percentage never unifies with a length or an angle — a `<percentage>`
 * is its own `Calc` kind, not a length that happens to be relative.
 *
 * @since 0.2.0
 */
export interface Percent {
  readonly [PercentageUnitId]: '%'
}

/**
 * A relative-color channel keyword (`Channel.L` -> `l`) as a leaf provenance
 * rather than a CSS unit. It carries the keyword name and is keyed by its own
 * `unique symbol`, so it never unifies with a unit; `solve` treats it like a
 * context-dependent unit, but demands a *value* for the keyword rather than a
 * pixels-per-unit ratio — there is no `value * ratio`, the keyword is itself the
 * value the browser reads from the origin. Surfaces in `Calc<Refs, Kind, Leaves>`
 * hovers as `Calc<never, 'number', Unit.ChannelLeaf<'l'>>`.
 *
 * @since 0.2.0
 */
export interface ChannelLeaf<Name extends string> {
  readonly [ChannelId]: Name
}

/**
 * Any `<length>` unit.
 *
 * @since 0.2.0
 */
export type Length = Px | Rem | Em | Vw | Vh | Vmin | Vmax

/**
 * Any `<angle>` unit.
 *
 * @since 0.2.0
 */
export type Angle = Rad

/**
 * Any `<percentage>` unit. There is only one (`%`); the alias exists for
 * symmetry with `Length` and `Angle`, so `Calc<never, 'percentage', Unit.Percentage>`
 * reads uniformly.
 *
 * @since 0.2.0
 */
export type Percentage = Percent

/**
 * The context-dependent length units — those whose pixel ratio depends on the
 * viewport or a font size, so `solve` requires a `UnitContext` entry for each.
 *
 * @since 0.2.0
 */
export type Relative = Rem | Em | Vw | Vh | Vmin | Vmax

/**
 * The absolute length units, whose pixel ratio is fixed (`px` is `1`). A
 * `UnitContext` may override them but need not supply them.
 *
 * @since 0.2.0
 */
export type AbsoluteLength = Px

/**
 * The units an expression may carry and still `solve` with no context: absolute
 * lengths (fixed ratio) and angles (radians are already numbers).
 *
 * @since 0.2.0
 */
export type ContextFree = AbsoluteLength | Angle

/**
 * The CSS token of a unit brand (`Unit.Px` -> `'px'`), used to key the solve
 * context and to render the unit suffix.
 *
 * @since 0.2.0
 */
export type Token<U> = U extends { readonly [LengthUnitId]: infer T }
  ? T
  : U extends { readonly [AngleUnitId]: infer T }
    ? T
    : U extends { readonly [PercentageUnitId]: infer T }
      ? T
      : U extends { readonly [ChannelId]: infer T }
        ? T
        : never

/**
 * The context `Calc.solve` requires to lower an expression carrying the units
 * `L` to a number. Each context-dependent (relative) unit present is a required
 * `number` ratio — pixels per unit, as `sampleWidth / 100` is per `vw` — while
 * absolute lengths (`px`) are optional overrides and angle units never appear
 * (radians are already numeric). Each relative-color channel keyword present is
 * a required `number` too, but the value itself, not a ratio (`{ l: 0.62 }`),
 * keyed by the keyword token. An expression whose leaves are all context-free
 * needs no context at all.
 *
 * @since 0.2.0
 */
export type UnitContext<L> = {
  readonly [K in Token<Extract<L, Relative>> & string]: number
} & {
  readonly [K in Token<Extract<L, ChannelLeaf<string>>> & string]: number
} & {
  readonly [K in Token<Extract<L, AbsoluteLength>> & string]?: number
}
