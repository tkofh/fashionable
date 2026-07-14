import { describe, expect, test } from 'vitest'
import { Calc } from '../src/calc/index.ts'

describe('binding', () => {
  describe('basic binding', () => {
    test('binds to constants', () => {
      const expr = Calc.multiply(2, Calc.ref('x'))
      expect(Calc.solve(Calc.bind(expr, { x: 3 }))).toBe(6)
    })

    test('removes bound reference from required refs', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'))
      const bound = Calc.bind(expr, { x: 5 })
      expect(Calc.refs(bound)).toEqual(new Set(['y']))
      expect(Calc.solve(bound, { y: 10 })).toBe(15)
    })

    test('can bind multiple references by chaining', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'))
      const bound = Calc.bind(Calc.bind(expr, { x: 10 }), { y: 20 })
      expect(Calc.solve(bound)).toBe(30)
    })

    test('supports data-last application', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'))
      const bound = expr.pipe(Calc.bind({ x: 10 }), Calc.bind({ y: 20 }))
      expect(Calc.solve(bound)).toBe(30)
    })
  })

  describe('binding to expressions', () => {
    test('binds to other expressions', () => {
      const expr = Calc.add(Calc.ref('x'), 5)
      const bound = Calc.bind(expr, { x: Calc.multiply(Calc.ref('y'), 2) })
      expect(Calc.solve(bound, { y: 3 })).toBe(11)
    })

    test('merges references when binding to expressions', () => {
      const expr = Calc.add(Calc.ref('a'), Calc.ref('b'))
      const withE = Calc.bind(expr, { a: Calc.ref('e') })
      expect(Calc.refs(withE)).toEqual(new Set(['b', 'e']))
      expect(Calc.solve(withE, { b: 5, e: 10 })).toBe(15)
    })

    test('adds new references when binding', () => {
      const bound = Calc.bind(Calc.ref('x'), { x: Calc.add(Calc.ref('a'), Calc.ref('b')) })
      expect(Calc.solve(bound, { a: 1, b: 2 })).toBe(3)
    })
  })

  describe('nested binding', () => {
    test('handles deeply nested binding', () => {
      const expr = Calc.multiply(Calc.add(Calc.ref('x'), 1), Calc.add(Calc.ref('y'), 2))

      const step1 = Calc.bind(expr, { x: Calc.ref('a') })
      const step2 = Calc.bind(step1, { y: Calc.ref('b') })
      const step3 = Calc.bind(step2, { a: 3 })
      const step4 = Calc.bind(step3, { b: 4 })

      expect(Calc.solve(step4)).toBe(24)
    })

    test('binding triggers partial evaluation', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.multiply(2, 3))
      const css = Calc.serialize(expr)
      expect(css).toContain('6')
      expect(css).not.toContain('2 *')
    })
  })

  describe('binding with same reference used multiple times', () => {
    test('replaces all occurrences', () => {
      const x = Calc.ref('x')
      const expr = Calc.add(x, Calc.multiply(x, 2))
      expect(Calc.solve(Calc.bind(expr, { x: 5 }))).toBe(15)
    })
  })

  describe('variadic binding', () => {
    test('binds within variadic add', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'), 5)
      const bound = Calc.bind(expr, { x: 1 })
      expect(Calc.solve(bound, { y: 10 })).toBe(16)
    })

    test('produces correct CSS after binding variadic add', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'), Calc.ref('z'))
      const bound = Calc.bind(expr, { x: 10 })
      expect(Calc.serialize(bound)).toBe('calc(10 + var(--y) + var(--z))')
    })
  })

  describe('CSS output after binding', () => {
    test('produces correct CSS after binding', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'))
      const bound = Calc.bind(expr, { x: 10, y: Calc.ref('runtime') })
      expect(Calc.serialize(bound)).toBe('calc(10 + var(--runtime))')
    })

    test('produces correct CSS when binding to expression', () => {
      const expr = Calc.add(Calc.ref('x'), 5)
      const bound = Calc.bind(expr, { x: Calc.multiply(Calc.ref('runtime'), 2) })
      expect(Calc.serialize(bound)).toBe('calc(var(--runtime) * 2 + 5)')
    })

    test('binding a reference to itself is an identity', () => {
      const expr = Calc.add(Calc.ref('x'), 5)
      expect(Calc.serialize(Calc.bind(expr, { x: Calc.ref('x') }))).toBe('calc(var(--x) + 5)')
    })
  })

  describe('record binding', () => {
    test('binds multiple values at once', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'))
      expect(Calc.solve(Calc.bind(expr, { x: 10, y: 20 }))).toBe(30)
    })

    test('removes all bound references from required refs', () => {
      const expr = Calc.add(Calc.add(Calc.ref('a'), Calc.ref('b')), Calc.ref('c'))
      const bound = Calc.bind(expr, { a: 1, b: 2 })
      expect(Calc.refs(bound)).toEqual(new Set(['c']))
      expect(Calc.solve(bound, { c: 3 })).toBe(6)
    })

    test('binds to expressions and merges refs', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'))
      const bound = Calc.bind(expr, {
        x: Calc.multiply(Calc.ref('a'), 2),
        y: Calc.ref('b'),
      })
      expect(Calc.solve(bound, { a: 3, b: 4 })).toBe(10)
    })

    test('produces correct CSS', () => {
      const expr = Calc.add(Calc.multiply(Calc.ref('x'), Calc.ref('y')), Calc.ref('z'))
      const bound = Calc.bind(expr, { x: 2, y: 3, z: Calc.ref('runtime') })
      expect(Calc.serialize(bound)).toBe('calc(6 + var(--runtime))')
    })
  })

  describe('excess properties', () => {
    test('bind ignores excess properties', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'))
      const bound = Calc.bind(expr, { x: 10, y: 20, extra: 99 })
      expect(Calc.solve(bound)).toBe(30)
    })

    test('solve ignores excess properties', () => {
      const expr = Calc.multiply(Calc.ref('a'), Calc.ref('b'))
      expect(Calc.solve(expr, { a: 3, b: 7, extra: 999 })).toBe(21)
    })

    test('bind with object spread filters to relevant refs', () => {
      const data = { apexL: 0.6, apexC: 0.3, curvature: -0.1, unrelated: 42 }
      const expr = Calc.add(Calc.ref('apexL'), Calc.ref('apexC'))
      expect(Calc.solve(Calc.bind(expr, data))).toBeCloseTo(0.9)
    })

    test('solve with object spread filters to relevant refs', () => {
      const data = { x: 5, y: 10, z: 100 }
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'))
      expect(Calc.solve(expr, data)).toBe(15)
    })

    test('partial bind with excess properties preserves remaining refs', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'), Calc.ref('z'))
      const bound = Calc.bind(expr, { x: 1, extra: 99 })
      expect(Calc.solve(bound, { y: 2, z: 3 })).toBe(6)
    })

    test('undefined binding values are ignored', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'))
      const bound = Calc.bind(expr, { x: 1, y: undefined as unknown as number })
      expect(Calc.refs(bound)).toEqual(new Set(['y']))
    })
  })
})
