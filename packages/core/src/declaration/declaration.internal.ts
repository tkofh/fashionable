import type { ApplyBindings, Bindings, Input } from '#calc/calc'
import { bind as bindCalc, isCalc, serialize as serializeCalc, toCalc } from '#calc/calc.internal'
import type { Precision } from '#calc/precision'
import { bind as bindColor, isColor, serialize as serializeColor } from '#data/color.internal'
import * as Equal from '#internal/equal'
import { EMPTY_REFS, refsOf as protocolRefsOf } from '#internal/refs'
import { dual, invariant, Pipeable } from '#util'
import type { Name as VarName } from '#var/var'
import {
  type AnyVar,
  fallback as deriveRead,
  fallbackOf,
  isVar,
  nameOf as varNameOf,
} from '#var/var.internal'
import type { Declaration, RenderOptions, Value } from './declaration.ts'

export const DeclarationTypeId = Symbol.for('fashionable/declaration')
export type DeclarationTypeId = typeof DeclarationTypeId

const valueEquals = (a: Value<AnyVar>, b: Value<AnyVar>): boolean =>
  typeof a === 'string' || typeof b === 'string' ? a === b : Equal.equals(a, b)

const valueHash = (value: Value<AnyVar>): number =>
  typeof value === 'string' ? Equal.hashString(value) : Equal.hash(value)

// A declaration-level fallback renders by its own form: literal text
// verbatim, numbers as constants under the precision context, expressions
// through their serializers, nested reads recursively.
const serializeFallback = (fb: unknown, precision?: Precision): string => {
  if (typeof fb === 'string') {
    return fb
  }
  const options = precision === undefined ? {} : { precision }
  if (typeof fb === 'number' || isCalc(fb)) {
    return serializeCalc(toCalc(fb as number), options)
  }
  if (isVar(fb)) {
    return serializeRead(fb, precision)
  }
  return serializeColor(fb as Parameters<typeof serializeColor>[0], options)
}

const serializeRead = (read: AnyVar, precision?: Precision): string => {
  const fb = fallbackOf(read)
  return fb === undefined
    ? `var(--${varNameOf(read)})`
    : `var(--${varNameOf(read)}, ${serializeFallback(fb, precision)})`
}

const serializeValue = (value: Value<AnyVar>, precision?: Precision): string => {
  if (typeof value === 'string') {
    return value
  }
  if (isVar(value)) {
    return serializeRead(value, precision)
  }
  const options = precision === undefined ? {} : { precision }
  return isCalc(value) ? serializeCalc(value, options) : serializeColor(value, options)
}

class DeclarationImpl extends Pipeable implements Declaration<AnyVar>, Equal.Equal {
  readonly [DeclarationTypeId]: DeclarationTypeId = DeclarationTypeId

  readonly name: string
  readonly value: Value<AnyVar>
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(name: string, value: Value<AnyVar>) {
    super()
    this.name = name
    this.value = value
    // the refs protocol covers every non-text form uniformly: Calc, Color,
    // and Var values each expose their vars set behind the shared symbol
    this.refSet = typeof value === 'string' ? EMPTY_REFS : protocolRefsOf(value)
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return isDeclaration(that) && this.name === that.name && valueEquals(this.value, that.value)
  }

