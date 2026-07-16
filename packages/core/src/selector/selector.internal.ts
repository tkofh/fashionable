import * as Equal from '#internal/equal'
import { dual, invariant, Pipeable } from '#util'
import type {
  AttributeOperator,
  Parent,
  Requirement,
  Selector,
  SelectorRequires,
} from './selector.ts'
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

type FunctionalPseudoName = 'has' | 'is' | 'not' | 'where'

/** @internal */
export type SelectorPart =
  | { readonly _tag: 'Universal' }
  | { readonly _tag: 'Type'; readonly name: string }
  | { readonly _tag: 'Nest' }
  | { readonly _tag: 'Id'; readonly name: string }
  | { readonly _tag: 'ClassName'; readonly name: string }
  | { readonly _tag: 'PseudoClass'; readonly name: string }
  | {
      readonly _tag: 'Attribute'
      readonly name: string
      readonly match: AttributeValueMatch | undefined
    }
  | {
      readonly _tag: 'Functional'
      readonly name: FunctionalPseudoName
      readonly args: ReadonlyArray<Selector<Requirement>>
    }
  | { readonly _tag: 'PseudoElement'; readonly name: string }

// The canonical part order. Any fixed order renders a semantically
// identical compound; this one is chosen so root-scoped house shapes
// render in their conventional spelling — simple pseudo-classes precede
// attribute qualifiers and functional pseudos (`:root[data-scheme='dark']`,
// `:root:not([data-scheme='light'])`) — while respecting the grammar's own
// constraints. A type selector must come first even beside the nesting
// selector (css-nesting-1: `&div` is illegal, `div&` is not), so `&`
// takes the slot just after the type; the functional pseudo-classes
// (`:is`, `:where`, `:has`, `:not`) share one slot; the pseudo-element
// stays last.
const partRank = (part: SelectorPart): number => {
  switch (part._tag) {
    case 'Universal':
    case 'Type':
      return 0
    case 'Nest':
      return 1
    case 'Id':
      return 2
    case 'ClassName':
      return 3
    case 'PseudoClass':
      return 4
    case 'Attribute':
      return 5
    case 'Functional':
      return 6
    case 'PseudoElement':
      return 7
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
    case 'Nest':
      return '&'
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
    case 'Functional':
      return `:${part.name}(${part.args.map(renderImpl).join(', ')})`
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
    case 'Nest':
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
    case 'Functional': {
      const other = b as typeof a
      return (
        a.name === other.name &&
        a.args.length === other.args.length &&
        a.args.every((argument, index) => Equal.equals(argument, other.args[index]))
      )
    }
  }
}

