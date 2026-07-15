/**
 * The unit vocabulary: the leaf brands dimensioned constants thread through
 * `Calc`'s third type parameter. Each unit is a distinct nominal type carrying
 * its CSS token, keyed by a per-dimension `unique symbol` so a length unit and
 * an angle unit never unify — that nominal split is what lets `solve` demand a
 * ratio for viewport-relative units while leaving absolute ones alone.
 *
 * You rarely name a unit type directly — `Length.px(10)` and `Angle.rad(2)`
 * stamp them — but they surface in `Calc<Vars, Kind, Leaves>` hovers as the set
 * of units an expression contains (`Calc<never, 'number', Unit.Vw | Unit.Px>`).
 *
 * Units share the `Leaves` parameter with the other leaf brand, `Calc.Ident` —
 * the bare-identifier tokens supplied by value through the `idents` section of
 * the solve options, where a unit is supplied by ratio through `units`.
 *
 * @since 0.2.0
 */

declare const LengthUnitId: unique symbol
declare const AngleUnitId: unique symbol
declare const PercentageUnitId: unique symbol

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
 * The `deg` unit (angle in degrees). Degrees lower to radians at solve
 * (`180deg` is `pi`), a fixed ratio, so like `rad` a degree needs no context.
 *
 * @since 0.2.0
 */
export interface Deg {
  readonly [AngleUnitId]: 'deg'
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
export type Angle = Rad | Deg

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
 * viewport or a font size, so `solve` requires a `units` entry for each.
 *
 * @since 0.2.0
 */
export type Relative = Rem | Em | Vw | Vh | Vmin | Vmax

/**
 * The absolute length units, whose pixel ratio is fixed (`px` is `1`). The
 * `units` section of the solve options may override them but need not supply
 * them.
 *
 * @since 0.2.0
 */
export type AbsoluteLength = Px

/**
 * The units an expression may carry and still `solve` with no options:
 * absolute lengths (fixed ratio) and angles (radians are already numbers,
 * degrees a fixed ratio of them).
 *
 * @since 0.2.0
 */
export type ContextFree = AbsoluteLength | Angle

/**
 * The CSS token of a unit brand (`Unit.Px` -> `'px'`), used to key the
 * `units` section of the solve options and to render the unit suffix.
 *
 * @since 0.2.0
 */
export type Token<U> = U extends { readonly [LengthUnitId]: infer T }
  ? T
  : U extends { readonly [AngleUnitId]: infer T }
    ? T
    : U extends { readonly [PercentageUnitId]: infer T }
      ? T
      : never

/**
 * The `units` section of `Calc.SolveOptions`: the ratios that lower an
 * expression carrying the unit leaves `L` to a number. Each
 * context-dependent unit present is a required pixels-per-unit ratio — `vw`
 * is `sampleWidth / 100`, and `%` is `basis / 100`, per-hundred alike —
 * while absolute lengths (`px`) are optional overrides and angle units never
 * appear (radians are already numeric, degrees a fixed ratio). An expression
 * whose leaves are all context-free needs no entries at all.
 *
 * @since 0.2.0
 */
export type UnitContext<L> = {
  readonly [K in Token<Extract<L, Relative | Percent>> & string]: number
} & {
  readonly [K in Token<Extract<L, AbsoluteLength>> & string]?: number
}
