import type { Pipeable } from '../utils.ts'
import type { PrecisionTypeId } from './precision.internal.ts'
import * as internal from './precision.internal.ts'

/**
 * A number-formatting precision, attached to constants at construction
 * (`Calc.of`) or supplied as a serialization context default
 * (`Calc.serialize`'s `precision` option).
 *
 * Two modes exist. `decimals` fixes the count of digits after the decimal
 * point (`toFixed` semantics); `significant` fixes the count of significant
 * digits (`toPrecision` semantics). Both render plain decimal text with
 * trailing zeros trimmed — CSS never accepts exponent notation.
 *
 * A precision annotated on a constant overrides the serialization context.
 * When constant folding combines annotated constants, the result carries
 * the highest-fidelity annotation among the operands: any `significant`
 * outranks any `decimals`, and more digits outrank fewer.
 *
 * @since 0.1.0
 */
export interface Precision extends Pipeable {
  readonly [PrecisionTypeId]: PrecisionTypeId
  /**
   * The formatting mode: digits after the decimal point (`decimals`) or
   * significant digits (`significant`).
   */
  readonly mode: 'decimals' | 'significant'
  /**
   * The digit count the mode fixes.
   */
  readonly digits: number
}

/**
 * Checks if a value is a `Precision`.
 *
 * True only for values built by `decimals` or `significant`, which carry
 * the brand.
 *
 * @param u - The value to check.
 * @returns `true` if the value is a `Precision`, `false` otherwise.
 * @since 0.1.0
 */
export const isPrecision: (u: unknown) => u is Precision = internal.isPrecision

/**
 * Creates a `Precision` fixing the count of digits after the decimal
 * point. The library default for unannotated constants is `decimals(5)`.
 *
 * @param digits - Digits after the decimal point. Must be an integer in `[0, 100]`.
 * @returns A `Precision` in `decimals` mode.
 * @throws `Error` when `digits` is not an integer in `[0, 100]`.
 * @example
 * ```ts
 * Calc.serialize(Calc.of(1 / 3), { precision: Precision.decimals(2) }) // '0.33'
 * ```
 * @since 0.1.0
 */
export const decimals: (digits: number) => Precision = internal.decimals

/**
 * Creates a `Precision` fixing the count of significant digits. Use it for
 * unit-free constants whose error is amplified downstream — solved curve
 * coefficients, for example — where fixed decimal places would truncate.
 *
 * @param digits - Significant digits. Must be an integer in `[1, 100]`.
 * @returns A `Precision` in `significant` mode.
 * @throws `Error` when `digits` is not an integer in `[1, 100]`.
 * @example
 * ```ts
 * const k = Calc.of(0.8377580409572781, Precision.significant(10))
 * Calc.serialize(k) // '0.837758041'
 * ```
 * @since 0.1.0
 */
export const significant: (digits: number) => Precision = internal.significant
