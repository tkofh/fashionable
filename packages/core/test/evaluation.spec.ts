import { describe, expect, test } from 'vitest'
import { Calc } from '../src/calc/index.ts'

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
      expect(Calc.solve(Calc.add(Calc.ref('x'), 5), { x: 10 })).toBe(15)
    })

    test('throws for non-constant bindings', () => {
      const expr = Calc.add(Calc.ref('x'), 5)
      expect(() => Calc.solve(expr, { x: Calc.ref('runtime') })).toThrow(
        'unbound references remain',
      )
    })

    test('evaluates multiple bindings', () => {
      expect(Calc.solve(Calc.add(Calc.ref('x'), Calc.ref('y')), { x: 10, y: 20 })).toBe(30)
    })
  })

  describe('complex expressions', () => {
    test('evaluates nested operations', () => {
      const x = Calc.ref('x')
      const expr = Calc.multiply(Calc.add(x, 1), Calc.add(x, -1))
      expect(Calc.solve(expr, { x: 5 })).toBe(24)
    })

    test('evaluates pow expressions', () => {
      const expr = Calc.pow(Calc.add(Calc.pow(Calc.ref('x'), 2), Calc.pow(Calc.ref('y'), 2)), 0.5)
      expect(Calc.solve(expr, { x: 3, y: 4 })).toBeCloseTo(5)
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
      const expr = Calc.add(Calc.multiply(2, 3), Calc.ref('x'))
      const css = Calc.serialize(expr)
      expect(css).toContain('6')
      expect(css).not.toContain('2 *')
    })

    test('binding every reference collapses to a constant', () => {
      const expr = Calc.multiply(Calc.add(Calc.ref('x'), 1), 2)
      const bound = Calc.bind(expr, { x: 4 })
      expect(Calc.serialize(bound)).toBe('10')
    })
  })
})
