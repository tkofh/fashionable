import type { ApplyBindings, Bindings, Calc, Input, SerializeOptions } from '#calc/calc'
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
import type { Color, HueInterpolation, InterpolationMethod } from './color.ts'
import { isNone } from './keywords.internal.ts'
import type { None } from './keywords.ts'
import { of as percentageOf } from './percentage.internal.ts'

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

/**
 * The normalized interpolation method of a `color-mix()`: a colorspace
 * token plus, for polar spaces, an optional hue-interpolation strategy.
 * The type-level polar/rectangular split lives in `color.ts`; the node
 * carries the erased strings.
 *
 * @internal
 */
export interface MethodNode {
  readonly colorspace: string
  readonly hue: HueInterpolation | undefined
}

/**
 * A `color-mix(in method, c1 p1?, c2 p2?)`. The two arms are whole color
 * nodes, each with an optional percentage — a percentage-kind `CalcNode`,
 * never `none`, `undefined` when omitted. Arms are positional (they carry
 * their own percentages), so the node operations recurse, as `LightDark`
 * does.
 *
 * @internal
 */
export interface ColorMixNode {
  readonly _tag: 'ColorMix'
  readonly method: MethodNode
  readonly color1: ColorNode
  readonly percentage1: CalcNode | undefined
  readonly color2: ColorNode
  readonly percentage2: CalcNode | undefined
}

/**
 * A relative color: `oklch(from origin l c h [/ a])` or
 * `color(from origin srgb r g b [/ a])`. `form` selects the destination
 * function; `origin` is a whole color node (recursed, as `LightDark` arms
 * are). The three `channels` and the optional `alpha` are calc slots whose
 * expressions may read the origin's channels through the `Channel` keywords —
 * bare-identifier leaves that stay put under bind and contribute no refs.
 *
 * @internal
 */
export interface RelativeNode {
  readonly _tag: 'Relative'
  readonly form: 'oklch' | 'srgb'
  readonly origin: ColorNode
  readonly channels: readonly [ChannelNode, ChannelNode, ChannelNode]
  readonly alpha: ChannelNode | undefined
}

/**
 * A color-valued custom-property reference: `var(--name)` used as a whole
 * color. The reference is the whole value, so — like a `Named` — it has no
 * channels to descend into; it serializes `var(--name)` and reports `name` as
 * a ref. The channel-binding path cannot substitute a color into it, so its
 * ref rides through `bind` (restored structurally), the browser being the one
 * to resolve it.
 *
 * @internal
 */
export interface ColorRefNode {
  readonly _tag: 'ColorRef'
  readonly name: string
}

/** @internal */
export type ColorNode =
  | OklchNode
  | SrgbNode
  | LightDarkNode
  | NamedColorNode
  | ColorMixNode
  | RelativeNode
  | ColorRefNode

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
    case 'ColorMix':
      return {
        _tag: 'ColorMix',
        method: node.method,
        color1: mapColorNode(node.color1, f),
        percentage1: node.percentage1 === undefined ? undefined : f(node.percentage1),
        color2: mapColorNode(node.color2, f),
        percentage2: node.percentage2 === undefined ? undefined : f(node.percentage2),
      }
    case 'Relative':
      return {
        _tag: 'Relative',
        form: node.form,
        origin: mapColorNode(node.origin, f),
        channels: [
          mapChannel(node.channels[0], f),
          mapChannel(node.channels[1], f),
          mapChannel(node.channels[2], f),
        ],
        alpha: node.alpha === undefined ? undefined : mapChannel(node.alpha, f),
      }
    case 'ColorRef':
    case 'Named':
      return node
  }
}

// A single calc-expression slot — a channel or a percentage — wrapped in
// `calc()` only when it is arithmetic; function forms and leaves stand alone.
const serializeCalcNode = (node: CalcNode, precision: FormatSpec): string => {
  const wrap = needsCalcWrap(node)
  const body = serializeNode(node, wrap, { precision })
  return wrap ? `calc(${body})` : body
}

const serializeChannel = (channel: ChannelNode, precision: FormatSpec): string =>
  isNoneChannel(channel) ? 'none' : serializeCalcNode(channel, precision)

const serializeMethod = (method: MethodNode): string =>
  method.hue === undefined ? `in ${method.colorspace}` : `in ${method.colorspace} ${method.hue} hue`

const serializeMixArm = (
  color: ColorNode,
  percentage: CalcNode | undefined,
  precision: FormatSpec,
): string => {
  const rendered = serializeColorNode(color, precision)
  return percentage === undefined
    ? rendered
    : `${rendered} ${serializeCalcNode(percentage, precision)}`
}

