import type { Calc } from '../calc/calc.ts'
import type { Color } from '../color/color.ts'
import * as Equal from '../internal/equal.ts'
import { dual, invariant, Pipeable } from '../utils.ts'
import type { PropertySyntax, Universal, ValueOf } from './propertySyntax.ts'

export const PropertySyntaxTypeId = Symbol.for('fashionable/property/propertySyntax')
export type PropertySyntaxTypeId = typeof PropertySyntaxTypeId

type SyntaxNode =
  | { readonly _tag: 'Universal' }
  | { readonly _tag: 'DataType'; readonly name: string }
  | { readonly _tag: 'Keyword'; readonly name: string }
  | {
      readonly _tag: 'List'
      readonly component: SyntaxNode
      readonly separator: 'space' | 'comma'
    }
  | { readonly _tag: 'OneOf'; readonly components: ReadonlyArray<SyntaxNode> }

const renderNode = (node: SyntaxNode): string => {
  switch (node._tag) {
    case 'Universal':
      return '*'
    case 'DataType':
      return `<${node.name}>`
    case 'Keyword':
      return node.name
    case 'List':
      return `${renderNode(node.component)}${node.separator === 'space' ? '+' : '#'}`
    case 'OneOf':
      return node.components.map(renderNode).join(' | ')
  }
}

const nodeEquals = (a: SyntaxNode, b: SyntaxNode): boolean => {
  if (a._tag !== b._tag) {
    return false
  }
  switch (a._tag) {
    case 'Universal':
      return true
    case 'DataType':
    case 'Keyword':
      return a.name === (b as typeof a).name
    case 'List': {
      const other = b as typeof a
      return a.separator === other.separator && nodeEquals(a.component, other.component)
    }
    case 'OneOf': {
      const other = b as typeof a
      return (
        a.components.length === other.components.length &&
        a.components.every((component, index) =>
          nodeEquals(component, other.components[index] as SyntaxNode),
        )
      )
    }
  }
}

const nodeHash = (node: SyntaxNode): number => {
  let h = Equal.hashString(node._tag)
  switch (node._tag) {
    case 'Universal':
      return h
    case 'DataType':
    case 'Keyword':
      return Equal.combine(h, Equal.hashString(node.name))
    case 'List':
      h = Equal.combine(h, Equal.hashString(node.separator))
      return Equal.combine(h, nodeHash(node.component))
    case 'OneOf':
      for (const component of node.components) {
        h = Equal.combine(h, nodeHash(component))
      }
      return h
  }
}

class PropertySyntaxImpl extends Pipeable implements PropertySyntax, Equal.Equal {
  readonly [PropertySyntaxTypeId]: PropertySyntaxTypeId = PropertySyntaxTypeId

  readonly node: SyntaxNode
  #hash: number | undefined

  constructor(node: SyntaxNode) {
    super()
    this.node = node
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return isPropertySyntax(that) && nodeEquals(this.node, nodeOf(that))
  }