  [Equal.HashTypeId](): number {
    if (this.#hash === undefined) {
      let h = Equal.hashString('fashionable/declaration')
      h = Equal.combine(h, Equal.hashString(this.name))
      h = Equal.combine(h, valueHash(this.value))
      this.#hash = h
    }
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `Declaration(${this.name}: ${serializeValue(this.value)})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isDeclaration = (u: unknown): u is Declaration<AnyVar> =>
  typeof u === 'object' && u !== null && DeclarationTypeId in u

/** @internal */
export const refsOf = (declaration: Declaration<AnyVar>): ReadonlySet<string> =>
  (declaration as unknown as DeclarationImpl).refSet

// A read's fallback chain must hold declaration-value forms only. The
// public signatures enforce this; the walk backs them for untyped callers.
const validateReadFallback = (fb: unknown): void => {
  if (fb === undefined || typeof fb === 'string' || typeof fb === 'number') {
    return
  }
  if (isVar(fb)) {
    validateReadFallback(fallbackOf(fb))
    return
  }
  invariant(
    isCalc(fb) || isColor(fb),
    'Declaration var fallback must be text, a number, an expression, or a Var read',
  )
}

/** @internal */
export function make(name: string | AnyVar, value: Value<AnyVar> | number): Declaration<never> {
  let resolved: string
  if (isVar(name)) {
    invariant(
      fallbackOf(name) === undefined,
      'A write takes the bare handle — a fallback belongs to a read site, not the property',
    )
    resolved = `--${varNameOf(name)}`
  } else {
    resolved = name
  }
  invariant(resolved.length > 0, 'Declaration name must be a non-empty string')
  if (isVar(value)) {
    validateReadFallback(fallbackOf(value))
  }
  return new DeclarationImpl(
    resolved,
    typeof value === 'number' ? toCalc(value) : value,
  ) as Declaration<never>
}

// Binding a read: a bound name replaces the whole read (fallback
// discarded, as in calc), an unbound one keeps the read and binds inside
// its fallback chain instead.
const bindRead = (read: AnyVar, bindings: Record<string, Input>): Value<AnyVar> => {
  const bound = bindings[varNameOf(read)]
  if (bound !== undefined) {
    return toCalc(bound)
  }
  const fb = fallbackOf(read)
  const rebound = bindFallback(fb, bindings)
  return rebound === fb ? (read as Value<AnyVar>) : (deriveRead(read, rebound) as Value<AnyVar>)
}

const bindFallback = (fb: unknown, bindings: Record<string, Input>): unknown => {
  if (fb === undefined || typeof fb === 'string' || typeof fb === 'number') {
    return fb
  }
  if (isCalc(fb)) {
    return bindCalc(fb, bindings)
  }
  if (isVar(fb)) {
    return bindRead(fb, bindings)
  }
  return bindColor(fb as Parameters<typeof bindColor>[0], bindings)
}

/** @internal */
export const bind: {
  <const B extends Bindings>(
    bindings: B,
  ): <Vars extends AnyVar>(declaration: Declaration<Vars>) => Declaration<ApplyBindings<Vars, B>>
  <Vars extends AnyVar, const B extends Bindings>(
    declaration: Declaration<Vars>,
    bindings: B,
  ): Declaration<ApplyBindings<Vars, B>>
} = dual(
  2,
  (declaration: Declaration<AnyVar>, bindings: Record<string, Input>): Declaration<AnyVar> => {
    const value = declaration.value
    if (typeof value === 'string') {
      return declaration
    }
    if (isVar(value)) {
      let touchesRead = false
      for (const name of protocolRefsOf(value)) {
        if (bindings[name] !== undefined) {
          touchesRead = true
          break
        }
      }
      return touchesRead
        ? new DeclarationImpl(declaration.name, bindRead(value, bindings))
        : declaration
    }
    return new DeclarationImpl(
      declaration.name,
      isCalc(value) ? bindCalc(value, bindings) : bindColor(value, bindings),
    )
  },
)

/** @internal */
export function refs<Vars extends AnyVar>(
  declaration: Declaration<Vars>,
): ReadonlySet<VarName<Vars>> {
  return refsOf(declaration) as ReadonlySet<VarName<Vars>>
}

/** @internal */
export const renderWith = (declaration: Declaration<AnyVar>, precision?: Precision): string =>
  `${declaration.name}: ${serializeValue(declaration.value, precision)};`

/** @internal */
export const render = (declaration: Declaration<AnyVar>, options?: RenderOptions): string =>
  renderWith(declaration, options?.precision)

/** @internal */
export const equals = dual<
  (that: Declaration<AnyVar>) => (self: Declaration<AnyVar>) => boolean,
  (self: Declaration<AnyVar>, that: Declaration<AnyVar>) => boolean
>(2, (self: Declaration<AnyVar>, that: Declaration<AnyVar>): boolean => Equal.equals(self, that))
