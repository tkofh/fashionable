import * as Equal from '#internal/equal'
import {
  DEFAULT_FORMAT,
  type FormatSpec,
  formatWith,
  specEquals,
  specFidelity,
} from '#internal/format'
import { EMPTY_REFS } from '#internal/refs'
import { dual, invariant, Pipeable } from '#util'
import type { ApplyBindings, Bindings, Calc, Input, SerializeOptions } from './calc.ts'
import { toSpec } from './precision.internal.ts'
import type { Precision } from './precision.ts'

export const CalcTypeId = Symbol.for('fashionable/calc')
export type CalcTypeId = typeof CalcTypeId

// ---------------------------------------------------------------------------
// node ADT
// ---------------------------------------------------------------------------

/** @internal */
export interface ConstantNode {
  readonly _tag: 'Constant'
  readonly value: number
  readonly precision: FormatSpec | undefined
}

/** @internal */
export interface RefNode {
  readonly _tag: 'Ref'
  readonly name: string
}

/** @internal */
export type CalcNode =
  | ConstantNode
  | RefNode
  | { readonly _tag: 'Add'; readonly terms: ReadonlyArray<CalcNode> }
  | { readonly _tag: 'Subtract'; readonly left: CalcNode; readonly right: CalcNode }
  | { readonly _tag: 'Multiply'; readonly left: CalcNode; readonly right: CalcNode }
  | { readonly _tag: 'Divide'; readonly left: CalcNode; readonly right: CalcNode }
  | { readonly _tag: 'Pow'; readonly base: CalcNode; readonly exponent: CalcNode }
  | { readonly _tag: 'SignedPow'; readonly base: CalcNode; readonly exponent: CalcNode }
  | { readonly _tag: 'Min'; readonly args: ReadonlyArray<CalcNode> }
  | { readonly _tag: 'Max'; readonly args: ReadonlyArray<CalcNode> }
  | {
      readonly _tag: 'Clamp'
      readonly minimum: CalcNode
      readonly value: CalcNode
      readonly maximum: CalcNode
    }
  | { readonly _tag: 'Abs'; readonly argument: CalcNode }
  | { readonly _tag: 'Sign'; readonly argument: CalcNode }
  | { readonly _tag: 'Sin'; readonly argument: CalcNode }
  | { readonly _tag: 'Cos'; readonly argument: CalcNode }
  | { readonly _tag: 'Acos'; readonly argument: CalcNode }

const isConstant = (node: CalcNode): node is ConstantNode => node._tag === 'Constant'

// ---------------------------------------------------------------------------
// smart node constructors: eager constant folding + precision propagation
// ---------------------------------------------------------------------------

const constantNode = (value: number, precision: FormatSpec | undefined): ConstantNode => {
  invariant(Number.isFinite(value), `Constant value must be a finite number, got ${value}`)
  return { _tag: 'Constant', value, precision }
}

const bestPrecision = (nodes: ReadonlyArray<ConstantNode>): FormatSpec | undefined => {
  let best: FormatSpec | undefined
  for (const node of nodes) {
    if (specFidelity(node.precision) > specFidelity(best)) {
      best = node.precision
    }
  }
  return best
}

const addNode = (terms: ReadonlyArray<CalcNode>): CalcNode => {
  if (terms.every(isConstant)) {
    return constantNode(
      terms.reduce((total, term) => total + term.value, 0),
      bestPrecision(terms),
    )
  }
  return { _tag: 'Add', terms }
}

const binaryNode =
  (tag: 'Subtract' | 'Multiply' | 'Divide', compute: (a: number, b: number) => number) =>
  (left: CalcNode, right: CalcNode): CalcNode => {
    if (isConstant(left) && isConstant(right)) {
      return constantNode(compute(left.value, right.value), bestPrecision([left, right]))
    }
    return { _tag: tag, left, right }
  }

const subtractNode = binaryNode('Subtract', (a, b) => a - b)
const multiplyNode = binaryNode('Multiply', (a, b) => a * b)
const divideNode = binaryNode('Divide', (a, b) => a / b)

