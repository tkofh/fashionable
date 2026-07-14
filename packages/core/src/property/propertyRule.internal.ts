import {
  isCalc,
  refsOf as calcRefsOf,
  serialize as serializeCalc,
  toCalc,
} from '../calc/calc.internal.ts'
import type { Calc } from '../calc/calc.ts'
import { refsOf as colorRefsOf, serialize as serializeColor } from '../color/color.internal.ts'
import * as Equal from '../internal/equal.ts'
import { DEFAULT_INDENT, quote, renderBlock } from '../internal/render.ts'
import { dual, invariant, Pipeable } from '../utils.ts'
import type { PropertyRule, RenderOptions, Value } from './propertyRule.ts'
import { isUniversal, render as renderSyntax, universal } from './propertySyntax.internal.ts'
import type { PropertySyntax } from './propertySyntax.ts'

export const PropertyRuleTypeId = Symbol.for('fashionable/property/propertyRule')
export type PropertyRuleTypeId = typeof PropertyRuleTypeId

const valueEquals = (a: Value | undefined, b: Value | undefined): boolean => {
  if (a === undefined || b === undefined || typeof a === 'string' || typeof b === 'string') {
    return a === b
  }
  return Equal.equals(a, b)
}

const valueHash = (value: Value | undefined): number => {
  if (value === undefined) {
    return 0
  }
  return typeof value === 'string' ? Equal.hashString(value) : Equal.hash(value)
}

const serializeValue = (value: Value, options?: RenderOptions): string => {
  if (typeof value === 'string') {
    return value
  }
  const serializeOptions = options?.precision === undefined ? {} : { precision: options.precision }
  return isCalc(value)
    ? serializeCalc(value, serializeOptions)
    : serializeColor(value, serializeOptions)
}

class PropertyRuleImpl extends Pipeable implements PropertyRule, Equal.Equal {
  readonly [PropertyRuleTypeId]: PropertyRuleTypeId = PropertyRuleTypeId

  readonly name: `--${string}`
  readonly syntax: PropertySyntax
  readonly inherits: boolean
  readonly initialValue: Value | undefined
  #hash: number | undefined

  constructor(
    name: `--${string}`,
    syntax: PropertySyntax,
    inherits: boolean,
    initialValue: Value | undefined,
  ) {
    super()
    this.name = name
    this.syntax = syntax
    this.inherits = inherits
    this.initialValue = initialValue
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return (
      isPropertyRule(that) &&
      this.name === that.name &&
      Equal.equals(this.syntax, that.syntax) &&
      this.inherits === that.inherits &&
      valueEquals(this.initialValue, that.initialValue)
    )
  }

  [Equal.HashTypeId](): number {
    if (this.#hash === undefined) {
      let h = Equal.hashString('fashionable/property/propertyRule')
      h = Equal.combine(h, Equal.hashString(this.name))
      h = Equal.combine(h, Equal.hash(this.syntax))
      h = Equal.combine(h, this.inherits ? 1 : 0)
      h = Equal.combine(h, valueHash(this.initialValue))
      this.#hash = h
    }
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `PropertyRule(${this.name})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isPropertyRule = (u: unknown): u is PropertyRule =>
  typeof u === 'object' && u !== null && PropertyRuleTypeId in u

/** @internal */
export const make = (
  name: `--${string}`,
  syntax: PropertySyntax = universal,
  initialValue?: Value | number,
): PropertyRule => {
  invariant(
    name.startsWith('--') && name.length > 2,
    'Property rule name must be a custom property name (--name)',
  )
  const value =
    typeof initialValue === 'number' ? (toCalc(initialValue) as Calc<never>) : initialValue
  invariant(
    isUniversal(syntax) || value !== undefined,
    '@property requires an initial-value unless its syntax is the universal syntax',
  )
  if (value !== undefined && typeof value !== 'string') {
    const refs = isCalc(value) ? calcRefsOf(value) : colorRefsOf(value)
    invariant(
      refs.size === 0,
      '@property initial values must be computationally independent — no unbound references',
    )
  }
  return new PropertyRuleImpl(name, syntax, false, value)
}

/** @internal */
export const inheritable = (rule: PropertyRule): PropertyRule =>
  rule.inherits ? rule : new PropertyRuleImpl(rule.name, rule.syntax, true, rule.initialValue)

/** @internal */
export const render = (rule: PropertyRule, options?: RenderOptions): string => {
  const indent = options?.indent ?? DEFAULT_INDENT
  const declarations: Array<string> = [
    `syntax: ${quote(renderSyntax(rule.syntax))}`,
    `inherits: ${rule.inherits ? 'true' : 'false'}`,
  ]
  if (rule.initialValue !== undefined) {
    declarations.push(`initial-value: ${serializeValue(rule.initialValue, options)}`)
  }
  return renderBlock(`@property ${rule.name}`, declarations, indent)
}

/** @internal */
export const equals = dual<
  (that: PropertyRule) => (self: PropertyRule) => boolean,
  (self: PropertyRule, that: PropertyRule) => boolean
>(2, (self: PropertyRule, that: PropertyRule): boolean => Equal.equals(self, that))
