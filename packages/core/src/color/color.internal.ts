import {
  type CalcNode,
  collectBindings,
  needsCalcWrap,
  nodeEquals,
  nodeHash,
  nodeOf,
  refsOf as calcRefsOf,
  serializeNode,
  substituteNode,
  toCalc,
} from '#calc/calc.internal'
import type { ApplyBindings, Bindings, Input, SerializeOptions } from '#calc/calc'
import { toSpec } from '#calc/precision.internal'
import * as Equal from '#internal/equal'
import { DEFAULT_FORMAT, type FormatSpec } from '#internal/format'
import { unionRefs } from '#internal/refs'
import { dual, Pipeable } from '#util'
import type { Color } from './color.ts'

export const ColorTypeId = Symbol.for('fashionable/color')
export type ColorTypeId = typeof ColorTypeId

/** @internal */
export interface OklchNode {
  readonly _tag: 'Oklch'
  readonly lightness: CalcNode
  readonly chroma: CalcNode
  readonly hue: CalcNode
}

/** @internal */
export type ColorNode = OklchNode

const serializeChannel = (channel: CalcNode, precision: FormatSpec): string => {
  const wrap = needsCalcWrap(channel)
  const body = serializeNode(channel, wrap, { precision })
  return wrap ? `calc(${body})` : body
}

const serializeColorNode = (node: ColorNode, precision: FormatSpec): string => {
  const lightness = serializeChannel(node.lightness, precision)
  const chroma = serializeChannel(node.chroma, precision)
  const hue = serializeChannel(node.hue, precision)
  return `oklch(${lightness} ${chroma} ${hue})`
}

const colorNodeEquals = (a: ColorNode, b: ColorNode): boolean =>
  nodeEquals(a.lightness, b.lightness) && nodeEquals(a.chroma, b.chroma) && nodeEquals(a.hue, b.hue)

const colorNodeHash = (node: ColorNode): number => {
  let h = Equal.hashString('Oklch')
  h = Equal.combine(h, nodeHash(node.lightness))
  h = Equal.combine(h, nodeHash(node.chroma))
  h = Equal.combine(h, nodeHash(node.hue))
  return h
}

class ColorImpl extends Pipeable implements Color<string>, Equal.Equal {
  readonly [ColorTypeId]: ColorTypeId = ColorTypeId

  readonly node: ColorNode
  readonly refSet: ReadonlySet<string>
  #hash: number | undefined

  constructor(node: ColorNode, refSet: ReadonlySet<string>) {
    super()
    this.node = node
    this.refSet = refSet
  }

  [Equal.EqualTypeId](that: unknown): boolean {
    return isColor(that) && colorNodeEquals(this.node, nodeOfColor(that))
  }

  [Equal.HashTypeId](): number {
    this.#hash ??= Equal.combine(Equal.hashString('fashionable/color'), colorNodeHash(this.node))
    return this.#hash
  }

  get [Symbol.toStringTag]() {
    return `Color(${serializeColorNode(this.node, DEFAULT_FORMAT)})`
  }

  get [Symbol.for('nodejs.util.inspect.custom')]() {
    return this[Symbol.toStringTag]
  }
}

/** @internal */
export const isColor = (u: unknown): u is Color<string> =>
  typeof u === 'object' && u !== null && ColorTypeId in u

/** @internal */
export const nodeOfColor = (color: Color<string>): ColorNode => (color as ColorImpl).node

/** @internal */
export const refsOf = <R extends string>(color: Color<R>): ReadonlySet<R> =>
  (color as unknown as ColorImpl).refSet as ReadonlySet<R>

/** @internal */
export function oklch<L extends string = never, C extends string = never, H extends string = never>(
  lightness: Input<L>,
  chroma: Input<C>,
  hue: Input<H>,
): Color<L | C | H> {
  const l = toCalc(lightness)
  const c = toCalc(chroma)
  const h = toCalc(hue)
  return new ColorImpl(
    { _tag: 'Oklch', lightness: nodeOf(l), chroma: nodeOf(c), hue: nodeOf(h) },
    unionRefs(calcRefsOf(l), calcRefsOf(c), calcRefsOf(h)),
  ) as Color<L | C | H>
}

/** @internal */
export const bind: {
  <const B extends Bindings>(
    bindings: B,
  ): <Refs extends string>(color: Color<Refs>) => Color<ApplyBindings<Refs, B>>
  <Refs extends string, const B extends Bindings>(
    color: Color<Refs>,
    bindings: B,
  ): Color<ApplyBindings<Refs, B>>
} = dual(2, (color: Color<string>, bindings: Record<string, Input<string>>): Color<string> => {
  const node = nodeOfColor(color)
  const collected = collectBindings(refsOf(color), bindings)
  return new ColorImpl(
    {
      _tag: 'Oklch',
      lightness: substituteNode(node.lightness, collected.nodeBindings),
      chroma: substituteNode(node.chroma, collected.nodeBindings),
      hue: substituteNode(node.hue, collected.nodeBindings),
    },
    collected.refSet,
  )
})

/** @internal */
export function serialize<Refs extends string>(
  color: Color<Refs>,
  options?: SerializeOptions<Refs>,
): string {
  let node = nodeOfColor(color)
  if (options?.bindings !== undefined) {
    const collected = collectBindings(
      refsOf(color),
      options.bindings as Record<string, Input<string> | undefined>,
    )
    node = {
      _tag: 'Oklch',
      lightness: substituteNode(node.lightness, collected.nodeBindings),
      chroma: substituteNode(node.chroma, collected.nodeBindings),
      hue: substituteNode(node.hue, collected.nodeBindings),
    }
  }
  const precision = options?.precision === undefined ? DEFAULT_FORMAT : toSpec(options.precision)
  return serializeColorNode(node, precision)
}

/** @internal */
export function refs<Refs extends string>(color: Color<Refs>): ReadonlySet<Refs> {
  return refsOf(color)
}

/** @internal */
export const equals = dual<
  (that: Color<string>) => (self: Color<string>) => boolean,
  (self: Color<string>, that: Color<string>) => boolean
>(2, (self: Color<string>, that: Color<string>): boolean => Equal.equals(self, that))