const powNode = (base: CalcNode, exponent: CalcNode): CalcNode => {
  if (isConstant(base) && isConstant(exponent)) {
    return constantNode(base.value ** exponent.value, bestPrecision([base, exponent]))
  }
  return { _tag: 'Pow', base, exponent }
}

const signedPowNode = (base: CalcNode, exponent: CalcNode): CalcNode => {
  if (isConstant(base) && isConstant(exponent)) {
    return constantNode(
      Math.abs(base.value) ** exponent.value * Math.sign(base.value),
      bestPrecision([base, exponent]),
    )
  }
  return { _tag: 'SignedPow', base, exponent }
}

const naryNode =
  (tag: 'Min' | 'Max', compute: (values: ReadonlyArray<number>) => number) =>
  (args: ReadonlyArray<CalcNode>): CalcNode => {
    if (args.every(isConstant)) {
      return constantNode(compute(args.map((arg) => arg.value)), bestPrecision(args))
    }
    return { _tag: tag, args }
  }

const minNode = naryNode('Min', (values) => Math.min(...values))
const maxNode = naryNode('Max', (values) => Math.max(...values))

const clampNode = (minimum: CalcNode, value: CalcNode, maximum: CalcNode): CalcNode => {
  if (isConstant(minimum) && isConstant(value) && isConstant(maximum)) {
    return constantNode(
      Math.max(minimum.value, Math.min(value.value, maximum.value)),
      bestPrecision([minimum, value, maximum]),
    )
  }
  return { _tag: 'Clamp', minimum, value, maximum }
}

const unaryNode =
  (tag: 'Abs' | 'Sign' | 'Sin' | 'Cos' | 'Acos', compute: (x: number) => number) =>
  (argument: CalcNode): CalcNode => {
    if (isConstant(argument)) {
      return constantNode(compute(argument.value), argument.precision)
    }
    return { _tag: tag, argument }
  }

const absNode = unaryNode('Abs', Math.abs)
const signNode = unaryNode('Sign', Math.sign)
const sinNode = unaryNode('Sin', Math.sin)
const cosNode = unaryNode('Cos', Math.cos)
const acosNode = unaryNode('Acos', Math.acos)

// ---------------------------------------------------------------------------
// walkers
// ---------------------------------------------------------------------------

/** @internal */
export const substituteNode = (node: CalcNode, bindings: Record<string, CalcNode>): CalcNode => {
  switch (node._tag) {
    case 'Constant':
      return node
    case 'Ref':
      return bindings[node.name] ?? node
    case 'Add':
      return addNode(node.terms.map((term) => substituteNode(term, bindings)))
    case 'Subtract':
      return subtractNode(substituteNode(node.left, bindings), substituteNode(node.right, bindings))
    case 'Multiply':
      return multiplyNode(substituteNode(node.left, bindings), substituteNode(node.right, bindings))
    case 'Divide':
      return divideNode(substituteNode(node.left, bindings), substituteNode(node.right, bindings))
    case 'Pow':
      return powNode(substituteNode(node.base, bindings), substituteNode(node.exponent, bindings))
    case 'SignedPow':
      return signedPowNode(
        substituteNode(node.base, bindings),
        substituteNode(node.exponent, bindings),
      )
    case 'Min':
      return minNode(node.args.map((arg) => substituteNode(arg, bindings)))
    case 'Max':
      return maxNode(node.args.map((arg) => substituteNode(arg, bindings)))
    case 'Clamp':
      return clampNode(
        substituteNode(node.minimum, bindings),
        substituteNode(node.value, bindings),
        substituteNode(node.maximum, bindings),
      )
    case 'Abs':
      return absNode(substituteNode(node.argument, bindings))
    case 'Sign':
      return signNode(substituteNode(node.argument, bindings))
    case 'Sin':
      return sinNode(substituteNode(node.argument, bindings))
    case 'Cos':
      return cosNode(substituteNode(node.argument, bindings))
    case 'Acos':
      return acosNode(substituteNode(node.argument, bindings))
  }
}

