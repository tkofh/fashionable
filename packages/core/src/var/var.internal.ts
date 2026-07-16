import * as Equal from '#internal/equal'
import { refsOf, RefsTypeId, unionRefs } from '#internal/refs'
import { dual, invariant, Pipeable } from '#util'
import type { Name as VarName, Var } from './var.ts'

export const VarTypeId = Symbol.for('fashionable/var')
export type VarTypeId = typeof VarTypeId

/**
 * The widest read the runtime handles: any name, any declared type, any
 * fallback. The precise per-context fallback constraints ride the public
 * signatures; the runtime stores the fallback opaquely and reads its vars
 * through the refs protocol.
 *
 * @internal
 */
export type AnyVar = Var<string, unknown, unknown>

class VarImpl extends Pipeable implements Var<string>, Equal.Equal {
  readonly [VarTypeId]: VarTypeId = VarTypeId

  readonly name: string
  readonly fallbackValue: unknown
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(name: string, fallbackValue: unknown) {
    super()
    this.name = name
    this.fallbackValue = fallbackValue
    this.refSet =
      fallbackValue === undefined
        ? new Set([name])
        : unionRefs(new Set([name]), refsOf(fallbackValue))
  }

  get [RefsTypeId](): ReadonlySet<string> {
    return this.refSet
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return (
      isVar(that) &&
      this.name === nameOf(that) &&
      // Equal.equals covers every fallback form: primitives compare by
      // identity, expression values through their own Equal impls.
      Equal.equals(this.fallbackValue, fallbackOf(that))
    )
  }

  [Equal.HashTypeId](): number {
    if (this.#hash === undefined) {
      let h = Equal.hashString('fashionable/var')
      h = Equal.combine(h, Equal.hashString(this.name))
      h = Equal.combine(h, Equal.hash(this.fallbackValue))
      this.#hash = h
    }
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return this.fallbackValue === undefined ? `Var(--${this.name})` : `Var(--${this.name}, ...)`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/**
 * The bottom read — assignable to every precise `Var` return, the same
 * widening discipline as calc's `Bottom`. The loosely-typed runtime returns
 * it; the public signatures carry the real name/type/fallback parameters.
 *
 * @internal
 */
export type BottomVar = Var<never, never, never>

/** @internal */
export const isVar = (u: unknown): u is AnyVar =>
  typeof u === 'object' && u !== null && VarTypeId in u

/** @internal */
export const nameOf = <V extends AnyVar>(v: V): VarName<V> =>
  (v as unknown as VarImpl).name as VarName<V>

/** @internal */
export const fallbackOf = (v: AnyVar): unknown => (v as VarImpl).fallbackValue

/** @internal */
export const refsOfVar = (v: AnyVar): ReadonlySet<string> => (v as VarImpl).refSet

const varCache = new Map<string, AnyVar>()

/** @internal */
export function of<Name extends string>(name: Name): Var<Name> {
  const cached = varCache.get(name)
  if (cached) {
    return cached as Var<Name>
  }
  invariant(name.length > 0, 'Variable name must be a non-empty string')
  const read = new VarImpl(name, undefined)
  varCache.set(name, read)
  return read as Var<Name>
}

/** @internal */
export const fallback: {
  (fb: unknown): (v: AnyVar) => BottomVar
  (v: AnyVar, fb: unknown): BottomVar
} = dual(2, (v: AnyVar, fb: unknown): BottomVar => {
  invariant(fb !== undefined, 'Fallback value must not be undefined')
  return new VarImpl(nameOf(v), fb) as unknown as BottomVar
})

/** @internal */
export function refs(v: AnyVar): ReadonlySet<string> {
  return refsOfVar(v)
}

/** @internal */
export const equals = dual<
  (that: AnyVar) => (self: AnyVar) => boolean,
  (self: AnyVar, that: AnyVar) => boolean
>(2, (self: AnyVar, that: AnyVar): boolean => Equal.equals(self, that))
