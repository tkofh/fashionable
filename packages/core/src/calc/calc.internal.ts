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
import type { ApplyBindings, Bindings, Calc, Input, Kind, SerializeOptions } from './calc.ts'
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
  /** The CSS unit token (`'px'`, `'rad'`), or `undefined` for a plain number. */
  readonly unit: string | undefined
  /** The CSS dimension, supplied by the constructing data module. */
  readonly kind: Kind
}

/** @internal */
export interface RefNode {
  readonly _tag: 'Ref'
  readonly name: string
}

/**
 * A bare CSS identifier leaf — an unquoted token the browser resolves from
 * its surrounding context, not the custom-property channel. Serializes as its
 * name (`l`, not `var(--l)`), contributes no references, and cannot be solved,
 * since no `bind` value reaches it. Today the relative-color channel keywords
 * (`Channel.L`, `Channel.C`, ...) are its only source.
 *
 * @internal
 */
export interface IdentNode {
  readonly _tag: 'Ident'
  readonly name: string
}

/** @internal */
export type CalcNode =
  | ConstantNode
  | RefNode
  | IdentNode
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
  | { readonly _tag: 'Tan'; readonly argument: CalcNode }
  | { readonly _tag: 'Acos'; readonly argument: CalcNode }
  | { readonly _tag: 'Atan2'; readonly y: CalcNode; readonly x: CalcNode }

const isConstant = (node: CalcNode): node is ConstantNode => node._tag === 'Constant'

// ---------------------------------------------------------------------------
// smart node constructors: eager constant folding + precision propagation
// ---------------------------------------------------------------------------

const constantNode = (
  value: number,
  precision: FormatSpec | undefined,
  unit: string | undefined = undefined,
  kind: Kind = 'number',
): ConstantNode => {
  invariant(Number.isFinite(value), `Constant value must be a finite number, got ${value}`)
  return { _tag: 'Constant', value, precision, unit, kind }
}

/**
 * The shared (unit, kind) of a run of constants, or `undefined` when they mix
 * units and so cannot fold to a single constant (`10px + 5vw` stays symbolic).
 */
const commonDimension = (
  nodes: ReadonlyArray<ConstantNode>,
): { readonly unit: string | undefined; readonly kind: Kind } | undefined => {
  const first = nodes[0]
  if (first === undefined) {
    return { unit: undefined, kind: 'number' }
  }
  for (const node of nodes) {
    if (node.unit !== first.unit) {
      return undefined
    }
  }
  return { unit: first.unit, kind: first.kind }
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
    const dim = commonDimension(terms)
    if (dim !== undefined) {
      return constantNode(
        terms.reduce((total, term) => total + term.value, 0),
        bestPrecision(terms),
        dim.unit,
        dim.kind,
      )
    }
  }
  return { _tag: 'Add', terms }
}

const subtractNode = (left: CalcNode, right: CalcNode): CalcNode => {
  if (isConstant(left) && isConstant(right) && left.unit === right.unit) {
    return constantNode(
      left.value - right.value,
      bestPrecision([left, right]),
      left.unit,
      left.kind,
    )
  }
  return { _tag: 'Subtract', left, right }
}

const multiplyNode = (left: CalcNode, right: CalcNode): CalcNode => {
  if (isConstant(left) && isConstant(right)) {
    // A dimensioned factor rides through a number factor; two dimensioned
    // factors are invalid CSS (rejected at the type level) and stay symbolic.
    if (left.unit === undefined) {
      return constantNode(
        left.value * right.value,
        bestPrecision([left, right]),
        right.unit,
        right.kind,
      )
    }
    if (right.unit === undefined) {
      return constantNode(
        left.value * right.value,
        bestPrecision([left, right]),
        left.unit,
        left.kind,
      )
    }
  }
  return { _tag: 'Multiply', left, right }
}

