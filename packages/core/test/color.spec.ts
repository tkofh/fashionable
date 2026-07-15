import { describe, expect, test } from 'vitest'
import { Calc } from '#calc'
import { Color, Keyword } from '#data'

describe('color', () => {
  describe('oklch', () => {
    test('serializes constant channels', () => {
      expect(Color.serialize(Color.oklch(0.7, 0.15, 220))).toBe('oklch(0.7 0.15 220)')
    })

    test('serializes reference channels as var()', () => {
      expect(Color.serialize(Color.oklch(Calc.ref('l'), 0.15, 220))).toBe(
        'oklch(var(--l) 0.15 220)',
      )
    })

    test('wraps arithmetic channels in calc()', () => {
      const color = Color.oklch(Calc.add(Calc.ref('l'), 0.1), 0.04, 250)
      expect(Color.serialize(color)).toBe('oklch(calc(var(--l) + 0.1) 0.04 250)')
    })

    test('leaves function-form channels unwrapped', () => {
      const color = Color.oklch(Calc.clamp(0, Calc.ref('l'), 1), 0.04, 250)
      expect(Color.serialize(color)).toBe('oklch(clamp(0, var(--l), 1) 0.04 250)')
    })

    test('each channel wraps independently', () => {
      const color = Color.oklch(
        Calc.add(Calc.ref('l'), 0.1),
        Calc.ref('c'),
        Calc.multiply(Calc.ref('h'), 2),
      )
      expect(Color.serialize(color)).toBe('oklch(calc(var(--l) + 0.1) var(--c) calc(var(--h) * 2))')
    })
  })

  describe('srgb', () => {
    test('serializes the consumer shape byte-exact', () => {
      expect(Color.serialize(Color.srgb(0.18, 0.34, 0.78))).toBe('color(srgb 0.18 0.34 0.78)')
    })

    test('serializes reference channels as var()', () => {
      expect(Color.serialize(Color.srgb(Calc.ref('r'), 0.34, 0.78))).toBe(
        'color(srgb var(--r) 0.34 0.78)',
      )
    })

    test('wraps arithmetic channels in calc()', () => {
      const color = Color.srgb(Calc.multiply(Calc.ref('r'), 0.5), 0.34, 0.78)
      expect(Color.serialize(color)).toBe('color(srgb calc(var(--r) * 0.5) 0.34 0.78)')
    })

    test('binds through channels', () => {
      const color = Color.srgb(Calc.ref('r'), Calc.ref('g'), 0.78)
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
        Color.oklch(Calc.ref('l'), 0.1, 250),
        Color.srgb(Calc.ref('r'), 0.2, 0.3),
      )
      expect(Color.refs(color)).toEqual(new Set(['l', 'r']))
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

  describe('none channels', () => {
    test('oklch renders the achromatic consumer shape byte-exact', () => {
      expect(Color.serialize(Color.oklch(0, 0, Keyword.none))).toBe('oklch(0 0 none)')
    })

    test('srgb channels accept none', () => {
      expect(Color.serialize(Color.srgb(Keyword.none, 0.5, 1))).toBe('color(srgb none 0.5 1)')
    })

    test('none contributes no references and passes through bind', () => {
      const color = Color.oklch(Calc.ref('l'), 0, Keyword.none)
      expect(Color.refs(color)).toEqual(new Set(['l']))
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
      expect(Color.refs(Color.transparent)).toEqual(new Set())
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
      const color = Color.oklch(Calc.ref('l'), Calc.ref('c'), Calc.ref('h'))
      expect(Color.refs(color)).toEqual(new Set(['l', 'c', 'h']))
    })

    test('srgb unions channel references likewise', () => {
      const color = Color.srgb(Calc.ref('r'), Calc.ref('g'), Calc.ref('b'))
      expect(Color.refs(color)).toEqual(new Set(['r', 'g', 'b']))
    })

    test('constant channels contribute no references', () => {
      expect(Color.refs(Color.oklch(0.7, 0.15, 220))).toEqual(new Set())
    })
  })

  describe('bind', () => {
    test('binds channel references', () => {
      const color = Color.oklch(Calc.add(Calc.ref('l'), 0.1), 0.04, 250)
      const bound = Color.bind(color, { l: 0.5 })
      expect(Color.refs(bound)).toEqual(new Set())
      expect(Color.serialize(bound)).toBe('oklch(0.6 0.04 250)')
    })

    test('supports data-last application', () => {
      const color = Color.oklch(Calc.ref('l'), 0.04, 250)
      expect(Color.serialize(color.pipe(Color.bind({ l: 0.5 })))).toBe('oklch(0.5 0.04 250)')
    })

    test('serialize applies partial bindings', () => {
      const color = Color.oklch(Calc.ref('l'), Calc.ref('c'), 250)
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