const serializeColorNode = (node: ColorNode, precision: FormatSpec): string => {
  if (node._tag === 'Named') {
    return node.name
  }
  if (node._tag === 'LightDark') {
    return `light-dark(${serializeColorNode(node.light, precision)}, ${serializeColorNode(node.dark, precision)})`
  }
  if (node._tag === 'ColorMix') {
    return `color-mix(${serializeMethod(node.method)}, ${serializeMixArm(node.color1, node.percentage1, precision)}, ${serializeMixArm(node.color2, node.percentage2, precision)})`
  }
  if (node._tag === 'ColorRef') {
    return `var(--${node.name})`
  }
  if (node._tag === 'Relative') {
    const origin = serializeColorNode(node.origin, precision)
    const channels = node.channels.map((channel) => serializeChannel(channel, precision)).join(' ')
    const alpha = node.alpha === undefined ? '' : ` / ${serializeChannel(node.alpha, precision)}`
    return node.form === 'oklch'
      ? `oklch(from ${origin} ${channels}${alpha})`
      : `color(from ${origin} srgb ${channels}${alpha})`
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

const percentageEquals = (a: CalcNode | undefined, b: CalcNode | undefined): boolean =>
  a === undefined || b === undefined ? a === b : nodeEquals(a, b)

// An optional channel — a relative color's alpha — where an omitted slot only
// equals another omitted slot, never a present `none` or expression.
const alphaEquals = (a: ChannelNode | undefined, b: ChannelNode | undefined): boolean =>
  a === undefined || b === undefined ? a === b : channelEquals(a, b)

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
  if (a._tag === 'ColorMix') {
    const other = b as ColorMixNode
    return (
      a.method.colorspace === other.method.colorspace &&
      a.method.hue === other.method.hue &&
      colorNodeEquals(a.color1, other.color1) &&
      percentageEquals(a.percentage1, other.percentage1) &&
      colorNodeEquals(a.color2, other.color2) &&
      percentageEquals(a.percentage2, other.percentage2)
    )
  }
  if (a._tag === 'ColorRef') {
    return a.name === (b as ColorRefNode).name
  }
  if (a._tag === 'Relative') {
    const other = b as RelativeNode
    return (
      a.form === other.form &&
      colorNodeEquals(a.origin, other.origin) &&
      a.channels.every((channel, index) =>
        channelEquals(channel, other.channels[index] as ChannelNode),
      ) &&
      alphaEquals(a.alpha, other.alpha)
    )
  }
  const others = channelsOf(b as ChannelFunctionNode)
  return channelsOf(a).every((channel, index) =>
    channelEquals(channel, others[index] as ChannelNode),
  )
}

const hashChannel = (channel: ChannelNode): number =>
  isNoneChannel(channel) ? Equal.hashString('none') : nodeHash(channel)

const colorNodeHash = (node: ColorNode): number => {
  let h = Equal.hashString(node._tag)
  if (node._tag === 'Named') {
    return Equal.combine(h, Equal.hashString(node.name))
  }
  if (node._tag === 'ColorRef') {
    return Equal.combine(h, Equal.hashString(node.name))
  }
  if (node._tag === 'LightDark') {
    h = Equal.combine(h, colorNodeHash(node.light))
    return Equal.combine(h, colorNodeHash(node.dark))
  }
  if (node._tag === 'ColorMix') {
    h = Equal.combine(h, Equal.hashString(node.method.colorspace))
    h = Equal.combine(h, node.method.hue === undefined ? 0 : Equal.hashString(node.method.hue))
    h = Equal.combine(h, colorNodeHash(node.color1))
    h = Equal.combine(h, node.percentage1 === undefined ? 0 : nodeHash(node.percentage1))
    h = Equal.combine(h, colorNodeHash(node.color2))
    return Equal.combine(h, node.percentage2 === undefined ? 0 : nodeHash(node.percentage2))
  }
  if (node._tag === 'Relative') {
    h = Equal.combine(h, Equal.hashString(node.form))
    h = Equal.combine(h, colorNodeHash(node.origin))
    for (const channel of node.channels) {
      h = Equal.combine(h, hashChannel(channel))
    }
    return Equal.combine(h, node.alpha === undefined ? 0 : hashChannel(node.alpha))
  }
  for (const channel of channelsOf(node)) {
    h = Equal.combine(h, hashChannel(channel))
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
export const ref = <Name extends string>(name: Name): Color<Name> => {
  invariant(name.length > 0, 'Color reference name must be a non-empty string')
  return new ColorImpl({ _tag: 'ColorRef', name }, new Set([name])) as Color<Name>
}

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

const normalizeMethod = (method: InterpolationMethod): MethodNode =>
  typeof method === 'string'
    ? { colorspace: method, hue: undefined }
    : { colorspace: method.colorspace, hue: 'hue' in method ? method.hue : undefined }

interface ResolvedArm {
  readonly color: ColorNode
  readonly percentage: CalcNode | undefined
  readonly refs: ReadonlySet<string>
}

const toArm = (
  arm: Color<string> | readonly [Color<string>, number | Calc<string, 'percentage', unknown>],
): ResolvedArm => {
  if (isColor(arm)) {
    return { color: nodeOfColor(arm), percentage: undefined, refs: refsOf(arm) }
  }
  const [color, percentage] = arm
  const pct = typeof percentage === 'number' ? percentageOf(percentage) : percentage
  return {
    color: nodeOfColor(color),
    percentage: nodeOf(pct),
    refs: unionRefs(refsOf(color), calcRefsOf(pct)),
  }
}

/** @internal */
export function mix<
  C1 extends string = never,
  P1 extends string = never,
  C2 extends string = never,
  P2 extends string = never,
>(
  method: InterpolationMethod,
  color1: Color<C1> | readonly [Color<C1>, number | Calc<P1, 'percentage', unknown>],
  color2: Color<C2> | readonly [Color<C2>, number | Calc<P2, 'percentage', unknown>],
): Color<C1 | P1 | C2 | P2> {
  const a1 = toArm(color1)
  const a2 = toArm(color2)
  return new ColorImpl(
    {
      _tag: 'ColorMix',
      method: normalizeMethod(method),
      color1: a1.color,
      percentage1: a1.percentage,
      color2: a2.color,
      percentage2: a2.percentage,
    },
    unionRefs(a1.refs, a2.refs),
  ) as Color<C1 | P1 | C2 | P2>
}

const relative = (
  form: 'oklch' | 'srgb',
  origin: Color<string>,
  channel1: Input<string> | None,
  channel2: Input<string> | None,
  channel3: Input<string> | None,
  alpha: Input<string> | None | undefined,
): Color<string> => {
  const c1 = toChannel(channel1)
  const c2 = toChannel(channel2)
  const c3 = toChannel(channel3)
  const a = alpha === undefined ? undefined : toChannel(alpha)
  return new ColorImpl(
    {
      _tag: 'Relative',
      form,
      origin: nodeOfColor(origin),
      channels: [c1.node, c2.node, c3.node],
      alpha: a === undefined ? undefined : a.node,
    },
    unionRefs(refsOf(origin), c1.refs, c2.refs, c3.refs, a === undefined ? EMPTY_REFS : a.refs),
  )
}

/** @internal */
export function oklchFrom<
  O extends string = never,
  L extends string = never,
  C extends string = never,
  H extends string = never,
  A extends string = never,
>(
  origin: Color<O>,
  lightness: Input<L> | None,
  chroma: Input<C> | None,
  hue: Input<H> | None,
  alpha?: Input<A> | None,
): Color<O | L | C | H | A> {
  return relative('oklch', origin, lightness, chroma, hue, alpha) as Color<O | L | C | H | A>
}

/** @internal */
export function srgbFrom<
  O extends string = never,
  R extends string = never,
  G extends string = never,
  B extends string = never,
  A extends string = never,
>(
  origin: Color<O>,
  red: Input<R> | None,
  green: Input<G> | None,
  blue: Input<B> | None,
  alpha?: Input<A> | None,
): Color<O | R | G | B | A> {
  return relative('srgb', origin, red, green, blue, alpha) as Color<O | R | G | B | A>
}

// The color-valued reference names in a node — the `ColorRef` origins the
// channel-binding path cannot substitute, so `bind` restores them structurally
// rather than trust `collectBindings` to have kept them (it strips any bound
// key, including a color-ref name a caller passed a value for).
const colorRefNames = (node: ColorNode): ReadonlySet<string> => {
  switch (node._tag) {
    case 'ColorRef':
      return new Set([node.name])
    case 'LightDark':
      return unionRefs(colorRefNames(node.light), colorRefNames(node.dark))
    case 'ColorMix':
      return unionRefs(colorRefNames(node.color1), colorRefNames(node.color2))
    case 'Relative':
      return colorRefNames(node.origin)
    case 'Oklch':
    case 'Srgb':
    case 'Named':
      return EMPTY_REFS
  }
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
  const node = mapColorNode(nodeOfColor(color), (channel) =>
    substituteNode(channel, collected.nodeBindings),
  )
  return new ColorImpl(node, unionRefs(collected.refSet, colorRefNames(node)))
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
