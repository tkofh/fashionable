/**
 * Precision-aware number formatting shared by the calc and color
 * serializers. Everything here renders plain decimal text — CSS never
 * accepts exponent notation.
 */

/**
 * The plain-data shape of a precision request. The public `Precision` type
 * (calc/precision.ts) is structurally compatible; expression nodes store
 * this reduced form.
 *
 * @internal
 */
export interface FormatSpec {
  readonly mode: 'decimals' | 'significant'
  readonly digits: number
}

/** @internal */
export const DEFAULT_FORMAT: FormatSpec = { mode: 'decimals', digits: 5 }

/** @internal */
export const specEquals = (a: FormatSpec | undefined, b: FormatSpec | undefined): boolean => {
  if (a === undefined || b === undefined) {
    return a === b
  }
  return a.mode === b.mode && a.digits === b.digits
}

/**
 * Ranks a spec for constant-folding propagation: any `significant` beats
 * any `decimals`, higher digits beat lower, and an unannotated constant
 * (undefined) ranks lowest.
 *
 * @internal
 */
export const specFidelity = (spec: FormatSpec | undefined): number => {
  if (spec === undefined) {
    return 0
  }
  return spec.mode === 'significant' ? 10_000 + spec.digits : 1 + spec.digits
}

const trimTrailingZeros = (fixed: string): string => {
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
  if (trimmed === '' || trimmed === '-' || trimmed === '-0') {
    return '0'
  }
  return trimmed
}

/**
 * `toFixed`-style formatting with trailing zeros trimmed and negative zero
 * normalized. `formatDecimals(3.14000, 5)` is `'3.14'`.
 *
 * @internal
 */
export const formatDecimals = (n: number, digits: number): string =>
  trimTrailingZeros(n.toFixed(digits))

/**
 * `toPrecision`-style formatting normalized to plain decimal notation.
 * `formatSignificant(0.8377580409572781, 10)` is `'0.837758041'`.
 *
 * @internal
 */
export const formatSignificant = (n: number, digits: number): string => {
  const rounded = Number(n.toPrecision(digits))
  if (rounded === 0) {
    return '0'
  }
  // Rebuild through toFixed so values that stringify with an exponent
  // (below 1e-6) still render as plain decimals.
  const exponent = Math.floor(Math.log10(Math.abs(rounded)))
  const decimals = Math.min(100, Math.max(0, digits - 1 - exponent))
  return trimTrailingZeros(rounded.toFixed(decimals))
}

/** @internal */
export const formatWith = (n: number, spec: FormatSpec): string =>
  spec.mode === 'decimals' ? formatDecimals(n, spec.digits) : formatSignificant(n, spec.digits)