const divideNode = (left: CalcNode, right: CalcNode): CalcNode => {
  if (isConstant(left) && isConstant(right)) {
    if (left.unit === right.unit) {
      // same unit (or both unit-free) -> the ratio is a unit-free number
      return constantNode(left.value / right.value, bestPrecision([left, right]))
    }
    if (right.unit === undefined) {
      return constantNode(
        left.value / right.value,
        bestPrecision([left, right]),
        left.unit,
        left.kind,
      )
    }
    // number / dimensioned, or two differing dimensioned units: no context-free
    // value, so stay symbolic (the browser resolves the units)
  }
  return { _tag: 'Divide', left, right }
}

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
      const dim = commonDimension(args)
      if (dim !== undefined) {
        return constantNode(
          compute(args.map((arg) => arg.value)),
          bestPrecision(args),
          dim.unit,
          dim.kind,
        )
      }
    }
    return { _tag: tag, args }
  }

const minNode = naryNode('Min', (values) => Math.min(...values))
const maxNode = naryNode('Max', (values) => Math.max(...values))

const clampNode = (minimum: CalcNode, value: CalcNode, maximum: CalcNode): CalcNode => {
  if (isConstant(minimum) && isConstant(value) && isConstant(maximum)) {
    const dim = commonDimension([minimum, value, maximum])
    if (dim !== undefined) {
      return constantNode(
        Math.max(minimum.value, Math.min(value.value, maximum.value)),
        bestPrecision([minimum, value, maximum]),
        dim.unit,
        dim.kind,
      )
    }
  }
  return { _tag: 'Clamp', minimum, value, maximum }
}

type UnaryTag = 'Abs' | 'Sign' | 'Sin' | 'Cos' | 'Tan' | 'Acos'

/**
 * Per-function data for the unary math nodes — the single source of truth the
 * fold constructor, the evaluator, and the serializer all read:
 *
 * - `fn` both folds a constant operand and lowers the node under `solve`, so the
 *   construction-time and solve-time numerics can never drift.
 * - `css` is the math-function name serialization emits.
 * - `result` is the folded constant's dimension: `sign`/`sin`/`cos`/`tan`
 *   produce a plain `number`; `abs` preserves the operand's; `acos` returns
 *   radians, so its constant composes with `Angle.rad` terms and stays valid CSS
 *   with no plain-number-beside-angle hack.
 */
const UNARY: Record<
  UnaryTag,
  {
    readonly fn: (x: number) => number
    readonly css: string
    readonly result: 'number' | 'preserve' | 'rad'
  }
> = {
  Abs: { fn: Math.abs, css: 'abs', result: 'preserve' },
  Sign: { fn: Math.sign, css: 'sign', result: 'number' },
  Sin: { fn: Math.sin, css: 'sin', result: 'number' },
  Cos: { fn: Math.cos, css: 'cos', result: 'number' },
  Tan: { fn: Math.tan, css: 'tan', result: 'number' },
  Acos: { fn: Math.acos, css: 'acos', result: 'rad' },
}

const foldUnary = (tag: UnaryTag, argument: CalcNode): CalcNode => {
  if (isConstant(argument)) {
    const { fn, result } = UNARY[tag]
    const value = fn(argument.value)
    if (result === 'preserve') {
      return constantNode(value, argument.precision, argument.unit, argument.kind)
    }
    if (result === 'rad') {
      return constantNode(value, argument.precision, 'rad', 'angle')
    }
    return constantNode(value, argument.precision)
  }
  return { _tag: tag, argument }
}

