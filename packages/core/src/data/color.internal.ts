import type { ApplyBindings, Bindings, Input, SerializeOptions } from '#calc/calc'
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
import { toSpec } from '#calc/precision.internal'
import * as Equal from '#internal/equal'
import { DEFAULT_FORMAT, type FormatSpec } from '#internal/format'
import { EMPTY_REFS, unionRefs } from '#internal/refs'
import { dual, invariant, Pipeable } from '#util'
import type { Color } from './color.ts'
import { isNone } from './keywords.internal.ts'
import type { None } from './keywords.ts'

export const ColorTypeId = Symbol.for('fashionable/color')
export type ColorTypeId = typeof ColorTypeId

/**
 * A channel slot: a number expression, or CSS's missing-component
 * keyword. The `none` marker is a singleton, so channel operations
 * discriminate by reference.
 *
 * @internal
 */
export type ChannelNode = CalcNode | NoneChannel

interface NoneChannel {
  readonly _tag: 'NoneKeyword'
}

const NONE_CHANNEL: NoneChannel = { _tag: 'NoneKeyword' }

const isNoneChannel = (channel: ChannelNode): channel is NoneChannel => channel === NONE_CHANNEL

/** @internal */
export interface OklchNode {
  readonly _tag: 'Oklch'
  readonly lightness: ChannelNode
  readonly chroma: ChannelNode
  readonly hue: ChannelNode
}

/** @internal */
export interface SrgbNode {
  readonly _tag: 'Srgb'
  readonly red: ChannelNode
  readonly green: ChannelNode
  readonly blue: ChannelNode
}

/**
 * A named color (`transparent`, `rebeccapurple`): the name is the whole
 * value, so the node has no channels and nothing to bind.
 *
 * @internal
 */
export interface NamedColorNode {
  readonly _tag: 'Named'
  readonly name: string
}

/**
 * A scheme-conditional color: `light-dark(light, dark)`. Arms are whole
 * color nodes — positional, not commutative (the first slot is the
 * light scheme) — so the node operations recurse where the channel
 * functions stay flat.
 *
 * @internal
 */
export interface LightDarkNode {
  readonly _tag: 'LightDark'
  readonly light: ColorNode
  readonly dark: ColorNode
}

/** @internal */
export type ColorNode = OklchNode | SrgbNode | LightDarkNode | NamedColorNode

type ChannelFunctionNode = OklchNode | SrgbNode

const channelsOf = (node: ChannelFunctionNode): ReadonlyArray<ChannelNode> =>
  node._tag === 'Oklch'
    ? [node.lightness, node.chroma, node.hue]
    : [node.red, node.green, node.blue]

const mapChannel = (channel: ChannelNode, f: (channel: CalcNode) => CalcNode): ChannelNode =>
  isNoneChannel(channel) ? channel : f(channel)

const mapColorNode = (node: ColorNode, f: (channel: CalcNode) => CalcNode): ColorNode => {
  switch (node._tag) {
    case 'Oklch':
      return {
        _tag: 'Oklch',
        lightness: mapChannel(node.lightness, f),
        chroma: mapChannel(node.chroma, f),
        hue: mapChannel(node.hue, f),
      }
    case 'Srgb':
      return {
        _tag: 'Srgb',
        red: mapChannel(node.red, f),
        green: mapChannel(node.green, f),
        blue: mapChannel(node.blue, f),
      }
    case 'LightDark':
      return {
        _tag: 'LightDark',
        light: mapColorNode(node.light, f),
        dark: mapColorNode(node.dark, f),
      }
    case 'Named':
      return node
  }
}

const serializeChannel = (channel: ChannelNode, precision: FormatSpec): string => {
  if (isNoneChannel(channel)) {
    return 'none'
  }
  const wrap = needsCalcWrap(channel)
  const body = serializeNode(channel, wrap, { precision })
  return wrap ? `calc(${body})` : body
}

const serializeColorNode = (node: ColorNode, precision: FormatSpec): string => {
  if (node._tag === 'Named') {
    return node.name
  }
  if (node._tag === 'LightDark') {
    return `light-dark(${serializeColorNode(node.light, precision)}, ${serializeColorNode(node.dark, precision)})`
  }
  const channels = channelsOf(node)
    .map((channel) => serializeChannel(channel, precision))
    .join(' ')
  return node._tag === 'Oklch' ? `oklch(${channels})` : `color(srgb ${channels})`
}

