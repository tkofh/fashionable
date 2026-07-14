import { describe, expect, test } from 'vitest'
import { Calc } from '../src/calc/index.ts'

describe('construction', () => {
  describe('of', () => {
    test('converts numbers to expressions', () => {
      expect(Calc.solve(Calc.of(42))).toBe(42)
    })

    test('converts pi', () => {
      expect(Calc.solve(Calc.of(Math.PI))).toBeCloseTo(Math.PI)
    })

    test('throws for non-finite numbers', () => {
      expect(() => Calc.of(Number.POSITIVE_INFINITY)).toThrow('finite')
      expect(() => Calc.of(Number.NaN)).toThrow('finite')
    })
  })

  describe('ref', () => {
    test('creates a reference expression', () => {
      expect(Calc.solve(Calc.ref('x'), { x: 5 })).toBe(5)
    })

    test('returns the same instance per name', () => {
      expect(Calc.ref('x')).toBe(Calc.ref('x'))
    })

    test('throws for empty string', () => {
      expect(() => Calc.ref('')).toThrow('non-empty')
    })
  })

  describe('guards', () => {
    test('isCalc accepts expressions and rejects the rest', () => {
      expect(Calc.isCalc(Calc.of(1))).toBe(true)
      expect(Calc.isCalc(Calc.ref('x'))).toBe(true)
      expect(Calc.isCalc(1)).toBe(false)
      expect(Calc.isCalc({})).toBe(false)
      expect(Calc.isCalc(null)).toBe(false)
    })
  })

  describe('binary operations', () => {
    test('creates add expression', () => {
      expect(Calc.solve(Calc.add(2, 3))).toBe(5)
    })

    test('creates subtract expression', () => {
      expect(Calc.solve(Calc.subtract(5, 3))).toBe(2)
    })

    test('creates multiply expression', () => {
      expect(Calc.solve(Calc.multiply(4, 3))).toBe(12)
    })

    test('creates divide expression', () => {
      expect(Calc.solve(Calc.divide(12, 4))).toBe(3)
    })

    test('creates pow expression', () => {
      expect(Calc.solve(Calc.pow(2, 3))).toBe(8)
    })

    test('creates signedPow expression', () => {
      expect(Calc.solve(Calc.signedPow(-8, 1 / 3))).toBeCloseTo(-2)
    })

    test('creates max expression', () => {
      expect(Calc.solve(Calc.max(5, 3))).toBe(5)
    })

    test('creates min expression', () => {
      expect(Calc.solve(Calc.min(5, 3))).toBe(3)
    })
  })

  describe('unary operations', () => {
    test('creates sin expression', () => {
      expect(Calc.solve(Calc.sin(0))).toBeCloseTo(0)
    })

    test('creates cos expression', () => {
      expect(Calc.solve(Calc.cos(0))).toBe(1)
    })

    test('creates acos expression', () => {
      expect(Calc.solve(Calc.acos(1))).toBe(0)
      expect(Calc.solve(Calc.acos(-1))).toBeCloseTo(Math.PI)
    })

    test('creates abs expression', () => {
      expect(Calc.solve(Calc.abs(-5))).toBe(5)
    })

    test('creates sign expression', () => {
      expect(Calc.solve(Calc.sign(-5))).toBe(-1)
    })
  })

  describe('clamp', () => {
    test('creates clamp expression', () => {
      expect(Calc.solve(Calc.clamp(0, 5, 10))).toBe(5)
    })

    test('clamps to minimum', () => {
      expect(Calc.solve(Calc.clamp(0, -5, 10))).toBe(0)
    })

    test('clamps to maximum', () => {
      expect(Calc.solve(Calc.clamp(0, 15, 10))).toBe(10)
    })
  })

  describe('lerp', () => {
    test('interpolates linearly', () => {
      expect(Calc.solve(Calc.lerp(0, 10, 0.5))).toBe(5)
      expect(Calc.solve(Calc.lerp(Calc.ref('a'), Calc.ref('b'), 0.25), { a: 0, b: 8 })).toBe(2)
    })
  })

  describe('variadic operations', () => {
    test('adds three constants', () => {
      expect(Calc.solve(Calc.add(1, 2, 3))).toBe(6)
    })

    test('adds four constants', () => {
      expect(Calc.solve(Calc.add(1, 2, 3, 4))).toBe(10)
    })

    test('finds max of three constants', () => {
      expect(Calc.solve(Calc.max(1, 5, 3))).toBe(5)
    })

    test('finds min of three constants', () => {
      expect(Calc.solve(Calc.min(5, 1, 3))).toBe(1)
    })

    test('adds three expressions with references', () => {
      const expr = Calc.add(Calc.ref('a'), Calc.ref('b'), Calc.ref('c'))
      expect(Calc.solve(expr, { a: 10, b: 20, c: 30 })).toBe(60)
    })

    test('finds max with references', () => {
      const expr = Calc.max(Calc.ref('x'), 0, Calc.ref('y'))
      expect(Calc.solve(expr, { x: -5, y: 3 })).toBe(3)
    })

    test('finds min with references', () => {
      const expr = Calc.min(Calc.ref('x'), 100, Calc.ref('y'))
      expect(Calc.solve(expr, { x: 50, y: 25 })).toBe(25)
    })
  })

  describe('reference merging', () => {
    test('merges references from operations', () => {
      const expr = Calc.add(Calc.ref('x'), Calc.ref('y'))
      expect(Calc.refs(expr)).toEqual(new Set(['x', 'y']))
      expect(Calc.solve(expr, { x: 1, y: 2 })).toBe(3)
    })

    test('deduplicates references', () => {
      const x = Calc.ref('x')
      const expr = Calc.add(x, x)
      expect(Calc.refs(expr)).toEqual(new Set(['x']))
      expect(Calc.solve(expr, { x: 5 })).toBe(10)
    })

    test('merges references from nested operations', () => {
      const expr = Calc.add(
        Calc.multiply(Calc.ref('a'), Calc.ref('b')),
        Calc.subtract(Calc.ref('c'), Calc.ref('d')),
      )
      expect(Calc.refs(expr)).toEqual(new Set(['a', 'b', 'c', 'd']))
      expect(Calc.solve(expr, { a: 2, b: 3, c: 10, d: 4 })).toBe(12)
    })
  })
})