// atan2(y, x) returns an <angle>. It also divides same-kind dimensions to a
// number via tan(atan2(a, b)): a length ratio that works where `a / b` does not
// (Firefox does not yet support <length> / <length> in calc). Folds only when
// both operands share a unit, so the ratio is unit-free (like divide).
const atan2Node = (y: CalcNode, x: CalcNode): CalcNode => {
  if (isConstant(y) && isConstant(x) && y.unit === x.unit) {
    return constantNode(Math.atan2(y.value, x.value), bestPrecision([y, x]), 'rad', 'angle')
  }
  return { _tag: 'Atan2', y, x }
}

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
    case 'Ident':
      return node
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
    case 'Sign':
    case 'Sin':
    case 'Cos':
    case 'Tan':
    case 'Acos':
      return foldUnary(node._tag, substituteNode(node.argument, bindings))
    case 'Atan2':
      return atan2Node(substituteNode(node.y, bindings), substituteNode(node.x, bindings))
  }
}

/**
 * The units that lower with no caller-supplied ratio: `px` is the pixel base
 * (`1`), and a radian is already the numeric measure of its angle (`1`). Every
 * other unit is context-dependent and must appear in the solve context.
 *
 * @internal
 */
export const DEFAULT_RATIOS: Record<string, number> = { px: 1, rad: 1 }

