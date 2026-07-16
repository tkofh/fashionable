import type { Calc } from '#calc/calc'
import {
  isCalc,
  refsOf as calcRefsOf,
  serialize as serializeCalc,
  toCalc,
} from '#calc/calc.internal'
import { refsOf as colorRefsOf, serialize as serializeColor } from '#data/color.internal'
import * as Equal from '#internal/equal'
import { DEFAULT_INDENT, quote, renderBlock } from '#internal/render'
import { dual, invariant, Pipeable } from '#util'
import {
  type AnyVar,
  type DeclaredType,
  declaredTypeOf,
  fallbackOf,
  isVar,
  nameOf as varNameOf,
} from '#var/var.internal'
import type { PropertyRule, RenderOptions, Value } from './propertyRule.ts'
import {
  angle as angleSyntax,
  color as colorSyntax,
  isPropertySyntax,
  isUniversal,
  length as lengthSyntax,
  lengthPercentage as lengthPercentageSyntax,
  number as numberSyntax,
  percentage as percentageSyntax,
  render as renderSyntax,
  universal,
} from './propertySyntax.internal.ts'
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

// The canonical syntax each declared type derives — and the set the
// consistency check compares an explicit syntax against: registering a
// declared handle under a *different* canonical data type is certainly
// wrong, while combinations and multiplied lists pass unchecked (whether
// they cover the declared type would take grammar containment checking,
// which this library does not do).
const DERIVED_SYNTAX: Record<DeclaredType, PropertySyntax> = {
  number: numberSyntax,
  length: lengthSyntax,
  'length-percentage': lengthPercentageSyntax,
  angle: angleSyntax,
  percentage: percentageSyntax,
  color: colorSyntax,
}

/** @internal */
export const make = (
  nameOrHandle: `--${string}` | AnyVar,
  syntaxOrInitial?: PropertySyntax | Value | number,
  initialArg?: Value | number,
): PropertyRule => {
  // the deriving form (`make(handle, initial)`) puts the initial value in
  // the syntax slot; dispatch on what actually arrived
  let syntax: PropertySyntax | undefined
  let initialValue: Value | number | undefined
  if (isPropertySyntax(syntaxOrInitial)) {
    syntax = syntaxOrInitial
    initialValue = initialArg
  } else {
    syntax = undefined
    initialValue = syntaxOrInitial ?? initialArg
  }
  let name: `--${string}`
  if (isVar(nameOrHandle)) {
    invariant(
      fallbackOf(nameOrHandle) === undefined,
      'A registration takes the bare handle — a fallback belongs to a read site, not the property',
    )
    name = `--${varNameOf(nameOrHandle)}`
    const declared = declaredTypeOf(nameOrHandle)
    if (declared !== undefined) {
      if (syntax === undefined) {
        syntax = DERIVED_SYNTAX[declared]
      } else {
        for (const [type, canonical] of Object.entries(DERIVED_SYNTAX)) {
          invariant(
            type === declared || !Equal.equals(syntax, canonical),
            `The explicit syntax contradicts the handle's declared type (${declared})`,
          )
        }
      }
    }
  } else {
    name = nameOrHandle
  }
  syntax ??= universal
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
