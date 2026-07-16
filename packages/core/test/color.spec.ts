import { describe, expect, test } from 'vitest'
import { Calc } from '#calc'
import { Channel, Color, ColorSpace, HueInterpolation, Keyword, Percentage } from '#data'

describe('color', () => {
  describe('oklch', () => {
    test('serializes constant channels', () => {
      expect(Color.serialize(Color.oklch(0.7, 0.15, 220))).toBe('oklch(0.7 0.15 220)')
    })

    test('serializes reference channels as var()', () => {
      expect(Color.serialize(Color.oklch(Calc.var('l'), 0.15, 220))).toBe(
        'oklch(var(--l) 0.15 220)',
      )
    })

    test('wraps arithmetic channels in calc()', () => {
      const color = Color.oklch(Calc.add(Calc.var('l'), 0.1), 0.04, 250)
      expect(Color.serialize(color)).toBe('oklch(calc(var(--l) + 0.1) 0.04 250)')
    })

    test('leaves function-form channels unwrapped', () => {
      const color = Color.oklch(Calc.clamp(0, Calc.var('l'), 1), 0.04, 250)
      expect(Color.serialize(color)).toBe('oklch(clamp(0, var(--l), 1) 0.04 250)')
    })

    test('each channel wraps independently', () => {
      const color = Color.oklch(
        Calc.add(Calc.var('l'), 0.1),
        Calc.var('c'),
        Calc.multiply(Calc.var('h'), 2),
      )
      expect(Color.serialize(color)).toBe('oklch(calc(var(--l) + 0.1) var(--c) calc(var(--h) * 2))')
    })
  })

  describe('srgb', () => {
    test('serializes the consumer shape byte-exact', () => {
      expect(Color.serialize(Color.srgb(0.18, 0.34, 0.78))).toBe('color(srgb 0.18 0.34 0.78)')
    })

    test('serializes reference channels as var()', () => {
      expect(Color.serialize(Color.srgb(Calc.var('r'), 0.34, 0.78))).toBe(
        'color(srgb var(--r) 0.34 0.78)',
      )
    })

    test('wraps arithmetic channels in calc()', () => {
      const color = Color.srgb(Calc.multiply(Calc.var('r'), 0.5), 0.34, 0.78)
      expect(Color.serialize(color)).toBe('color(srgb calc(var(--r) * 0.5) 0.34 0.78)')
    })

    test('binds through channels', () => {
      const color = Color.srgb(Calc.var('r'), Calc.var('g'), 0.78)
      expect(Color.serialize(Color.bind(color, { r: 0.18, g: 0.34 }))).toBe(
        'color(srgb 0.18 0.34 0.78)',
      )
    })

    test('equality is structural and per-function', () => {
      expect(Color.equals(Color.srgb(0.1, 0.2, 0.3), Color.srgb(0.1, 0.2, 0.3))).toBe(true)
      expect(Color.equals(Color.srgb(0.1, 0.2, 0.3), Color.srgb(0.3, 0.2, 0.1))).toBe(false)
      // Different color functions never compare equal, even where they
      // would name the same point in color space.
      expect(Color.equals(Color.srgb(0, 0, 0), Color.oklch(0, 0, 0))).toBe(false)
    })
  })

  describe('lightDark', () => {
    test('serializes the consumer shape byte-exact', () => {
      const accent = Color.lightDark(Color.srgb(0.85, 0.3, 0.4), Color.srgb(0.95, 0.5, 0.55))
      expect(Color.serialize(accent)).toBe(
        'light-dark(color(srgb 0.85 0.3 0.4), color(srgb 0.95 0.5 0.55))',
      )
    })

    test('arms mix color functions', () => {
      const color = Color.lightDark(Color.oklch(0.7, 0.15, 220), Color.srgb(0.1, 0.2, 0.3))
      expect(Color.serialize(color)).toBe(
        'light-dark(oklch(0.7 0.15 220), color(srgb 0.1 0.2 0.3))',
      )
    })

    test('unions both arms’ references and binds through them', () => {
      const color = Color.lightDark(
        Color.oklch(Calc.var('l'), 0.1, 250),
        Color.srgb(Calc.var('r'), 0.2, 0.3),
      )
      expect(Color.vars(color)).toEqual(new Set(['l', 'r']))
      expect(Color.serialize(Color.bind(color, { l: 0.9, r: 0.1 }))).toBe(
        'light-dark(oklch(0.9 0.1 250), color(srgb 0.1 0.2 0.3))',
      )
    })

    test('arms are positional: light and dark do not commute', () => {
      const light = Color.srgb(1, 1, 1)
      const dark = Color.srgb(0, 0, 0)
      expect(Color.equals(Color.lightDark(light, dark), Color.lightDark(light, dark))).toBe(true)
      expect(Color.equals(Color.lightDark(light, dark), Color.lightDark(dark, light))).toBe(false)
    })

    test('nested arms are legal and render verbatim', () => {
      const inner = Color.lightDark(Color.srgb(1, 1, 1), Color.srgb(0, 0, 0))
      const outer = Color.lightDark(inner, Color.oklch(0.2, 0, 0))
      expect(Color.serialize(outer)).toBe(
        'light-dark(light-dark(color(srgb 1 1 1), color(srgb 0 0 0)), oklch(0.2 0 0))',
      )
    })
  })

  describe('mix', () => {
    test('serializes a bare two-color mix', () => {
      expect(
        Color.serialize(Color.mix(ColorSpace.oklch, Color.named('red'), Color.named('blue'))),
      ).toBe('color-mix(in oklch, red, blue)')
    })

    test('mixes whole color functions as arms', () => {
      const color = Color.mix(
        ColorSpace.srgb,
        Color.srgb(0.1, 0.2, 0.3),
        Color.oklch(0.7, 0.15, 220),
      )
      expect(Color.serialize(color)).toBe(
        'color-mix(in srgb, color(srgb 0.1 0.2 0.3), oklch(0.7 0.15 220))',
      )
    })

    test('a bare number arm weight renders as a percent', () => {
      const color = Color.mix(ColorSpace.srgb, [Color.named('white'), 20], Color.named('black'))
      expect(Color.serialize(color)).toBe('color-mix(in srgb, white 20%, black)')
    })

    test('both arms may carry weights', () => {
      const color = Color.mix(ColorSpace.oklch, [Color.named('red'), 40], [Color.named('blue'), 60])
      expect(Color.serialize(color)).toBe('color-mix(in oklch, red 40%, blue 60%)')
    })

    test('a Percentage weight serializes identically to the number form', () => {
      const color = Color.mix(
        ColorSpace.oklch,
        [Color.named('red'), Percentage.of(40)],
        Color.named('blue'),
      )
      expect(Color.serialize(color)).toBe('color-mix(in oklch, red 40%, blue)')
    })

    test('summed constant percentages fold; an arithmetic weight wraps in calc()', () => {
      const folded = Color.mix(
        ColorSpace.oklch,
        [Color.named('red'), Calc.add(Percentage.of(20), Percentage.of(5))],
        Color.named('blue'),
      )
      expect(Color.serialize(folded)).toBe('color-mix(in oklch, red 25%, blue)')

      const scaled = Color.mix(
        ColorSpace.oklch,
        [Color.named('red'), Calc.multiply(Percentage.of(50), Calc.var('t'))],
        Color.named('blue'),
      )
      expect(Color.serialize(scaled)).toBe('color-mix(in oklch, red calc(50% * var(--t)), blue)')
    })

    test('a polar space carries a hue-interpolation strategy', () => {
      const color = Color.mix(
        ColorSpace.oklch,
        HueInterpolation.longer,
        Color.named('red'),
        Color.named('blue'),
      )
      expect(Color.serialize(color)).toBe('color-mix(in oklch longer hue, red, blue)')
    })

    test('unions arm and percentage references, and binds through both', () => {
      const color = Color.mix(
        ColorSpace.oklch,
        [Color.oklch(Calc.var('l'), 0.1, 250), Calc.multiply(Percentage.of(50), Calc.var('t'))],
        Color.srgb(Calc.var('r'), 0.2, 0.3),
      )
      expect(Color.vars(color)).toEqual(new Set(['l', 't', 'r']))
      // binding is partial evaluation: the weight folds `50% * 0.5` to `25%`
      expect(Color.serialize(Color.bind(color, { l: 0.9, t: 0.5, r: 0.1 }))).toBe(
        'color-mix(in oklch, oklch(0.9 0.1 250) 25%, color(srgb 0.1 0.2 0.3))',
      )
    })

    test('serialize applies partial bindings, leaving an unbound weight symbolic', () => {
      const color = Color.mix(
        ColorSpace.srgb,
        [Color.srgb(Calc.var('r'), 0, 0), Calc.multiply(Percentage.of(50), Calc.var('w'))],
        Color.named('black'),
      )
      // r binds into the channel; w stays unbound, so its weight keeps the calc() wrap
      expect(Color.serialize(color, { bindings: { r: 0.8 } })).toBe(
        'color-mix(in srgb, color(srgb 0.8 0 0) calc(50% * var(--w)), black)',
      )
    })

    test('equality is structural over space, arms, and weights', () => {
      const base = Color.mix(ColorSpace.oklch, [Color.named('red'), 40], Color.named('blue'))
      expect(
        Color.equals(
          base,
          Color.mix(ColorSpace.oklch, [Color.named('red'), 40], Color.named('blue')),
        ),
      ).toBe(true)
      // a different colorspace never compares equal
      expect(
        Color.equals(
          base,
          Color.mix(ColorSpace.srgb, [Color.named('red'), 40], Color.named('blue')),
        ),
      ).toBe(false)
      // a different weight never compares equal
      expect(
        Color.equals(
          base,
          Color.mix(ColorSpace.oklch, [Color.named('red'), 60], Color.named('blue')),
        ),
      ).toBe(false)
      // an omitted weight never equals a present one
      expect(
        Color.equals(base, Color.mix(ColorSpace.oklch, Color.named('red'), Color.named('blue'))),
      ).toBe(false)
      // the hue strategy participates
      expect(
        Color.equals(
          Color.mix(
            ColorSpace.oklch,
            HueInterpolation.longer,
            Color.named('red'),
            Color.named('blue'),
          ),
          Color.mix(
            ColorSpace.oklch,
            HueInterpolation.shorter,
            Color.named('red'),
            Color.named('blue'),
          ),
        ),
      ).toBe(false)
    })

    test('arms are positional: swapping colors is a different mix', () => {
      const a = Color.mix(ColorSpace.oklch, [Color.named('red'), 40], Color.named('blue'))
      const b = Color.mix(ColorSpace.oklch, Color.named('blue'), [Color.named('red'), 40])
      expect(Color.equals(a, b)).toBe(false)
    })

    test('a mix nests as a color-mix arm and a light-dark arm', () => {
      const inner = Color.mix(ColorSpace.oklch, Color.named('red'), Color.named('blue'))
      expect(Color.serialize(Color.mix(ColorSpace.srgb, inner, Color.named('white')))).toBe(
        'color-mix(in srgb, color-mix(in oklch, red, blue), white)',
      )
      expect(Color.serialize(Color.lightDark(inner, Color.transparent))).toBe(
        'light-dark(color-mix(in oklch, red, blue), transparent)',
      )
    })
  })

  describe('relative color', () => {
    test('from an oklch space serializes the consumer shape byte-exact', () => {
      const hover = Color.from(
        Color.var('accent'),
        ColorSpace.oklch,
        Calc.multiply(Channel.L, 0.8),
        Channel.C,
        Channel.H,
      )
      expect(Color.serialize(hover)).toBe('oklch(from var(--accent) calc(l * 0.8) c h)')
    })

    test('passing the keywords straight through reproduces the origin', () => {
      const same = Color.from(
        Color.var('accent'),
        ColorSpace.oklch,
        Channel.L,
        Channel.C,
        Channel.H,
      )
      expect(Color.serialize(same)).toBe('oklch(from var(--accent) l c h)')
    })

    test('an srgb space derives inside color(from … srgb …) with an alpha slash', () => {
      const faded = Color.from(
        Color.var('brand'),
        ColorSpace.srgb,
        Channel.R,
        Channel.G,
        Channel.B,
        Calc.multiply(Channel.Alpha, 0.5),
      )
      expect(Color.serialize(faded)).toBe('color(from var(--brand) srgb r g b / calc(alpha * 0.5))')
    })

    test('the origin may be any color, not just a reference', () => {
      const rel = Color.from(
        Color.oklch(0.6, 0.15, 250),
        ColorSpace.oklch,
        Channel.L,
        Channel.C,
        Channel.H,
      )
      expect(Color.serialize(rel)).toBe('oklch(from oklch(0.6 0.15 250) l c h)')
    })

    test('channels accept none, and alpha accepts none after the slash', () => {
      const color = Color.from(
        Color.var('x'),
        ColorSpace.oklch,
        0.5,
        Keyword.none,
        Channel.H,
        Keyword.none,
      )
      expect(Color.serialize(color)).toBe('oklch(from var(--x) 0.5 none h / none)')
    })

    test('unions the origin and channel references and binds through channels', () => {
      const color = Color.from(
        Color.var('accent'),
        ColorSpace.oklch,
        Calc.multiply(Channel.L, Calc.var('k')),
        Channel.C,
        Channel.H,
      )
      expect(Color.vars(color)).toEqual(new Set(['accent', 'k']))
      // the channel ref binds; the color reference rides through, unbound
      const bound = Color.bind(color, { k: 0.8 })
      expect(Color.vars(bound)).toEqual(new Set(['accent']))
      expect(Color.serialize(bound)).toBe('oklch(from var(--accent) calc(l * 0.8) c h)')
    })

    test('channels() reports the origin channels read; refs() the custom properties', () => {
      const hover = Color.from(
        Color.var('accent'),
        ColorSpace.oklch,
        Calc.multiply(Channel.L, 0.8),
        Channel.C,
        Channel.H,
      )
      expect(Color.channels(hover)).toEqual(new Set(['l', 'c', 'h']))
      expect(Color.vars(hover)).toEqual(new Set(['accent']))
    })

    test('a custom property named like a channel is a ref, not a channel', () => {
      // var(--l) is the reference l; Channel.L is the bare keyword l — distinct
      const color = Color.oklch(Calc.var('l'), 0.1, 250)
      expect(Color.vars(color)).toEqual(new Set(['l']))
      expect(Color.channels(color)).toEqual(new Set())
    })

    test('binding through the origin color reaches its channels', () => {
      const color = Color.from(
        Color.oklch(Calc.var('base'), 0.1, 250),
        ColorSpace.oklch,
        Channel.L,
        Channel.C,
        Channel.H,
      )
      expect(Color.serialize(Color.bind(color, { base: 0.6 }))).toBe(
        'oklch(from oklch(0.6 0.1 250) l c h)',
      )
    })

    test('equality is structural over space, origin, channels, and alpha', () => {
      const base = Color.from(
        Color.var('accent'),
        ColorSpace.oklch,
        Channel.L,
        Channel.C,
        Channel.H,
      )
      expect(
        Color.equals(
          base,
          Color.from(Color.var('accent'), ColorSpace.oklch, Channel.L, Channel.C, Channel.H),
        ),
      ).toBe(true)
      // a different origin never compares equal
      expect(
        Color.equals(
          base,
          Color.from(Color.var('brand'), ColorSpace.oklch, Channel.L, Channel.C, Channel.H),
        ),
      ).toBe(false)
      // a present alpha never equals an omitted one
      expect(
        Color.equals(
          base,
          Color.from(
            Color.var('accent'),
            ColorSpace.oklch,
            Channel.L,
            Channel.C,
            Channel.H,
            Channel.Alpha,
          ),
        ),
      ).toBe(false)
      // the destination space participates: an srgb form never equals an oklch one
      expect(
        Color.equals(
          base,
          Color.from(Color.var('accent'), ColorSpace.srgb, Channel.R, Channel.G, Channel.B),
        ),
      ).toBe(false)
    })

    test('a relative color nests as an origin and as a light-dark arm', () => {
      const inner = Color.from(
        Color.var('accent'),
        ColorSpace.oklch,
        Channel.L,
        Channel.C,
        Channel.H,
      )
      expect(
        Color.serialize(Color.from(inner, ColorSpace.oklch, Channel.L, Channel.C, Channel.H)),
      ).toBe('oklch(from oklch(from var(--accent) l c h) l c h)')
      expect(Color.serialize(Color.lightDark(inner, Color.transparent))).toBe(
        'light-dark(oklch(from var(--accent) l c h), transparent)',
      )
    })
  })

  describe('color reference', () => {
    test('ref serializes as a custom property', () => {
      expect(Color.serialize(Color.var('accent'))).toBe('var(--accent)')
    })

    test('reports its name as a dependency and has no channels to bind', () => {
      const accent = Color.var('accent')
      expect(Color.vars(accent)).toEqual(new Set(['accent']))
      // bind operates on channels, not whole colors: the reference rides through,
      // and its ref survives rather than being silently dropped
      expect(Color.serialize(Color.bind(accent, { accent: 0 }))).toBe('var(--accent)')
      expect(Color.vars(Color.bind(accent, { accent: 0 }))).toEqual(new Set(['accent']))
    })

    test('composes as a mix arm and a light-dark arm', () => {
      expect(Color.serialize(Color.mix(ColorSpace.oklch, Color.var('a'), Color.var('b')))).toBe(
        'color-mix(in oklch, var(--a), var(--b))',
      )
      expect(Color.serialize(Color.lightDark(Color.var('light'), Color.var('dark')))).toBe(
        'light-dark(var(--light), var(--dark))',
      )
    })

    test('equality is the name', () => {
      expect(Color.equals(Color.var('accent'), Color.var('accent'))).toBe(true)
      expect(Color.equals(Color.var('accent'), Color.var('brand'))).toBe(false)
      // a reference is not the named color of the same text
      expect(Color.equals(Color.var('accent'), Color.named('accent'))).toBe(false)
    })

    test('rejects an empty name', () => {
      expect(() => Color.var('')).toThrow('non-empty')
    })
  })

  describe('channel keywords', () => {
    test('serialize bare and wrap only when arithmetic', () => {
      expect(Calc.serialize(Channel.L)).toBe('l')
      expect(Calc.serialize(Channel.Alpha)).toBe('alpha')
      expect(Calc.serialize(Calc.multiply(Channel.L, 0.8))).toBe('calc(l * 0.8)')
    })

    test('contribute no references', () => {
      expect(Calc.vars(Channel.C)).toEqual(new Set())
      expect(Calc.vars(Calc.add(Channel.L, Calc.var('k')))).toEqual(new Set(['k']))
    })

    test('channels() collects the keyword tokens, disjoint from refs()', () => {
      const expr = Calc.multiply(Channel.L, Calc.var('k'))
      expect(Calc.idents(expr)).toEqual(new Set(['l']))
      expect(Calc.vars(expr)).toEqual(new Set(['k']))
      expect(Calc.idents(Calc.var('k'))).toEqual(new Set())
    })

    test('equality is per keyword', () => {
      expect(Calc.equals(Channel.L, Channel.L)).toBe(true)
      expect(Calc.equals(Channel.L, Channel.C)).toBe(false)
    })

    test('solve resolves a channel from a value in the context', () => {
      expect(Calc.solve(Calc.multiply(Channel.L, 0.8), { idents: { l: 0.5 } })).toBe(0.4)
    })

    test('solving without a value for the channel throws', () => {
      // the missing value is a compile error; cast past it to pin the guard
      expect(() => Calc.solve(Calc.multiply(Channel.L, 0.8) as Calc.Calc<never>)).toThrow(
        'no value for it in the idents section',
      )
    })

    test('pow and sign compose with channel keywords', () => {
      expect(Calc.serialize(Calc.pow(Channel.L, 2.2))).toBe('pow(l, 2.2)')
      expect(Calc.solve(Calc.pow(Channel.L, 2), { idents: { l: 3 } })).toBe(9)
      expect(Calc.solve(Calc.sign(Channel.C), { idents: { c: -2 } })).toBe(-1)
    })

    test('a channel divisor keeps its idents requirement', () => {
      expect(Calc.solve(Calc.divide(2, Channel.L), { idents: { l: 4 } })).toBe(0.5)
    })
  })

  describe('hue interpolation', () => {
    test('folds constant arguments and stays symbolic in t', () => {
      const symbolic = HueInterpolation.interpolate(HueInterpolation.shorter, 30, 60, Calc.var('t'))
      expect(Calc.serialize(symbolic)).toBe('calc(30 + 30 * var(--t))')
      expect(Calc.vars(symbolic)).toEqual(new Set(['t']))
      // the arc wraps past 0 when that is the short way, keeping from unmoved
      expect(
        Calc.serialize(
          HueInterpolation.interpolate(HueInterpolation.shorter, 350, 20, Calc.var('t')),
        ),
      ).toBe('calc(350 + 30 * var(--t))')
    })

    test('each strategy picks its arc; the result is an unwrapped degree number', () => {
      expect(
        Calc.serialize(HueInterpolation.interpolate(HueInterpolation.shorter, 30, 60, 0.5)),
      ).toBe('45')
      expect(
        Calc.serialize(HueInterpolation.interpolate(HueInterpolation.longer, 30, 60, 0.5)),
      ).toBe('-135')
      expect(
        Calc.serialize(HueInterpolation.interpolate(HueInterpolation.increasing, 20, 350, 0.5)),
      ).toBe('185')
      expect(
        Calc.serialize(HueInterpolation.interpolate(HueInterpolation.decreasing, 20, 350, 0.5)),
      ).toBe('5')
    })

    test('interpolates between symbolic hues, branchlessly via mod', () => {
      const hue = HueInterpolation.interpolate(
        HueInterpolation.shorter,
        Calc.var('from'),
        Calc.var('to'),
        Calc.var('t'),
      )
      expect(Calc.vars(hue)).toEqual(new Set(['from', 'to', 't']))
      expect(Calc.serialize(hue)).toBe(
        'calc(var(--from) + (mod(var(--to) - var(--from) + 180, 360) - 180) * var(--t))',
      )
    })

    test('the hue drops into an oklch channel', () => {
      const hue = HueInterpolation.interpolate(HueInterpolation.shorter, 30, 60, Calc.var('t'))
      expect(Color.serialize(Color.oklch(0.7, 0.15, hue))).toBe(
        'oklch(0.7 0.15 calc(30 + 30 * var(--t)))',
      )
    })
  })

  describe('none channels', () => {
    test('oklch renders the achromatic consumer shape byte-exact', () => {
      expect(Color.serialize(Color.oklch(0, 0, Keyword.none))).toBe('oklch(0 0 none)')
    })

    test('srgb channels accept none', () => {
      expect(Color.serialize(Color.srgb(Keyword.none, 0.5, 1))).toBe('color(srgb none 0.5 1)')
    })

    test('none contributes no references and passes through bind', () => {
      const color = Color.oklch(Calc.var('l'), 0, Keyword.none)
      expect(Color.vars(color)).toEqual(new Set(['l']))
      expect(Color.serialize(Color.bind(color, { l: 0.7 }))).toBe('oklch(0.7 0 none)')
    })

    test('a none channel never equals a numeric one', () => {
      expect(Color.equals(Color.oklch(0, 0, Keyword.none), Color.oklch(0, 0, 0))).toBe(false)
      expect(Color.equals(Color.oklch(0, 0, Keyword.none), Color.oklch(0, 0, Keyword.none))).toBe(
        true,
      )
    })

    test('isNone guards the keyword alone', () => {
      expect(Keyword.isNone(Keyword.none)).toBe(true)
      expect(Keyword.isNone('none')).toBe(false)
      expect(Keyword.isNone(0)).toBe(false)
    })
  })

  describe('named colors', () => {
    test('transparent renders bare', () => {
      expect(Color.serialize(Color.transparent)).toBe('transparent')
    })

    test('named renders its name verbatim', () => {
      expect(Color.serialize(Color.named('rebeccapurple'))).toBe('rebeccapurple')
    })

    test('composes as a light-dark arm', () => {
      const color = Color.lightDark(Color.transparent, Color.srgb(0, 0, 0))
      expect(Color.serialize(color)).toBe('light-dark(transparent, color(srgb 0 0 0))')
    })

    test('contributes no references and equality is the name', () => {
      expect(Color.vars(Color.transparent)).toEqual(new Set())
      expect(Color.equals(Color.transparent, Color.named('transparent'))).toBe(true)
      expect(Color.equals(Color.transparent, Color.named('white'))).toBe(false)
    })

    test('rejects empty names and CSS-wide keywords', () => {
      expect(() => Color.named('')).toThrow('non-empty')
      expect(() => Color.named('inherit')).toThrow('CSS-wide keyword')
      expect(() => Color.named('Initial')).toThrow('CSS-wide keyword')
    })
  })

  describe('refs', () => {
    test('unions channel references', () => {
      const color = Color.oklch(Calc.var('l'), Calc.var('c'), Calc.var('h'))
      expect(Color.vars(color)).toEqual(new Set(['l', 'c', 'h']))
    })

    test('srgb unions channel references likewise', () => {
      const color = Color.srgb(Calc.var('r'), Calc.var('g'), Calc.var('b'))
      expect(Color.vars(color)).toEqual(new Set(['r', 'g', 'b']))
    })

    test('constant channels contribute no references', () => {
      expect(Color.vars(Color.oklch(0.7, 0.15, 220))).toEqual(new Set())
    })
  })

  describe('bind', () => {
    test('binds channel references', () => {
      const color = Color.oklch(Calc.add(Calc.var('l'), 0.1), 0.04, 250)
      const bound = Color.bind(color, { l: 0.5 })
      expect(Color.vars(bound)).toEqual(new Set())
      expect(Color.serialize(bound)).toBe('oklch(0.6 0.04 250)')
    })

    test('supports data-last application', () => {
      const color = Color.oklch(Calc.var('l'), 0.04, 250)
      expect(Color.serialize(color.pipe(Color.bind({ l: 0.5 })))).toBe('oklch(0.5 0.04 250)')
    })

    test('serialize applies partial bindings', () => {
      const color = Color.oklch(Calc.var('l'), Calc.var('c'), 250)
      expect(Color.serialize(color, { bindings: { c: 0.04 } })).toBe('oklch(var(--l) 0.04 250)')
    })
  })

  describe('guards', () => {
    test('isColor accepts colors and rejects the rest', () => {
      expect(Color.isColor(Color.oklch(1, 0, 0))).toBe(true)
      expect(Color.isColor(Calc.of(1))).toBe(false)
      expect(Color.isColor(null)).toBe(false)
    })

    test('a color is not a calc', () => {
      expect(Calc.isCalc(Color.oklch(1, 0, 0))).toBe(false)
    })
  })
})
