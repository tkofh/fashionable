import * as Equal from '../internal/equal.ts'
import { dual, invariant, Pipeable } from '../utils.ts'
import type { AttributeOperator, Selector } from './selector.ts'
import * as specificity_ from './specificity.internal.ts'
import type { Specificity } from './specificity.ts'

export const SelectorTypeId = Symbol.for('fashionable/selector')
export type SelectorTypeId = typeof SelectorTypeId

// ---------------------------------------------------------------------------
// part ADT
// ---------------------------------------------------------------------------

interface AttributeValueMatch {
  readonly operator: AttributeOperator
  readonly value: string
}

/** @internal */
export type SelectorPart =
  | { readonly _tag: 'Universal' }
  | { readonly _tag: 'Type'; readonly name: string }
  | { readonly _tag: 'Id'; readonly name: string }
  | { readonly _tag: 'ClassName'; readonly name: string }
  | { readonly _tag: 'PseudoClass'; readonly name: string }
  | {
      readonly _tag: 'Attribute'
      readonly name: string
      readonly match: AttributeValueMatch | undefined
    }
  | { readonly _tag: 'Not'; readonly argument: Selector }
  | { readonly _tag: 'PseudoElement'; readonly name: string }

// The canonical part order. Any fixed order renders a semantically
// identical compound; this one is chosen so root-scoped house shapes
// render in their conventional spelling — simple pseudo-classes precede
// attribute qualifiers and negations (`:root[data-scheme='dark']`,
// `:root:not([data-scheme='light'])`) — while respecting the grammar's own
// constraints (type first, pseudo-element last).
const partRank = (part: SelectorPart): number => {
  switch (part._tag) {
    case 'Universal':
    case 'Type':
      return 0
    case 'Id':
      return 1
    case 'ClassName':
      return 2
    case 'PseudoClass':
      return 3
    case 'Attribute':
      return 4
    case 'Not':
      return 5
    case 'PseudoElement':
      return 6
  }
}

const escapeAttributeValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const renderPart = (part: SelectorPart): string => {
  switch (part._tag) {
    case 'Universal':
      return '*'
    case 'Type':
      return part.name
    case 'Id':
      return `#${part.name}`
    case 'ClassName':
      return `.${part.name}`
    case 'PseudoClass':
      return `:${part.name}`
    case 'Attribute': {
      if (part.match === undefined) {
        return `[${part.name}]`
      }
      return `[${part.name}${part.match.operator}'${escapeAttributeValue(part.match.value)}']`
    }
    case 'Not':
      return `:not(${renderImpl(part.argument)})`
    case 'PseudoElement':
      return `::${part.name}`
  }
}

const partEquals = (a: SelectorPart, b: SelectorPart): boolean => {
  if (a._tag !== b._tag) {
    return false
  }
  switch (a._tag) {
    case 'Universal':
      return true
    case 'Type':
    case 'Id':
    case 'ClassName':
    case 'PseudoClass':
    case 'PseudoElement':
      return a.name === (b as typeof a).name
    case 'Attribute': {
      const other = b as typeof a
      if (a.name !== other.name) {
        return false
      }
      if (a.match === undefined || other.match === undefined) {
        return a.match === other.match
      }
      return a.match.operator === other.match.operator && a.match.value === other.match.value
    }
    case 'Not':
      return Equal.equals(a.argument, (b as typeof a).argument)
  }
}

const partHash = (part: SelectorPart): number => {
  let h = Equal.hashString(part._tag)
  switch (part._tag) {
    case 'Universal':
      return h
    case 'Type':
    case 'Id':
    case 'ClassName':
    case 'PseudoClass':
    case 'PseudoElement':
      return Equal.combine(h, Equal.hashString(part.name))
    case 'Attribute':
      h = Equal.combine(h, Equal.hashString(part.name))
      if (part.match !== undefined) {
        h = Equal.combine(h, Equal.hashString(part.match.operator))
        h = Equal.combine(h, Equal.hashString(part.match.value))
      }
      return h
    case 'Not':
      return Equal.combine(h, Equal.hash(part.argument))
  }
}

const sortParts = (parts: ReadonlyArray<SelectorPart>): ReadonlyArray<SelectorPart> =>
  [...parts].toSorted((x, y) => {
    const rank = partRank(x) - partRank(y)
    if (rank !== 0) {
      return rank
    }
    const a = renderPart(x)
    const b = renderPart(y)
    return a < b ? -1 : a > b ? 1 : 0
  })

const validateCompound = (parts: ReadonlyArray<SelectorPart>): void => {
  invariant(parts.length > 0, 'A compound selector must contain at least one part')
  let typeCount = 0
  let pseudoElementCount = 0
  for (const part of parts) {
    if (part._tag === 'Universal' || part._tag === 'Type') {
      typeCount++
    } else if (part._tag === 'PseudoElement') {
      pseudoElementCount++
    }
  }
  invariant(
    typeCount <= 1,
    'A compound selector may contain at most one type or universal selector',
  )
  invariant(pseudoElementCount <= 1, 'A compound selector may contain at most one pseudo-element')
}