/** @internal */
export const evaluateNode = (node: CalcNode): number => {
  switch (node._tag) {
    case 'Constant':
      return node.value
    case 'Ref':
      throw new Error(`Cannot evaluate non-constant reference: ${node.name}`)
    case 'Add':
      return node.terms.reduce((total, term) => total + evaluateNode(term), 0)
    case 'Subtract':
      return evaluateNode(node.left) - evaluateNode(node.right)
    case 'Multiply':
      return evaluateNode(node.left) * evaluateNode(node.right)
    case 'Divide':
      return evaluateNode(node.left) / evaluateNode(node.right)
    case 'Pow':
      return evaluateNode(node.base) ** evaluateNode(node.exponent)
    case 'SignedPow': {
      const base = evaluateNode(node.base)
      return Math.abs(base) ** evaluateNode(node.exponent) * Math.sign(base)
    }
    case 'Min':
      return Math.min(...node.args.map(evaluateNode))
    case 'Max':
      return Math.max(...node.args.map(evaluateNode))
    case 'Clamp':
      return Math.max(
        evaluateNode(node.minimum),
        Math.min(evaluateNode(node.value), evaluateNode(node.maximum)),
      )
    case 'Abs':
      return Math.abs(evaluateNode(node.argument))
    case 'Sign':
      return Math.sign(evaluateNode(node.argument))
    case 'Sin':
      return Math.sin(evaluateNode(node.argument))
    case 'Cos':
      return Math.cos(evaluateNode(node.argument))
    case 'Acos':
      return Math.acos(evaluateNode(node.argument))
  }
}

/**
 * True for the arithmetic forms that need a `calc()` wrapper when they
 * stand alone; function forms and leaves never do.
 *
 * @internal
 */
export const needsCalcWrap = (node: CalcNode): boolean =>
  node._tag === 'Add' ||
  node._tag === 'Subtract' ||
  node._tag === 'Multiply' ||
  node._tag === 'Divide' ||
  node._tag === 'SignedPow'

/**
 * True when a subtree is angle-typed in CSS terms: `acos()` returns an
 * angle, and angles survive addition, subtraction, scaling, and selection.
 * Solve-side everything is a plain number in radians; this only steers
 * serialization (see `serializeNode`).
 *
 * @internal
 */
