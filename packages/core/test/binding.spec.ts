import { describe, expect, expectTypeOf, test } from 'vitest'
import { Calc } from '#calc'
import { Length, type Unit } from '#data'

describe('binding', () => {
  describe('basic binding', () => {
    test("binding preserves a dimensioned tree's result and requirements", () => {
      const scaled = Calc.bind(Calc.multiply(Calc.var('t'), Length.vw(1)), { t: 2 })
      expectTypeOf(scaled).toEqualTypeOf<Calc.Calc<never, Unit.Vw, Unit.Vw>>()
      expect(Calc.serialize(scaled)).toBe('2vw')
      expect(Calc.solve(scaled, { units: { vw: 1280 / 100 } })).toBeCloseTo(25.6)
    })

    test('binds to constants', () => {
      const expr = Calc.multiply(2, Calc.var('x'))
      expect(Calc.solve(Calc.bind(expr, { x: 3 }))).toBe(6)
    })

    test('removes bound reference from required refs', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'))
      const bound = Calc.bind(expr, { x: 5 })
      expect(Calc.vars(bound)).toEqual(new Set(['y']))
      expect(Calc.solve(bound, { bindings: { y: 10 } })).toBe(15)
    })

    test('can bind multiple references by chaining', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'))
      const bound = Calc.bind(Calc.bind(expr, { x: 10 }), { y: 20 })
      expect(Calc.solve(bound)).toBe(30)
    })

    test('supports data-last application', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'))
      const bound = expr.pipe(Calc.bind({ x: 10 }), Calc.bind({ y: 20 }))
      expect(Calc.solve(bound)).toBe(30)
    })
  })

  describe('binding to expressions', () => {
    test('binds to other expressions', () => {
      const expr = Calc.add(Calc.var('x'), 5)
      const bound = Calc.bind(expr, { x: Calc.multiply(Calc.var('y'), 2) })
      expect(Calc.solve(bound, { bindings: { y: 3 } })).toBe(11)
    })

    test('merges references when binding to expressions', () => {
      const expr = Calc.add(Calc.var('a'), Calc.var('b'))
      const withE = Calc.bind(expr, { a: Calc.var('e') })
      expect(Calc.vars(withE)).toEqual(new Set(['b', 'e']))
      expect(Calc.solve(withE, { bindings: { b: 5, e: 10 } })).toBe(15)
    })

    test('adds new references when binding', () => {
      const bound = Calc.bind(Calc.var('x'), { x: Calc.add(Calc.var('a'), Calc.var('b')) })
      expect(Calc.solve(bound, { bindings: { a: 1, b: 2 } })).toBe(3)
    })
  })

  describe('nested binding', () => {
    test('handles deeply nested binding', () => {
      const expr = Calc.multiply(Calc.add(Calc.var('x'), 1), Calc.add(Calc.var('y'), 2))

      const step1 = Calc.bind(expr, { x: Calc.var('a') })
      const step2 = Calc.bind(step1, { y: Calc.var('b') })
      const step3 = Calc.bind(step2, { a: 3 })
      const step4 = Calc.bind(step3, { b: 4 })

      expect(Calc.solve(step4)).toBe(24)
    })

    test('binding triggers partial evaluation', () => {
      const expr = Calc.add(Calc.var('x'), Calc.multiply(2, 3))
      const css = Calc.serialize(expr)
      expect(css).toContain('6')
      expect(css).not.toContain('2 *')
    })
  })

  describe('binding with same reference used multiple times', () => {
    test('replaces all occurrences', () => {
      const x = Calc.var('x')
      const expr = Calc.add(x, Calc.multiply(x, 2))
      expect(Calc.solve(Calc.bind(expr, { x: 5 }))).toBe(15)
    })
  })

  describe('variadic binding', () => {
    test('binds within variadic add', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'), 5)
      const bound = Calc.bind(expr, { x: 1 })
      expect(Calc.solve(bound, { bindings: { y: 10 } })).toBe(16)
    })

    test('produces correct CSS after binding variadic add', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'), Calc.var('z'))
      const bound = Calc.bind(expr, { x: 10 })
      expect(Calc.serialize(bound)).toBe('calc(10 + var(--y) + var(--z))')
    })
  })

  describe('CSS output after binding', () => {
    test('produces correct CSS after binding', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'))
      const bound = Calc.bind(expr, { x: 10, y: Calc.var('runtime') })
      expect(Calc.serialize(bound)).toBe('calc(10 + var(--runtime))')
    })

    test('produces correct CSS when binding to expression', () => {
      const expr = Calc.add(Calc.var('x'), 5)
      const bound = Calc.bind(expr, { x: Calc.multiply(Calc.var('runtime'), 2) })
      expect(Calc.serialize(bound)).toBe('calc(var(--runtime) * 2 + 5)')
    })

    test('binding a reference to itself is an identity', () => {
      const expr = Calc.add(Calc.var('x'), 5)
      expect(Calc.serialize(Calc.bind(expr, { x: Calc.var('x') }))).toBe('calc(var(--x) + 5)')
    })
  })

  describe('record binding', () => {
    test('binds multiple values at once', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'))
      expect(Calc.solve(Calc.bind(expr, { x: 10, y: 20 }))).toBe(30)
    })

    test('removes all bound references from required refs', () => {
      const expr = Calc.add(Calc.add(Calc.var('a'), Calc.var('b')), Calc.var('c'))
      const bound = Calc.bind(expr, { a: 1, b: 2 })
      expect(Calc.vars(bound)).toEqual(new Set(['c']))
      expect(Calc.solve(bound, { bindings: { c: 3 } })).toBe(6)
    })

    test('binds to expressions and merges refs', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'))
      const bound = Calc.bind(expr, {
        x: Calc.multiply(Calc.var('a'), 2),
        y: Calc.var('b'),
      })
      expect(Calc.solve(bound, { bindings: { a: 3, b: 4 } })).toBe(10)
    })

    test('produces correct CSS', () => {
      const expr = Calc.add(Calc.multiply(Calc.var('x'), Calc.var('y')), Calc.var('z'))
      const bound = Calc.bind(expr, { x: 2, y: 3, z: Calc.var('runtime') })
      expect(Calc.serialize(bound)).toBe('calc(6 + var(--runtime))')
    })
  })

  describe('excess properties', () => {
    test('bind ignores excess properties', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'))
      const bound = Calc.bind(expr, { x: 10, y: 20, extra: 99 })
      expect(Calc.solve(bound)).toBe(30)
    })

    test('solve ignores excess properties', () => {
      const expr = Calc.multiply(Calc.var('a'), Calc.var('b'))
      // widened through a variable: fresh literals get excess-property checks
      const bindings = { a: 3, b: 7, extra: 999 }
      expect(Calc.solve(expr, { bindings })).toBe(21)
    })

    test('bind with object spread filters to relevant refs', () => {
      const data = { apexL: 0.6, apexC: 0.3, curvature: -0.1, unrelated: 42 }
      const expr = Calc.add(Calc.var('apexL'), Calc.var('apexC'))
      expect(Calc.solve(Calc.bind(expr, data))).toBeCloseTo(0.9)
    })

    test('solve with object spread filters to relevant refs', () => {
      const data = { x: 5, y: 10, z: 100 }
      const expr = Calc.add(Calc.var('x'), Calc.var('y'))
      expect(Calc.solve(expr, { bindings: data })).toBe(15)
    })

    test('partial bind with excess properties preserves remaining refs', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'), Calc.var('z'))
      const bound = Calc.bind(expr, { x: 1, extra: 99 })
      expect(Calc.solve(bound, { bindings: { y: 2, z: 3 } })).toBe(6)
    })

    test('undefined binding values are ignored', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'))
      const bound = Calc.bind(expr, { x: 1, y: undefined as unknown as number })
      expect(Calc.vars(bound)).toEqual(new Set(['y']))
    })
  })
})