// ---------------------------------------------------------------------------
// the value
// ---------------------------------------------------------------------------

class SelectorImpl extends Pipeable implements Selector, Equal.Equal {
  readonly [SelectorTypeId]: SelectorTypeId = SelectorTypeId

  readonly parts: ReadonlyArray<SelectorPart>
  #hash: number | undefined

  constructor(parts: ReadonlyArray<SelectorPart>) {
    super()
    this.parts = parts
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return (
      isSelector(that) &&
      this.parts.length === partsOf(that).length &&
      this.parts.every((part, index) => partEquals(part, partsOf(that)[index] as SelectorPart))
    )
  }

  [Equal.HashTypeId](): number {
    if (this.#hash === undefined) {
      let h = Equal.hashString('fashionable/selector')
      for (const part of this.parts) {
        h = Equal.combine(h, partHash(part))
      }
      this.#hash = h
    }
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `Selector(${renderImpl(this)})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isSelector = (u: unknown): u is Selector =>
  typeof u === 'object' && u !== null && SelectorTypeId in u

const partsOf = (selector: Selector): ReadonlyArray<SelectorPart> =>
  (selector as SelectorImpl).parts

const single = (part: SelectorPart): Selector => new SelectorImpl([part])

const requireName = (name: string, what: string): void => {
  invariant(name.length > 0, `${what} name must be a non-empty string`)
}

// ---------------------------------------------------------------------------
// constructors
// ---------------------------------------------------------------------------

/** @internal */
export const universal: Selector = single({ _tag: 'Universal' })

/** @internal */
export const type = (name: string): Selector => {
  requireName(name, 'Type selector')
  return single({ _tag: 'Type', name })
}

/** @internal */
export const id = (name: string): Selector => {
  requireName(name, 'Id selector')
  return single({ _tag: 'Id', name })
}

/** @internal */
export const _class = (name: string): Selector => {
  requireName(name, 'Class selector')
  return single({ _tag: 'ClassName', name })
}

/** @internal */
export const pseudoClass = (name: string): Selector => {
  requireName(name, 'Pseudo-class')
  return single({ _tag: 'PseudoClass', name })
}

const ATTRIBUTE_OPERATORS: ReadonlySet<string> = new Set(['=', '~=', '|=', '^=', '$=', '*='])

/** @internal */
export function attribute(name: string): Selector
/** @internal */
export function attribute(name: string, value: string): Selector
/** @internal */
export function attribute(name: string, operator: AttributeOperator, value: string): Selector
/** @internal */
export function attribute(name: string, operatorOrValue?: string, value?: string): Selector {
  requireName(name, 'Attribute')
  if (operatorOrValue === undefined) {
    return single({ _tag: 'Attribute', name, match: undefined })
  }
  if (value === undefined) {
    return single({ _tag: 'Attribute', name, match: { operator: '=', value: operatorOrValue } })
  }
  invariant(
    ATTRIBUTE_OPERATORS.has(operatorOrValue),
    `Attribute operator must be one of =, ~=, |=, ^=, $=, *=, got '${operatorOrValue}'`,
  )
  return single({
    _tag: 'Attribute',
    name,
    match: { operator: operatorOrValue as AttributeOperator, value },
  })
}

/** @internal */
export const not = (argument: Selector): Selector => single({ _tag: 'Not', argument })

/** @internal */
export const pseudoElement = (name: string): Selector => {
  requireName(name, 'Pseudo-element')
  return single({ _tag: 'PseudoElement', name })
}

/** @internal */
export const root: Selector = pseudoClass('root')

// ---------------------------------------------------------------------------
// combinators and projections
// ---------------------------------------------------------------------------

/** @internal */
export const and = dual<
  (that: Selector) => (self: Selector) => Selector,
  (self: Selector, that: Selector) => Selector
>(2, (self: Selector, that: Selector): Selector => {
  const parts = [...partsOf(self), ...partsOf(that)]
  validateCompound(parts)
  return new SelectorImpl(sortParts(parts))
})

const renderImpl = (selector: Selector): string => partsOf(selector).map(renderPart).join('')

/** @internal */
export const render = (selector: Selector): string => renderImpl(selector)

const partSpecificity = (part: SelectorPart): Specificity => {
  switch (part._tag) {
    case 'Universal':
      return specificity_.zero
    case 'Id':
      return specificity_.make(1, 0, 0)
    case 'ClassName':
    case 'PseudoClass':
    case 'Attribute':
      return specificity_.make(0, 1, 0)
    case 'Type':
    case 'PseudoElement':
      return specificity_.make(0, 0, 1)
    case 'Not':
      return specificity(part.argument)
  }
}

/** @internal */
export const specificity = (selector: Selector): Specificity =>
  specificity_.sum(partsOf(selector).map(partSpecificity))

/** @internal */
export const equals = dual<
  (that: Selector) => (self: Selector) => boolean,
  (self: Selector, that: Selector) => boolean
>(2, (self: Selector, that: Selector): boolean => Equal.equals(self, that))