  [Equal.HashTypeId](): number {
    this.#hash ??= Equal.combine(
      Equal.hashString('fashionable/property/propertySyntax'),
      nodeHash(this.node),
    )
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `PropertySyntax(${renderNode(this.node)})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isPropertySyntax = (u: unknown): u is PropertySyntax =>
  typeof u === 'object' && u !== null && PropertySyntaxTypeId in u

const nodeOf = (syntax: PropertySyntax<unknown>): SyntaxNode => (syntax as PropertySyntaxImpl).node

/** @internal */
export const isUniversal = (syntax: PropertySyntax<unknown>): boolean =>
  nodeOf(syntax)._tag === 'Universal'

const dataType = <V>(name: string): PropertySyntax<V> =>
  new PropertySyntaxImpl({ _tag: 'DataType', name }) as PropertySyntax<V>

/** @internal */
export const universal: Universal = new PropertySyntaxImpl({
  _tag: 'Universal',
}) as unknown as Universal

/** @internal */
export const angle: PropertySyntax<string> = dataType('angle')
/** @internal */
export const color: PropertySyntax<string | Color<never>> = dataType('color')
/** @internal */
export const customIdent: PropertySyntax<string> = dataType('custom-ident')
/** @internal */
export const image: PropertySyntax<string> = dataType('image')
/** @internal */
export const integer: PropertySyntax<number | Calc<never>> = dataType('integer')
/** @internal */
export const length: PropertySyntax<string> = dataType('length')
/** @internal */
export const lengthPercentage: PropertySyntax<string> = dataType('length-percentage')
/** @internal */
export const number: PropertySyntax<number | Calc<never>> = dataType('number')
/** @internal */
export const percentage: PropertySyntax<string> = dataType('percentage')
/** @internal */
export const resolution: PropertySyntax<string> = dataType('resolution')
/** @internal */
export const string: PropertySyntax<string> = dataType('string')
/** @internal */
export const time: PropertySyntax<string> = dataType('time')
/** @internal */
export const transformFunction: PropertySyntax<string> = dataType('transform-function')
/** @internal */
export const transformList: PropertySyntax<string> = dataType('transform-list')
/** @internal */
export const url: PropertySyntax<string> = dataType('url')

const CSS_WIDE_KEYWORDS: ReadonlySet<string> = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'default',
])

/** @internal */
export const keyword = <const K extends string>(name: K): PropertySyntax<K> => {
  invariant(name.length > 0, 'Keyword must be a non-empty string')
  invariant(
    !CSS_WIDE_KEYWORDS.has(name.toLowerCase()),
    `Keyword must not be a CSS-wide keyword, got '${name}'`,
  )
  return new PropertySyntaxImpl({ _tag: 'Keyword', name }) as PropertySyntax<K>
}

/** @internal */
export const keywords = <const Names extends readonly [string, ...ReadonlyArray<string>]>(
  ...names: Names
): PropertySyntax<Names[number]> => {
  const syntaxes = names.map((name) => keyword(name))
  if (syntaxes.length === 1) {
    return syntaxes[0] as PropertySyntax<Names[number]>
  }
  return new PropertySyntaxImpl({
    _tag: 'OneOf',
    components: syntaxes.map(nodeOf),
  }) as PropertySyntax<Names[number]>
}

/** @internal */
export function oneOf<
  const Components extends readonly [
    PropertySyntax<unknown>,
    PropertySyntax<unknown>,
    ...ReadonlyArray<PropertySyntax<unknown>>,
  ],
>(...components: Components): PropertySyntax<ValueOf<Components[number]>> {
  const nodes = components.flatMap((component) => {
    const node = nodeOf(component)
    return node._tag === 'OneOf' ? node.components : [node]
  })
  for (const node of nodes) {
    invariant(
      node._tag !== 'Universal',
      'The universal syntax stands alone — it cannot join a combination',
    )
  }
  return new PropertySyntaxImpl({ _tag: 'OneOf', components: nodes }) as PropertySyntax<
    ValueOf<Components[number]>
  >
}

const requireMultipliable = (node: SyntaxNode): void => {
  invariant(node._tag !== 'Universal', 'The universal syntax cannot be multiplied')
  invariant(node._tag !== 'OneOf', 'A multiplier applies to a single component, not a combination')
  invariant(node._tag !== 'List', 'A component takes at most one multiplier')
  invariant(
    node._tag !== 'DataType' || node.name !== 'transform-list',
    '<transform-list> is pre-multiplied and takes no multiplier',
  )
}

const listWith =
  (separator: 'space' | 'comma') =>
  <V>(component: PropertySyntax<V>): PropertySyntax<V | (string & {})> => {
    const node = nodeOf(component)
    requireMultipliable(node)
    return new PropertySyntaxImpl({ _tag: 'List', component: node, separator }) as PropertySyntax<
      V | (string & {})
    >
  }

/** @internal */
export const listOf: <V>(component: PropertySyntax<V>) => PropertySyntax<V | (string & {})> =
  listWith('space')

/** @internal */
export const commaListOf: <V>(component: PropertySyntax<V>) => PropertySyntax<V | (string & {})> =
  listWith('comma')

/** @internal */
export const render = (syntax: PropertySyntax): string => renderNode(nodeOf(syntax))

/** @internal */
export const equals = dual<
  (that: PropertySyntax) => (self: PropertySyntax) => boolean,
  (self: PropertySyntax, that: PropertySyntax) => boolean
>(2, (self: PropertySyntax, that: PropertySyntax): boolean => Equal.equals(self, that))
