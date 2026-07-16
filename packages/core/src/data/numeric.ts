/**
 * The `<number>` expression type. Construction needs no module of its own —
 * bare numbers and `Calc.of` cover it — so this one exists to give the
 * dimension a name: an annotation alias for number-result expressions, and
 * the `<number>` member of the declared-type vocabulary `Var`'s typed
 * constructors speak (`Var.number('t')` is a `Var<'t', Numeric>`).
 *
 * @since 0.4.0
 */

import type { Calc } from '#calc/calc'
import type { Var } from '#var'
import type * as Unit from './unit.ts'

/**
 * A `<number>` expression: a `Calc` of number result, in no unit. Names the
 * dimension without spelling `Calc<Vars, Unit.None, unknown>` — `Calc.of(4)`
 * produces one, as does any combinator whose operands cancel to a number.
 * `Vars` unions the unbound variable names, as on `Calc`.
 *
 * The requirements stay open: a number-result expression can still carry
 * requirements (a relative-color channel ident, or the units of a
 * `vw / px` ratio), so no signature may assume number-result means
 * requirement-free.
 *
 * Declared as an interface rather than a type alias so the name survives
 * inference — this is the shape the `Type` slot of a typed `Var` displays,
 * and an alias would expand to its `Calc` spelling there.
 *
 * @since 0.4.0
 */
export interface Numeric<out Vars extends Var.Any = Var.Any> extends Calc<
  Vars,
  Unit.None,
  unknown
> {}