const channelEquals = (a: ChannelNode, b: ChannelNode): boolean => {
  if (isNoneChannel(a) || isNoneChannel(b)) {
    return a === b
  }
  return nodeEquals(a, b)
}

const colorNodeEquals = (a: ColorNode, b: ColorNode): boolean => {
  if (a._tag !== b._tag) {
    return false
  }
  if (a._tag === 'Named') {
    return a.name === (b as NamedColorNode).name
  }
  if (a._tag === 'LightDark') {
    const other = b as LightDarkNode
    return colorNodeEquals(a.light, other.light) && colorNodeEquals(a.dark, other.dark)
  }
  const others = channelsOf(b as ChannelFunctionNode)
  return channelsOf(a).every((channel, index) =>
    channelEquals(channel, others[index] as ChannelNode),
  )
}

const colorNodeHash = (node: ColorNode): number => {
  let h = Equal.hashString(node._tag)
  if (node._tag === 'Named') {
    return Equal.combine(h, Equal.hashString(node.name))
  }
  if (node._tag === 'LightDark') {
    h = Equal.combine(h, colorNodeHash(node.light))
    return Equal.combine(h, colorNodeHash(node.dark))
  }
  for (const channel of channelsOf(node)) {
    h = Equal.combine(h, isNoneChannel(channel) ? Equal.hashString('none') : nodeHash(channel))
  }
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

interface ResolvedChannel {
  readonly node: ChannelNode
  readonly refs: ReadonlySet<string>
}

const toChannel = (input: Input<string> | None): ResolvedChannel => {
  if (isNone(input)) {
    return { node: NONE_CHANNEL, refs: EMPTY_REFS }
  }
  const calc = toCalc(input)
  return { node: nodeOf(calc), refs: calcRefsOf(calc) }
}

/** @internal */
export function oklch<L extends string = never, C extends string = never, H extends string = never>(
  lightness: Input<L> | None,
  chroma: Input<C> | None,
  hue: Input<H> | None,
): Color<L | C | H> {
  const l = toChannel(lightness)
  const c = toChannel(chroma)
  const h = toChannel(hue)
  return new ColorImpl(
    { _tag: 'Oklch', lightness: l.node, chroma: c.node, hue: h.node },
    unionRefs(l.refs, c.refs, h.refs),
  ) as Color<L | C | H>
}

/** @internal */
export function srgb<R extends string = never, G extends string = never, B extends string = never>(
  red: Input<R> | None,
  green: Input<G> | None,
  blue: Input<B> | None,
): Color<R | G | B> {
  const r = toChannel(red)
  const g = toChannel(green)
  const b = toChannel(blue)
  return new ColorImpl(
    { _tag: 'Srgb', red: r.node, green: g.node, blue: b.node },
    unionRefs(r.refs, g.refs, b.refs),
  ) as Color<R | G | B>
}

// The CSS-wide keywords are whole-declaration values, not colors —
// `light-dark(inherit, …)` is invalid CSS — so `named` rejects them
// (the `PropertySyntax.keyword` posture).
const CSS_WIDE_KEYWORDS = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'default',
])

/** @internal */
export const named = (name: string): Color<never> => {
  invariant(name.length > 0, 'Named color must be a non-empty string')
  invariant(
    !CSS_WIDE_KEYWORDS.has(name.toLowerCase()),
    `Named color must not be a CSS-wide keyword, got '${name}'`,
  )
  return new ColorImpl({ _tag: 'Named', name }, EMPTY_REFS) as Color<never>
}

/** @internal */
export const transparent: Color<never> = named('transparent')

/** @internal */
export function lightDark<A extends string = never, B extends string = never>(
  light: Color<A>,
  dark: Color<B>,
): Color<A | B> {
  return new ColorImpl(
    { _tag: 'LightDark', light: nodeOfColor(light), dark: nodeOfColor(dark) },
    unionRefs(refsOf(light), refsOf(dark)),
  ) as Color<A | B>
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
  const collected = collectBindings(refsOf(color), bindings)
  return new ColorImpl(
    mapColorNode(nodeOfColor(color), (channel) => substituteNode(channel, collected.nodeBindings)),
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
    node = mapColorNode(node, (channel) => substituteNode(channel, collected.nodeBindings))
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
