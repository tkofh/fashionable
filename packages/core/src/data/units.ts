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
 * @since 0.2.0
 */

declare const LengthUnitId: unique symbol
declare const AngleUnitId: unique symbol

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
    : never
