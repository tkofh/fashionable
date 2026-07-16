import { describe, expect, test } from 'vitest'
import { Calc } from '#calc'

describe('evaluation', () => {
  describe('constant evaluation', () => {
    test('evaluates constants to numbers', () => {
      expect(Calc.solve(Calc.of(42))).toBe(42)
    })

    test('evaluates negative constants', () => {
      expect(Calc.solve(Calc.of(-3.14))).toBeCloseTo(-3.14)
    })

    test('evaluates zero', () => {
      expect(Calc.solve(Calc.of(0))).toBe(0)
    })
  })

  describe('bound evaluation', () => {
    test('evaluates with all bindings constant', () => {
      expect(Calc.solve(Calc.add(Calc.var('x'), 5), { bindings: { x: 10 } })).toBe(15)
    })

    test('throws for non-constant bindings', () => {
      const expr = Calc.add(Calc.var('x'), 5)
      // the cast models an untyped caller: open expressions are rejected at the type level
      const runtime = Calc.var('runtime') as unknown as Calc.Calc<never>
      expect(() => Calc.solve(expr, { bindings: { x: runtime } })).toThrow(
        'unbound variables remain',
      )
    })

    test('evaluates multiple bindings', () => {
      expect(
        Calc.solve(Calc.add(Calc.var('x'), Calc.var('y')), { bindings: { x: 10, y: 20 } }),
      ).toBe(30)
    })
  })

  describe('complex expressions', () => {
    test('evaluates nested operations', () => {
      const x = Calc.var('x')
      const expr = Calc.multiply(Calc.add(x, 1), Calc.add(x, -1))
      expect(Calc.solve(expr, { bindings: { x: 5 } })).toBe(24)
    })

    test('evaluates pow expressions', () => {
      const expr = Calc.pow(Calc.add(Calc.pow(Calc.var('x'), 2), Calc.pow(Calc.var('y'), 2)), 0.5)
      expect(Calc.solve(expr, { bindings: { x: 3, y: 4 } })).toBeCloseTo(5)
    })

    test('evaluates deeply nested expressions', () => {
      const expr = Calc.multiply(
        Calc.add(Calc.multiply(2, 3), Calc.multiply(4, 5)),
        Calc.add(Calc.add(6, -2), -2),
      )
      expect(Calc.solve(expr)).toBe(52)
    })
  })

  describe('simplification', () => {
    test('folds constant addition', () => {
      expect(Calc.solve(Calc.add(2, 3))).toBe(5)
    })

    test('folds constant multiplication', () => {
      expect(Calc.solve(Calc.multiply(4, 5))).toBe(20)
    })

    test('simplifies nested constants', () => {
      expect(Calc.solve(Calc.add(Calc.multiply(2, 3), Calc.add(4, 5)))).toBe(15)
    })

    test('produces simplified CSS output', () => {
      const expr = Calc.add(Calc.multiply(2, 3), Calc.var('x'))
      const css = Calc.serialize(expr)
      expect(css).toContain('6')
      expect(css).not.toContain('2 *')
    })

    test('binding every reference collapses to a constant', () => {
      const expr = Calc.multiply(Calc.add(Calc.var('x'), 1), 2)
      const bound = Calc.bind(expr, { x: 4 })
      expect(Calc.serialize(bound)).toBe('10')
    })
  })
})