const partHash = (part: SelectorPart): number => {
  let h = Equal.hashString(part._tag)
  switch (part._tag) {
    case 'Universal':
    case 'Nest':
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
    case 'Functional':
      h = Equal.combine(h, Equal.hashString(part.name))
      for (const argument of part.args) {
        h = Equal.combine(h, Equal.hash(argument))
      }
      return h
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

/** @internal */
export type Combinator = ' ' | '>' | '+' | '~'

type Compound = ReadonlyArray<SelectorPart>

// A selector is a non-empty sequence of compounds joined by combinators
// (combinators.length === compounds.length - 1); one compound and no
// combinators is the simple case. `needsParent` is the runtime mirror of
// the `Parent` brand in `Requires`: true when a `Nest` part appears
// anywhere in the tree, functional-pseudo arguments included.
class SelectorImpl extends Pipeable implements Selector<Requirement>, Equal.Equal {
  readonly [SelectorTypeId]: SelectorTypeId = SelectorTypeId

  readonly compounds: ReadonlyArray<Compound>
  readonly combinators: ReadonlyArray<Combinator>
  readonly needsParent: boolean
  #hash: number | undefined

  constructor(compounds: ReadonlyArray<Compound>, combinators: ReadonlyArray<Combinator>) {
    super()
    this.compounds = compounds
    this.combinators = combinators
    this.needsParent = compounds.some((compound) => compound.some(partNeedsParent))
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    if (!isSelector(that)) {
      return false
    }
    const other = that as SelectorImpl
    return (
      this.compounds.length === other.compounds.length &&
      this.combinators.every((combinator, index) => combinator === other.combinators[index]) &&
      this.compounds.every((compound, index) => {
        const others = other.compounds[index] as Compound
        return (
          compound.length === others.length &&
          compound.every((part, partIndex) => partEquals(part, others[partIndex] as SelectorPart))
        )
      })
    )
  }

  [Equal.HashTypeId](): number {
    if (this.#hash === undefined) {
      let h = Equal.hashString('fashionable/selector')
      for (const [index, compound] of this.compounds.entries()) {
        if (index > 0) {
          h = Equal.combine(h, Equal.hashString(this.combinators[index - 1] as Combinator))
        }
        for (const part of compound) {
          h = Equal.combine(h, partHash(part))
        }
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
export const isSelector = (u: unknown): u is Selector<Requirement> =>
  typeof u === 'object' && u !== null && SelectorTypeId in u

const impl = (selector: Selector<Requirement>): SelectorImpl => selector as SelectorImpl

const partNeedsParent = (part: SelectorPart): boolean =>
  part._tag === 'Nest' ||
  (part._tag === 'Functional' && part.args.some((argument) => impl(argument).needsParent))

/** @internal */
export const needsParent = (selector: Selector<Requirement>): boolean => impl(selector).needsParent

const isCompound = (selector: Selector<Requirement>): boolean =>
  impl(selector).compounds.length === 1

const headCompound = (selector: Selector<Requirement>): Compound =>
  impl(selector).compounds[0] as Compound

const lastCompound = (selector: Selector<Requirement>): Compound =>
  impl(selector).compounds[impl(selector).compounds.length - 1] as Compound

const single = (part: SelectorPart): Selector =>
  new SelectorImpl([[part]], []) as unknown as Selector

const requireName = (name: string, what: string): void => {
  invariant(name.length > 0, `${what} name must be a non-empty string`)
}

// ---------------------------------------------------------------------------
// constructors
// ---------------------------------------------------------------------------

/** @internal */
export const universal: Selector = single({ _tag: 'Universal' })

/** @internal */
export const nest: Selector<Parent> = single({ _tag: 'Nest' })

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
export const pseudoElement = (name: string): Selector => {
  requireName(name, 'Pseudo-element')
  return single({ _tag: 'PseudoElement', name })
}

/** @internal */
export const root: Selector = pseudoClass('root')

// ---------------------------------------------------------------------------
// functional pseudo-classes over selector lists
// ---------------------------------------------------------------------------

const sortArgs = (
  args: ReadonlyArray<Selector<Requirement>>,
): ReadonlyArray<Selector<Requirement>> =>
  [...args].toSorted((x, y) => {
    const a = renderImpl(x)
    const b = renderImpl(y)
    return a < b ? -1 : a > b ? 1 : 0
  })

const functional = (
  name: FunctionalPseudoName,
  args: ReadonlyArray<Selector<Requirement>>,
): Selector<Requirement> => {
  invariant(args.length > 0, `:${name}() requires at least one selector argument`)
  return new SelectorImpl([[{ _tag: 'Functional', name, args: sortArgs(args) }]], [])
}

/** @internal */
export function is<Args extends ReadonlyArray<Selector<Requirement>>>(
  ...selectors: Args
): Selector<SelectorRequires<Args[number]>> {
  return functional('is', selectors) as Selector<SelectorRequires<Args[number]>>
}

/** @internal */
export function where<Args extends ReadonlyArray<Selector<Requirement>>>(
  ...selectors: Args
): Selector<SelectorRequires<Args[number]>> {
  return functional('where', selectors) as Selector<SelectorRequires<Args[number]>>
}

/** @internal */
export function has<Args extends ReadonlyArray<Selector<Requirement>>>(
  ...selectors: Args
): Selector<SelectorRequires<Args[number]>> {
  return functional('has', selectors) as Selector<SelectorRequires<Args[number]>>
}

/** @internal */
export function not<Args extends ReadonlyArray<Selector<Requirement>>>(
  ...selectors: Args
): Selector<SelectorRequires<Args[number]>> {
  return functional('not', selectors) as Selector<SelectorRequires<Args[number]>>
}

// ---------------------------------------------------------------------------
// combinators and projections
// ---------------------------------------------------------------------------

/** @internal */
export const and: {
  <B extends Requirement>(
    that: Selector<B>,
  ): <A extends Requirement>(self: Selector<A>) => Selector<A | B>
  <A extends Requirement, B extends Requirement>(
    self: Selector<A>,
    that: Selector<B>,
  ): Selector<A | B>
} = dual(2, (self: Selector<Requirement>, that: Selector<Requirement>): Selector<Requirement> => {
  invariant(
    isCompound(self) && isCompound(that),
    'Only compound selectors merge with and — join complex selectors with a combinator or a selector list instead',
  )
  const parts = [...headCompound(self), ...headCompound(that)]
  validateCompound(parts)
  return new SelectorImpl([sortParts(parts)], [])
})

type CombinatorConstructor = {
  <B extends Requirement>(
    that: Selector<B>,
  ): <A extends Requirement>(self: Selector<A>) => Selector<A | B>
  <A extends Requirement, B extends Requirement>(
    self: Selector<A>,
    that: Selector<B>,
  ): Selector<A | B>
}

const combinatorConstructor = (combinator: Combinator): CombinatorConstructor =>
  dual(2, (self: Selector<Requirement>, that: Selector<Requirement>): Selector<Requirement> => {
    invariant(
      !lastCompound(self).some((part) => part._tag === 'PseudoElement'),
      'A pseudo-element cannot be followed by a combinator',
    )
    return new SelectorImpl(
      [...impl(self).compounds, ...impl(that).compounds],
      [...impl(self).combinators, combinator, ...impl(that).combinators],
    )
  })

/** @internal */
export const descendant: CombinatorConstructor = combinatorConstructor(' ')

/** @internal */
export const child: CombinatorConstructor = combinatorConstructor('>')

/** @internal */
export const nextSibling: CombinatorConstructor = combinatorConstructor('+')

/** @internal */
export const subsequentSibling: CombinatorConstructor = combinatorConstructor('~')

/** @internal */
export const under: {
  <P extends Requirement>(
    parent: Selector<P>,
  ): <C extends Requirement>(child: Selector<C>) => Selector<Exclude<C, Parent> | P>
  <C extends Requirement, P extends Requirement>(
    child: Selector<C>,
    parent: Selector<P>,
  ): Selector<Exclude<C, Parent> | P>
} = dual(
  2,
  (nested: Selector<Requirement>, parent: Selector<Requirement>): Selector<Requirement> => {
    if (!impl(nested).needsParent) {
      return nested
    }
    const compounds = impl(nested).compounds.map((compound) => {
      const parts: Array<SelectorPart> = []
      for (const part of compound) {
        if (part._tag === 'Nest') {
          if (isCompound(parent)) {
            parts.push(...headCompound(parent))
          } else {
            parts.push({ _tag: 'Functional', name: 'is', args: [parent] })
          }
        } else if (part._tag === 'Functional' && part.args.some(needsParent)) {
          parts.push({
            _tag: 'Functional',
            name: part.name,
            args: sortArgs(part.args.map((argument) => under(argument, parent))),
          })
        } else {
          parts.push(part)
        }
      }
      validateCompound(parts)
      return sortParts(parts)
    })
    return new SelectorImpl(compounds, impl(nested).combinators)
  },
)

const renderCompound = (compound: Compound): string => compound.map(renderPart).join('')

const renderImpl = (selector: Selector<Requirement>): string => {
  const value = impl(selector)
  let text = renderCompound(value.compounds[0] as Compound)
  for (let index = 1; index < value.compounds.length; index++) {
    const combinator = value.combinators[index - 1] as Combinator
    text += combinator === ' ' ? ' ' : ` ${combinator} `
    text += renderCompound(value.compounds[index] as Compound)
  }
  return text
}

/** @internal */
export const render = (selector: Selector<Requirement>): string => renderImpl(selector)

const maxSpecificity = (args: ReadonlyArray<Selector<Requirement>>): Specificity => {
  let best = specificityImpl(args[0] as Selector<Requirement>)
  for (const argument of args.slice(1)) {
    const candidate = specificityImpl(argument)
    if (specificity_.compare(candidate, best) === 1) {
      best = candidate
    }
  }
  return best
}

const partSpecificity = (part: SelectorPart): Specificity => {
  switch (part._tag) {
    case 'Universal':
      return specificity_.zero
    case 'Nest':
      invariant(
        false,
        'The nesting selector takes its specificity from the parent rule — resolve the selector with under before measuring it',
      )
      break
    case 'Id':
      return specificity_.make(1, 0, 0)
    case 'ClassName':
    case 'PseudoClass':
    case 'Attribute':
      return specificity_.make(0, 1, 0)
    case 'Type':
    case 'PseudoElement':
      return specificity_.make(0, 0, 1)
    case 'Functional':
      return part.name === 'where' ? specificity_.zero : maxSpecificity(part.args)
  }
}

const specificityImpl = (selector: Selector<Requirement>): Specificity =>
  specificity_.sum(impl(selector).compounds.flatMap((compound) => compound.map(partSpecificity)))

/** @internal */
export const specificity = (selector: Selector<Requirement>): Specificity =>
  specificityImpl(selector)

/** @internal */
export const equals = dual<
  (that: Selector<Requirement>) => (self: Selector<Requirement>) => boolean,
  (self: Selector<Requirement>, that: Selector<Requirement>) => boolean
>(2, (self: Selector<Requirement>, that: Selector<Requirement>): boolean =>
  Equal.equals(self, that),
)
