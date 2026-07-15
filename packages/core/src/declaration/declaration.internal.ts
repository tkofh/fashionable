import type { ApplyBindings, Bindings, Input } from '#calc/calc'
import {
  bind as bindCalc,
  isCalc,
  refsOf as calcRefsOf,
  serialize as serializeCalc,
  toCalc,
} from '#calc/calc.internal'
import type { Precision } from '#calc/precision'
import {
  bind as bindColor,
  refsOf as colorRefsOf,
  serialize as serializeColor,
} from '#data/color.internal'
import * as Equal from '#internal/equal'
import { EMPTY_REFS } from '#internal/refs'
import { dual, invariant, Pipeable } from '#util'
import type { Declaration, RenderOptions, Value } from './declaration.ts'

export const DeclarationTypeId = Symbol.for('fashionable/declaration')
export type DeclarationTypeId = typeof DeclarationTypeId

const valueEquals = (a: Value<string>, b: Value<string>): boolean =>
  typeof a === 'string' || typeof b === 'string' ? a === b : Equal.equals(a, b)

const valueHash = (value: Value<string>): number =>
  typeof value === 'string' ? Equal.hashString(value) : Equal.hash(value)

const serializeValue = (value: Value<string>, precision?: Precision): string => {
  if (typeof value === 'string') {
    return value
  }
  const options = precision === undefined ? {} : { precision }
  return isCalc(value) ? serializeCalc(value, options) : serializeColor(value, options)
}

class DeclarationImpl extends Pipeable implements Declaration<string>, Equal.Equal {
  readonly [DeclarationTypeId]: DeclarationTypeId = DeclarationTypeId

  readonly name: string
  readonly value: Value<string>
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(name: string, value: Value<string>) {
    super()
    this.name = name
    this.value = value
    this.refSet =
      typeof value === 'string'
        ? EMPTY_REFS
        : isCalc(value)
          ? calcRefsOf(value)
          : colorRefsOf(value)
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
export const isDeclaration = (u: unknown): u is Declaration<string> =>
  typeof u === 'object' && u !== null && DeclarationTypeId in u

/** @internal */
export const refsOf = <R extends string>(declaration: Declaration<R>): ReadonlySet<R> =>
  (declaration as unknown as DeclarationImpl).refSet as ReadonlySet<R>

/** @internal */
export function make<Vars extends string = never>(
  name: string,
  value: Value<Vars> | number,
): Declaration<Vars> {
  invariant(name.length > 0, 'Declaration name must be a non-empty string')
  return new DeclarationImpl(
    name,
    typeof value === 'number' ? toCalc(value) : value,
  ) as Declaration<Vars>
}

/** @internal */
export const bind: {
  <const B extends Bindings>(
    bindings: B,
  ): <Vars extends string>(declaration: Declaration<Vars>) => Declaration<ApplyBindings<Vars, B>>
  <Vars extends string, const B extends Bindings>(
    declaration: Declaration<Vars>,
    bindings: B,
  ): Declaration<ApplyBindings<Vars, B>>
} = dual(
  2,
  (
    declaration: Declaration<string>,
    bindings: Record<string, Input<string>>,
  ): Declaration<string> => {
    const value = declaration.value
    if (typeof value === 'string') {
      return declaration
    }
    return new DeclarationImpl(
      declaration.name,
      isCalc(value) ? bindCalc(value, bindings) : bindColor(value, bindings),
    )
  },
)

/** @internal */
export function refs<Vars extends string>(declaration: Declaration<Vars>): ReadonlySet<Vars> {
  return refsOf(declaration)
}

/** @internal */
export const renderWith = (declaration: Declaration<string>, precision?: Precision): string =>
  `${declaration.name}: ${serializeValue(declaration.value, precision)};`

/** @internal */
export const render = (declaration: Declaration<string>, options?: RenderOptions): string =>
  renderWith(declaration, options?.precision)

/** @internal */
export const equals = dual<
  (that: Declaration<string>) => (self: Declaration<string>) => boolean,
  (self: Declaration<string>, that: Declaration<string>) => boolean
>(2, (self: Declaration<string>, that: Declaration<string>): boolean => Equal.equals(self, that))