export const producesAngle = (node: CalcNode): boolean => {
  switch (node._tag) {
    case 'Acos':
      return true
    case 'Add':
      return node.terms.some(producesAngle)
    case 'Subtract':
    case 'Multiply':
      return producesAngle(node.left) || producesAngle(node.right)
    case 'Divide':
      return producesAngle(node.left)
    case 'Min':
    case 'Max':
      return node.args.some(producesAngle)
    case 'Clamp':
      return producesAngle(node.value)
    case 'Abs':
      return producesAngle(node.argument)
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// serialization
// ---------------------------------------------------------------------------

interface SerializeContext {
  readonly precision: FormatSpec
}

const PI_TOLERANCE = 1e-10

const formatConstant = (
  node: ConstantNode,
  insideMath: boolean,
  asAngle: boolean,
  context: SerializeContext,
): string => {
  if (insideMath && !asAngle && Math.abs(node.value - Math.PI) < PI_TOLERANCE) {
    return 'pi'
  }
  const text = formatWith(node.value, node.precision ?? context.precision)
  return asAngle ? `${text}rad` : text
}

const wrapOperand = (node: CalcNode, serialized: string): string =>
  node._tag === 'Add' || node._tag === 'Subtract' ? `(${serialized})` : serialized

const hasNegativeCoefficient = (node: CalcNode): boolean => {
  if (isConstant(node)) {
    return node.value < 0
  }
  if (node._tag === 'Multiply' || node._tag === 'Divide') {
    return isConstant(node.left) && node.left.value < 0
  }
  return false
}

/**
 * Serializes a term of an angle-typed sum. A plain-number term must be
 * converted for the sum to stay angle-typed in CSS: numeric constants take
 * a `rad` suffix; anything else multiplies by `1rad` (multiplication with
 * one unitful operand is universally valid, unlike typed division).
 */
const serializeTerm = (
  node: CalcNode,
  insideMath: boolean,
  asAngle: boolean,
  context: SerializeContext,
): string => {
  if (!asAngle) {
    return serializeNode(node, insideMath, context)
  }
  if (isConstant(node)) {
    return formatConstant(node, insideMath, true, context)
  }
  return `${wrapOperand(node, serializeNode(node, insideMath, context))} * 1rad`
}

/**
 * Serializes the negation of a term whose leading coefficient is a
 * negative constant, so `a + (-k * x)` renders as `a - k * x`.
 */
const serializeNegated = (
  node: CalcNode,
  insideMath: boolean,
  asAngle: boolean,
  context: SerializeContext,
): string => {
  if (isConstant(node)) {
    return formatConstant(constantNode(-node.value, node.precision), insideMath, asAngle, context)
  }
  const binary = node as Extract<CalcNode, { _tag: 'Multiply' | 'Divide' }>
  const negated: CalcNode = {
    _tag: binary._tag,
    left: constantNode(
      -(binary.left as ConstantNode).value,
      (binary.left as ConstantNode).precision,
    ),
    right: binary.right,
  }
  const serialized = serializeNode(negated, insideMath, context)
  return asAngle ? `${serialized} * 1rad` : serialized
}

/** @internal */
export const serializeNode = (
  node: CalcNode,
  insideMath: boolean,
  context: SerializeContext,
): string => {
  switch (node._tag) {
    case 'Constant':
      return formatConstant(node, insideMath, false, context)
    case 'Ref':
      return `var(--${node.name})`
    case 'Add': {
      const angleSum = producesAngle(node)
      let out = ''
      for (const [index, term] of node.terms.entries()) {
        const asAngle = angleSum && !producesAngle(term)
        if (index === 0) {
          out = serializeTerm(term, insideMath, asAngle, context)
        } else if (hasNegativeCoefficient(term)) {
          out += ` - ${serializeNegated(term, insideMath, asAngle, context)}`
        } else {
          out += ` + ${serializeTerm(term, insideMath, asAngle, context)}`
        }
      }
      return out
    }
    case 'Subtract': {
      const angleSum = producesAngle(node)
      const left = serializeTerm(
        node.left,
        insideMath,
        angleSum && !producesAngle(node.left),
        context,
      )
      const rightAsAngle = angleSum && !producesAngle(node.right)
      if (hasNegativeCoefficient(node.right)) {
        return `${left} + ${serializeNegated(node.right, insideMath, rightAsAngle, context)}`
      }
      return `${left} - ${serializeTerm(node.right, insideMath, rightAsAngle, context)}`
    }
    case 'Multiply': {
      const left = wrapOperand(node.left, serializeNode(node.left, insideMath, context))
      const right = wrapOperand(node.right, serializeNode(node.right, insideMath, context))
      return `${left} * ${right}`
    }
    case 'Divide': {
      const left = wrapOperand(node.left, serializeNode(node.left, insideMath, context))
      const right = wrapOperand(node.right, serializeNode(node.right, insideMath, context))
      return `${left} / ${right}`
    }
    case 'Pow':
      return `pow(${serializeNode(node.base, true, context)}, ${serializeNode(node.exponent, true, context)})`
    case 'SignedPow': {
      const base = serializeNode(node.base, true, context)
      const exponent = serializeNode(node.exponent, true, context)
      return `pow(abs(${base}), ${exponent}) * sign(${base})`
    }
    case 'Min':
      return `min(${node.args.map((arg) => serializeNode(arg, true, context)).join(', ')})`
    case 'Max':
      return `max(${node.args.map((arg) => serializeNode(arg, true, context)).join(', ')})`
    case 'Clamp':
      return `clamp(${serializeNode(node.minimum, true, context)}, ${serializeNode(node.value, true, context)}, ${serializeNode(node.maximum, true, context)})`
    case 'Abs':
      return `abs(${serializeNode(node.argument, true, context)})`
    case 'Sign':
      return `sign(${serializeNode(node.argument, true, context)})`
    case 'Sin':
      return `sin(${serializeNode(node.argument, true, context)})`
    case 'Cos':
      return `cos(${serializeNode(node.argument, true, context)})`
    case 'Acos':
      return `acos(${serializeNode(node.argument, true, context)})`
  }
}

/** @internal */
export const serializeTop = (node: CalcNode, precision: FormatSpec): string => {
  const wrap = needsCalcWrap(node)
  const body = serializeNode(node, wrap, { precision })
  return wrap ? `calc(${body})` : body
}

// ---------------------------------------------------------------------------
// structural equality
// ---------------------------------------------------------------------------

const nodeArrayEquals = (a: ReadonlyArray<CalcNode>, b: ReadonlyArray<CalcNode>): boolean =>
  a.length === b.length && a.every((node, index) => nodeEquals(node, b[index] as CalcNode))

/** @internal */
export const nodeEquals = (a: CalcNode, b: CalcNode): boolean => {
  if (a === b) {
    return true
  }
  if (a._tag !== b._tag) {
    return false
  }
  switch (a._tag) {
    case 'Constant': {
      const other = b as ConstantNode
      return a.value === other.value && specEquals(a.precision, other.precision)
    }
    case 'Ref':
      return a.name === (b as RefNode).name
    case 'Add':
      return nodeArrayEquals(a.terms, (b as typeof a).terms)
    case 'Subtract':
    case 'Multiply':
    case 'Divide': {
      const other = b as typeof a
      return nodeEquals(a.left, other.left) && nodeEquals(a.right, other.right)
    }
    case 'Pow':
    case 'SignedPow': {
      const other = b as typeof a
      return nodeEquals(a.base, other.base) && nodeEquals(a.exponent, other.exponent)
    }
    case 'Min':
    case 'Max':
      return nodeArrayEquals(a.args, (b as typeof a).args)
    case 'Clamp': {
      const other = b as typeof a
      return (
        nodeEquals(a.minimum, other.minimum) &&
        nodeEquals(a.value, other.value) &&
        nodeEquals(a.maximum, other.maximum)
      )
    }
    case 'Abs':
    case 'Sign':
    case 'Sin':
    case 'Cos':
    case 'Acos':
      return nodeEquals(a.argument, (b as typeof a).argument)
  }
}

const hashNodeArray = (tag: string, nodes: ReadonlyArray<CalcNode>): number => {
  let h = Equal.hashString(tag)
  for (const node of nodes) {
    h = Equal.combine(h, nodeHash(node))
  }
  return h
}

/** @internal */
export const nodeHash = (node: CalcNode): number => {
  switch (node._tag) {
    case 'Constant': {
      const precision =
        node.precision === undefined
          ? 0
          : Equal.combine(Equal.hashString(node.precision.mode), node.precision.digits | 0)
      return Equal.combine(
        Equal.hashString('Constant'),
        Equal.combine(Equal.hashNumber(node.value), precision),
      )
    }
    case 'Ref':
      return Equal.combine(Equal.hashString('Ref'), Equal.hashString(node.name))
    case 'Add':
      return hashNodeArray('Add', node.terms)
    case 'Subtract':
    case 'Multiply':
    case 'Divide':
      return hashNodeArray(node._tag, [node.left, node.right])
    case 'Pow':
    case 'SignedPow':
      return hashNodeArray(node._tag, [node.base, node.exponent])
    case 'Min':
    case 'Max':
      return hashNodeArray(node._tag, node.args)
    case 'Clamp':
      return hashNodeArray('Clamp', [node.minimum, node.value, node.maximum])
    case 'Abs':
    case 'Sign':
    case 'Sin':
    case 'Cos':
    case 'Acos':
      return hashNodeArray(node._tag, [node.argument])
  }
}

// ---------------------------------------------------------------------------
// the public value
// ---------------------------------------------------------------------------

class CalcImpl extends Pipeable implements Calc<string>, Equal.Equal {
  readonly [CalcTypeId]: CalcTypeId = CalcTypeId

  readonly node: CalcNode
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(node: CalcNode, refSet: ReadonlySet<string>) {
    super()
    this.node = node
    this.refSet = refSet
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return isCalc(that) && nodeEquals(this.node, nodeOf(that))
  }

  [Equal.HashTypeId](): number {
    this.#hash ??= Equal.combine(Equal.hashString('fashionable/calc'), nodeHash(this.node))
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `Calc(${serializeTop(this.node, DEFAULT_FORMAT)})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isCalc = (u: unknown): u is Calc<string> =>
  typeof u === 'object' && u !== null && CalcTypeId in u

/** @internal */
export const nodeOf = (expr: Calc<string>): CalcNode => (expr as CalcImpl).node

/** @internal */
export const refsOf = <R extends string>(expr: Calc<R>): ReadonlySet<R> =>
  (expr as unknown as CalcImpl).refSet as ReadonlySet<R>

const makeCalc = (node: CalcNode, refSet: ReadonlySet<string>): Calc<string> =>
  new CalcImpl(node, refSet)

/** @internal */
export const toCalc = (input: Input<string>): Calc<string> =>
  typeof input === 'number' ? of(input) : input

const mergeRefs = (exprs: ReadonlyArray<Calc<string>>): ReadonlySet<string> => {
  const merged = new Set<string>()
  for (const expr of exprs) {
    for (const name of refsOf(expr)) {
      merged.add(name)
    }
  }
  return merged
}

// ---------------------------------------------------------------------------
// constructors
// ---------------------------------------------------------------------------

/** @internal */
export function of(value: number, precision?: Precision): Calc<never> {
  return makeCalc(
    constantNode(value, precision === undefined ? undefined : toSpec(precision)),
    EMPTY_REFS,
  ) as Calc<never>
}

const refCache = new Map<string, Calc<string>>()

/** @internal */
export function ref<Name extends string>(name: Name): Calc<Name> {
  const cached = refCache.get(name)
  if (cached) {
    return cached as Calc<Name>
  }
  invariant(name.length > 0, 'Reference name must be a non-empty string')
  const expr = makeCalc({ _tag: 'Ref', name }, new Set([name]))
  refCache.set(name, expr)
  return expr as Calc<Name>
}

// ---------------------------------------------------------------------------
// combinators
// ---------------------------------------------------------------------------

const liftNary =
  (construct: (nodes: ReadonlyArray<CalcNode>) => CalcNode) =>
  (args: ReadonlyArray<Input<string>>): Calc<string> => {
    const exprs = args.map(toCalc)
    return makeCalc(construct(exprs.map(nodeOf)), mergeRefs(exprs))
  }

const addImpl = liftNary(addNode)
const minImpl = liftNary(minNode)
const maxImpl = liftNary(maxNode)

/** @internal */
export function add<A extends string = never, B extends string = never>(
  a: Input<A>,
  b: Input<B>,
): Calc<A | B>
/** @internal */
export function add<A extends string = never, B extends string = never, C extends string = never>(
  a: Input<A>,
  b: Input<B>,
  c: Input<C>,
): Calc<A | B | C>
/** @internal */
export function add<
  A extends string = never,
  B extends string = never,
  C extends string = never,
  D extends string = never,
>(a: Input<A>, b: Input<B>, c: Input<C>, d: Input<D>): Calc<A | B | C | D>
/** @internal */
export function add(
  ...args: readonly [Input<string>, Input<string>, ...ReadonlyArray<Input<string>>]
): Calc<string>
/** @internal */
export function add(...args: ReadonlyArray<Input<string>>): Calc<string> {
  return addImpl(args)
}

/** @internal */
export function min<A extends string = never, B extends string = never>(
  a: Input<A>,
  b: Input<B>,
): Calc<A | B>
/** @internal */
export function min<A extends string = never, B extends string = never, C extends string = never>(
  a: Input<A>,
  b: Input<B>,
  c: Input<C>,
): Calc<A | B | C>
/** @internal */
export function min<
  A extends string = never,
  B extends string = never,
  C extends string = never,
  D extends string = never,
>(a: Input<A>, b: Input<B>, c: Input<C>, d: Input<D>): Calc<A | B | C | D>
/** @internal */
export function min(
  ...args: readonly [Input<string>, Input<string>, ...ReadonlyArray<Input<string>>]
): Calc<string>
/** @internal */
export function min(...args: ReadonlyArray<Input<string>>): Calc<string> {
  return minImpl(args)
}

/** @internal */
export function max<A extends string = never, B extends string = never>(
  a: Input<A>,
  b: Input<B>,
): Calc<A | B>
/** @internal */
export function max<A extends string = never, B extends string = never, C extends string = never>(
  a: Input<A>,
  b: Input<B>,
  c: Input<C>,
): Calc<A | B | C>
/** @internal */
export function max<
  A extends string = never,
  B extends string = never,
  C extends string = never,
  D extends string = never,
>(a: Input<A>, b: Input<B>, c: Input<C>, d: Input<D>): Calc<A | B | C | D>
/** @internal */
export function max(
  ...args: readonly [Input<string>, Input<string>, ...ReadonlyArray<Input<string>>]
): Calc<string>
/** @internal */
export function max(...args: ReadonlyArray<Input<string>>): Calc<string> {
  return maxImpl(args)
}

const liftBinary =
  (construct: (left: CalcNode, right: CalcNode) => CalcNode) =>
  (left: Input<string>, right: Input<string>): Calc<string> => {
    const l = toCalc(left)
    const r = toCalc(right)
    return makeCalc(construct(nodeOf(l), nodeOf(r)), mergeRefs([l, r]))
  }

const subtractImpl = liftBinary(subtractNode)
const multiplyImpl = liftBinary(multiplyNode)
const divideImpl = liftBinary(divideNode)
const powImpl = liftBinary(powNode)
const signedPowImpl = liftBinary(signedPowNode)

/** @internal */
export function subtract<A extends string = never, B extends string = never>(
  left: Input<A>,
  right: Input<B>,
): Calc<A | B> {
  return subtractImpl(left, right) as Calc<A | B>
}

/** @internal */
export function multiply<A extends string = never, B extends string = never>(
  left: Input<A>,
  right: Input<B>,
): Calc<A | B> {
  return multiplyImpl(left, right) as Calc<A | B>
}

/** @internal */
export function divide<A extends string = never, B extends string = never>(
  left: Input<A>,
  right: Input<B>,
): Calc<A | B> {
  return divideImpl(left, right) as Calc<A | B>
}

/** @internal */
export function pow<A extends string = never, B extends string = never>(
  base: Input<A>,
  exponent: Input<B>,
): Calc<A | B> {
  return powImpl(base, exponent) as Calc<A | B>
}

/** @internal */
export function signedPow<A extends string = never, B extends string = never>(
  base: Input<A>,
  exponent: Input<B>,
): Calc<A | B> {
  return signedPowImpl(base, exponent) as Calc<A | B>
}

const liftUnary =
  (construct: (argument: CalcNode) => CalcNode) =>
  (argument: Input<string>): Calc<string> => {
    const arg = toCalc(argument)
    return makeCalc(construct(nodeOf(arg)), refsOf(arg))
  }

const absImpl = liftUnary(absNode)
const signImpl = liftUnary(signNode)
const sinImpl = liftUnary(sinNode)
const cosImpl = liftUnary(cosNode)
const acosImpl = liftUnary(acosNode)

/** @internal */
export function abs<A extends string = never>(argument: Input<A>): Calc<A> {
  return absImpl(argument) as Calc<A>
}

/** @internal */
export function sign<A extends string = never>(argument: Input<A>): Calc<A> {
  return signImpl(argument) as Calc<A>
}

/** @internal */
export function sin<A extends string = never>(argument: Input<A>): Calc<A> {
  return sinImpl(argument) as Calc<A>
}

/** @internal */
export function cos<A extends string = never>(argument: Input<A>): Calc<A> {
  return cosImpl(argument) as Calc<A>
}

/** @internal */
export function acos<A extends string = never>(argument: Input<A>): Calc<A> {
  return acosImpl(argument) as Calc<A>
}

/** @internal */
export function clamp<A extends string = never, B extends string = never, C extends string = never>(
  minimum: Input<A>,
  value: Input<B>,
  maximum: Input<C>,
): Calc<A | B | C> {
  const lo = toCalc(minimum)
  const mid = toCalc(value)
  const hi = toCalc(maximum)
  return makeCalc(clampNode(nodeOf(lo), nodeOf(mid), nodeOf(hi)), mergeRefs([lo, mid, hi])) as Calc<
    A | B | C
  >
}

/** @internal */
export function lerp<A extends string = never, B extends string = never, T extends string = never>(
  a: Input<A>,
  b: Input<B>,
  t: Input<T>,
): Calc<A | B | T> {
  return add(multiply(subtract(1, t), a), multiply(t, b)) as Calc<A | B | T>
}

// ---------------------------------------------------------------------------
// binding and projections
// ---------------------------------------------------------------------------

/** @internal */
export const collectBindings = (
  refSet: ReadonlySet<string>,
  bindings: Record<string, Input<string> | undefined>,
): { readonly nodeBindings: Record<string, CalcNode>; readonly refSet: Set<string> } => {
  const nodeBindings: Record<string, CalcNode> = {}
  const newRefs = new Set<string>(refSet)
  for (const [key, value] of Object.entries(bindings)) {
    if (value === undefined || !refSet.has(key)) {
      continue
    }
    const expr = toCalc(value)
    nodeBindings[key] = nodeOf(expr)
    newRefs.delete(key)
    for (const name of refsOf(expr)) {
      newRefs.add(name)
    }
  }
  return { nodeBindings, refSet: newRefs }
}

/** @internal */
export const bind: {
  <const B extends Bindings>(
    bindings: B,
  ): <Refs extends string>(expr: Calc<Refs>) => Calc<ApplyBindings<Refs, B>>
  <Refs extends string, const B extends Bindings>(
    expr: Calc<Refs>,
    bindings: B,
  ): Calc<ApplyBindings<Refs, B>>
} = dual(2, (expr: Calc<string>, bindings: Record<string, Input<string>>): Calc<string> => {
  const collected = collectBindings(refsOf(expr), bindings)
  return makeCalc(substituteNode(nodeOf(expr), collected.nodeBindings), collected.refSet)
})

/** @internal */
export function solve(expr: Calc<never>): number
/** @internal */
export function solve<Refs extends string, B extends Bindings<Refs>>(
  expr: Calc<Refs>,
  bindings: B,
): number
/** @internal */
export function solve(expr: Calc<string>, bindings?: Record<string, Input<string>>): number {
  let node = nodeOf(expr)
  let remaining: ReadonlySet<string> = refsOf(expr)
  if (bindings !== undefined) {
    const collected = collectBindings(remaining, bindings)
    node = substituteNode(node, collected.nodeBindings)
    remaining = collected.refSet
  }
  invariant(remaining.size === 0, 'Cannot convert expression to number: unbound references remain')
  return evaluateNode(node)
}

/** @internal */
export function serialize<Refs extends string>(
  expr: Calc<Refs>,
  options?: SerializeOptions<Refs>,
): string {
  let node = nodeOf(expr)
  if (options?.bindings !== undefined) {
    const collected = collectBindings(
      refsOf(expr),
      options.bindings as Record<string, Input<string> | undefined>,
    )
    node = substituteNode(node, collected.nodeBindings)
  }
  const precision = options?.precision === undefined ? DEFAULT_FORMAT : toSpec(options.precision)
  return serializeTop(node, precision)
}

/** @internal */
export function refs<Refs extends string>(expr: Calc<Refs>): ReadonlySet<Refs> {
  return refsOf(expr)
}

/** @internal */
export const equals = dual<
  (that: Calc<string>) => (self: Calc<string>) => boolean,
  (self: Calc<string>, that: Calc<string>) => boolean
>(2, (self: Calc<string>, that: Calc<string>): boolean => Equal.equals(self, that))