/** @internal */
export const evaluateNode = (node: CalcNode, context: Record<string, number>): number => {
  switch (node._tag) {
    case 'Constant': {
      if (node.unit === undefined) {
        return node.value
      }
      const ratio = context[node.unit] ?? DEFAULT_RATIOS[node.unit]
      invariant(
        ratio !== undefined,
        `Cannot evaluate ${node.value}${node.unit}: no ratio for '${node.unit}' in the unit context`,
      )
      return node.value * ratio
    }
    case 'Ref':
      throw new Error(`Cannot evaluate non-constant reference: ${node.name}`)
    case 'Ident':
      throw new Error(`Cannot evaluate bare identifier: ${node.name}`)
    case 'Add':
      return node.terms.reduce((total, term) => total + evaluateNode(term, context), 0)
    case 'Subtract':
      return evaluateNode(node.left, context) - evaluateNode(node.right, context)
    case 'Multiply':
      return evaluateNode(node.left, context) * evaluateNode(node.right, context)
    case 'Divide':
      return evaluateNode(node.left, context) / evaluateNode(node.right, context)
    case 'Pow':
      return evaluateNode(node.base, context) ** evaluateNode(node.exponent, context)
    case 'SignedPow': {
      const base = evaluateNode(node.base, context)
      return Math.abs(base) ** evaluateNode(node.exponent, context) * Math.sign(base)
    }
    case 'Min':
      return Math.min(...node.args.map((arg) => evaluateNode(arg, context)))
    case 'Max':
      return Math.max(...node.args.map((arg) => evaluateNode(arg, context)))
    case 'Clamp':
      return Math.max(
        evaluateNode(node.minimum, context),
        Math.min(evaluateNode(node.value, context), evaluateNode(node.maximum, context)),
      )
    case 'Abs':
    case 'Sign':
    case 'Sin':
    case 'Cos':
    case 'Tan':
    case 'Acos':
      return UNARY[node._tag].fn(evaluateNode(node.argument, context))
    case 'Atan2':
      return Math.atan2(evaluateNode(node.y, context), evaluateNode(node.x, context))
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
  context: SerializeContext,
): string => {
  if (node.unit === undefined && insideMath && Math.abs(node.value - Math.PI) < PI_TOLERANCE) {
    return 'pi'
  }
  const text = formatWith(node.value, node.precision ?? context.precision)
  return node.unit !== undefined ? `${text}${node.unit}` : text
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
 * Serializes the negation of a term whose leading coefficient is a
 * negative constant, so `a + (-k * x)` renders as `a - k * x`.
 */
const serializeNegated = (
  node: CalcNode,
  insideMath: boolean,
  context: SerializeContext,
): string => {
  if (isConstant(node)) {
    return formatConstant(
      constantNode(-node.value, node.precision, node.unit, node.kind),
      insideMath,
      context,
    )
  }
  const binary = node as Extract<CalcNode, { _tag: 'Multiply' | 'Divide' }>
  const left = binary.left as ConstantNode
  const negated: CalcNode = {
    _tag: binary._tag,
    left: constantNode(-left.value, left.precision, left.unit, left.kind),
    right: binary.right,
  }
  return serializeNode(negated, insideMath, context)
}

/** @internal */
export const serializeNode = (
  node: CalcNode,
  insideMath: boolean,
  context: SerializeContext,
): string => {
  switch (node._tag) {
    case 'Constant':
      return formatConstant(node, insideMath, context)
    case 'Ref':
      return `var(--${node.name})`
    case 'Ident':
      return node.name
    case 'Add': {
      let out = ''
      for (const [index, term] of node.terms.entries()) {
        if (index === 0) {
          out = serializeNode(term, insideMath, context)
        } else if (hasNegativeCoefficient(term)) {
          out += ` - ${serializeNegated(term, insideMath, context)}`
        } else {
          out += ` + ${serializeNode(term, insideMath, context)}`
        }
      }
      return out
    }
    case 'Subtract': {
      const left = serializeNode(node.left, insideMath, context)
      if (hasNegativeCoefficient(node.right)) {
        return `${left} + ${serializeNegated(node.right, insideMath, context)}`
      }
      return `${left} - ${serializeNode(node.right, insideMath, context)}`
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
    case 'Sign':
    case 'Sin':
    case 'Cos':
    case 'Tan':
    case 'Acos':
      return `${UNARY[node._tag].css}(${serializeNode(node.argument, true, context)})`
    case 'Atan2':
      return `atan2(${serializeNode(node.y, true, context)}, ${serializeNode(node.x, true, context)})`
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
      return (
        a.value === other.value && a.unit === other.unit && specEquals(a.precision, other.precision)
      )
    }
    case 'Ref':
      return a.name === (b as RefNode).name
    case 'Ident':
      return a.name === (b as IdentNode).name
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
    case 'Tan':
    case 'Acos':
      return nodeEquals(a.argument, (b as typeof a).argument)
    case 'Atan2': {
      const other = b as typeof a
      return nodeEquals(a.y, other.y) && nodeEquals(a.x, other.x)
    }
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
      const unit = node.unit === undefined ? 0 : Equal.hashString(node.unit)
      return Equal.combine(
        Equal.hashString('Constant'),
        Equal.combine(Equal.combine(Equal.hashNumber(node.value), precision), unit),
      )
    }
    case 'Ref':
      return Equal.combine(Equal.hashString('Ref'), Equal.hashString(node.name))
    case 'Ident':
      return Equal.combine(Equal.hashString('Ident'), Equal.hashString(node.name))
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
    case 'Tan':
    case 'Acos':
      return hashNodeArray(node._tag, [node.argument])
    case 'Atan2':
      return hashNodeArray('Atan2', [node.y, node.x])
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
export const isCalc = (u: unknown): u is Calc<string, Kind, unknown> =>
  typeof u === 'object' && u !== null && CalcTypeId in u

/** @internal */
export const nodeOf = (expr: Calc<string, Kind, unknown>): CalcNode => (expr as CalcImpl).node

/** @internal */
export const refsOf = <R extends string>(expr: Calc<R, Kind, unknown>): ReadonlySet<R> =>
  (expr as unknown as CalcImpl).refSet as ReadonlySet<R>

const makeCalc = (node: CalcNode, refSet: ReadonlySet<string>): Calc<string> =>
  new CalcImpl(node, refSet)

/**
 * Any operand the runtime combinators accept: an expression of any kind, or a
 * bare number. The precise per-combinator kind/leaf types live in `calc.ts`;
 * the runtime works on the erased tree.
 *
 * @internal
 */
export type AnyInput = Calc<string, Kind, unknown> | number

/**
 * The bottom `Calc` — assignable to every precise combinator return in
 * `calc.ts`. The loosely-typed runtime impls return this; the public signatures
 * carry the real kind/leaf types.
 *
 * @internal
 */
export type Bottom = Calc<never, never, never>

/** @internal */
export const toCalc = (input: AnyInput): Calc<string> =>
  typeof input === 'number' ? of(input) : (input as Calc<string>)

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

/**
 * Builds a dimensioned constant. The `data` module's `Length`/`Angle`
 * constructors call this and cast the result to the precise leaf-branded type;
 * the calc core stays unit-agnostic, carrying `unit` and `kind` as given.
 *
 * @internal
 */
export function dimension(value: number, unit: string, kind: Kind, precision?: Precision): Bottom {
  return makeCalc(
    constantNode(value, precision === undefined ? undefined : toSpec(precision), unit, kind),
    EMPTY_REFS,
  ) as Bottom
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

/**
 * Builds a bare-identifier constant — a leaf serializing as `name`, carrying no
 * references. The `data` module's `Channel` keywords call this; the identifier
 * text is opaque to the calc core, resolved by whatever CSS context surrounds
 * it (a relative-color function today).
 *
 * @internal
 */
export function ident(name: string): Calc<never> {
  invariant(name.length > 0, 'Identifier name must be a non-empty string')
  return makeCalc({ _tag: 'Ident', name }, EMPTY_REFS) as Calc<never>
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

/**
 * The shared shape of the variadic same-kind combinators (`add`, `min`, `max`):
 * fixed 2/3/4-ary overloads that union the operands' references, then a variadic
 * tail. The precise kind/leaf algebra rides on the public re-exports in
 * `calc.ts`; these internal arms track only references.
 */
interface NaryCombinator {
  <A extends string = never, B extends string = never>(a: Input<A>, b: Input<B>): Calc<A | B>
  <A extends string = never, B extends string = never, C extends string = never>(
    a: Input<A>,
    b: Input<B>,
    c: Input<C>,
  ): Calc<A | B | C>
  <
    A extends string = never,
    B extends string = never,
    C extends string = never,
    D extends string = never,
  >(
    a: Input<A>,
    b: Input<B>,
    c: Input<C>,
    d: Input<D>,
  ): Calc<A | B | C | D>
  (...args: readonly [Input<string>, Input<string>, ...ReadonlyArray<Input<string>>]): Calc<string>
}

// The precise arms widen the loose runtime impl (every arity returns
// `Calc<string>`); the function-overload form these three replace hid the same
// widening behind lenient overload checking, so the cast loses no safety.
const naryCombinator = (
  impl: (args: ReadonlyArray<Input<string>>) => Calc<string>,
): NaryCombinator => ((...args: ReadonlyArray<Input<string>>) => impl(args)) as NaryCombinator

/** @internal */
export const add: NaryCombinator = naryCombinator(addImpl)

/** @internal */
export const min: NaryCombinator = naryCombinator(minImpl)

/** @internal */
export const max: NaryCombinator = naryCombinator(maxImpl)

const liftBinary =
  (construct: (left: CalcNode, right: CalcNode) => CalcNode) =>
  (left: AnyInput, right: AnyInput): Calc<string> => {
    const l = toCalc(left)
    const r = toCalc(right)
    return makeCalc(construct(nodeOf(l), nodeOf(r)), mergeRefs([l, r]))
  }

const subtractImpl = liftBinary(subtractNode)
const multiplyImpl = liftBinary(multiplyNode)
const divideImpl = liftBinary(divideNode)
const powImpl = liftBinary(powNode)
const signedPowImpl = liftBinary(signedPowNode)
const atan2Impl = liftBinary(atan2Node)

/** @internal */
export function subtract(left: AnyInput, right: AnyInput): Bottom {
  return subtractImpl(left, right) as Bottom
}

/** @internal */
export function multiply(left: AnyInput, right: AnyInput): Bottom {
  return multiplyImpl(left, right) as Bottom
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
  (argument: AnyInput): Calc<string> => {
    const arg = toCalc(argument)
    return makeCalc(construct(nodeOf(arg)), refsOf(arg))
  }

const absImpl = liftUnary((argument) => foldUnary('Abs', argument))
const signImpl = liftUnary((argument) => foldUnary('Sign', argument))
const sinImpl = liftUnary((argument) => foldUnary('Sin', argument))
const cosImpl = liftUnary((argument) => foldUnary('Cos', argument))
const tanImpl = liftUnary((argument) => foldUnary('Tan', argument))
const acosImpl = liftUnary((argument) => foldUnary('Acos', argument))

/** @internal */
export function abs(argument: AnyInput): Bottom {
  return absImpl(argument) as Bottom
}

/** @internal */
export function sign<A extends string = never>(argument: Input<A>): Calc<A> {
  return signImpl(argument) as Calc<A>
}

/** @internal */
export function sin(argument: AnyInput): Bottom {
  return sinImpl(argument) as Bottom
}

/** @internal */
export function cos(argument: AnyInput): Bottom {
  return cosImpl(argument) as Bottom
}

/** @internal */
export function tan(argument: AnyInput): Bottom {
  return tanImpl(argument) as Bottom
}

/** @internal */
export function acos(argument: AnyInput): Bottom {
  return acosImpl(argument) as Bottom
}

/** @internal */
export function atan2(y: AnyInput, x: AnyInput): Bottom {
  return atan2Impl(y, x) as Bottom
}

/** @internal */
export function clamp(minimum: AnyInput, value: AnyInput, maximum: AnyInput): Bottom {
  const lo = toCalc(minimum)
  const mid = toCalc(value)
  const hi = toCalc(maximum)
  return makeCalc(
    clampNode(nodeOf(lo), nodeOf(mid), nodeOf(hi)),
    mergeRefs([lo, mid, hi]),
  ) as Bottom
}

/** @internal */
export function lerp(a: AnyInput, b: AnyInput, t: AnyInput): Bottom {
  return add(multiply(subtract(1, t), a), multiply(t, b)) as Bottom
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
  ): <Refs extends string>(expr: Calc<Refs, Kind, unknown>) => Calc<ApplyBindings<Refs, B>>
  <Refs extends string, const B extends Bindings>(
    expr: Calc<Refs, Kind, unknown>,
    bindings: B,
  ): Calc<ApplyBindings<Refs, B>>
} = dual(
  2,
  (expr: Calc<string, Kind, unknown>, bindings: Record<string, Input<string>>): Calc<string> => {
    const collected = collectBindings(refsOf(expr), bindings)
    return makeCalc(substituteNode(nodeOf(expr), collected.nodeBindings), collected.refSet)
  },
)

/** @internal */
export function solve(
  expr: Calc<string, Kind, unknown>,
  bindings?: Record<string, Input<string>>,
  context?: Record<string, number>,
): number {
  let node = nodeOf(expr)
  let remaining: ReadonlySet<string> = refsOf(expr)
  if (bindings !== undefined) {
    const collected = collectBindings(remaining, bindings)
    node = substituteNode(node, collected.nodeBindings)
    remaining = collected.refSet
  }
  invariant(remaining.size === 0, 'Cannot convert expression to number: unbound references remain')
  return evaluateNode(node, context ?? {})
}

/** @internal */
export function serialize<Refs extends string>(
  expr: Calc<Refs, Kind, unknown>,
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
export function refs<Refs extends string>(expr: Calc<Refs, Kind, unknown>): ReadonlySet<Refs> {
  return refsOf(expr)
}

/** @internal */
export const equals = dual<
  (that: Calc<string, Kind, unknown>) => (self: Calc<string, Kind, unknown>) => boolean,
  (self: Calc<string, Kind, unknown>, that: Calc<string, Kind, unknown>) => boolean
>(2, (self: Calc<string, Kind, unknown>, that: Calc<string, Kind, unknown>): boolean =>
  Equal.equals(self, that),
)
