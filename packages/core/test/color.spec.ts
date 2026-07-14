import { describe, expect, test } from 'vitest'
import { Calc } from '#calc'
import { Color } from '#color'

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

  describe('refs', () => {
    test('unions channel references', () => {
      const color = Color.oklch(Calc.ref('l'), Calc.ref('c'), Calc.ref('h'))
      expect(Color.refs(color)).toEqual(new Set(['l', 'c', 'h']))
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
