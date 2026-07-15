import { describe, expect, test } from 'vitest'
import { Calc, Precision } from '#calc'
import { Color } from '#data'
import * as Equal from '#internal/equal'

describe('equal', () => {
  describe('Calc.equals', () => {
    test('separately built identical trees are equal', () => {
      const a = Calc.add(Calc.multiply(Calc.ref('x'), 2), 1)
      const b = Calc.add(Calc.multiply(Calc.ref('x'), 2), 1)
      expect(Calc.equals(a, b)).toBe(true)
      expect(a).toStructurallyEqual(b)
    })

    test('expression trees are ordered syntax', () => {
      expect(Calc.equals(Calc.add(Calc.ref('x'), 1), Calc.add(1, Calc.ref('x')))).toBe(false)
    })

    test('different operations are not equal', () => {
      expect(Calc.equals(Calc.min(Calc.ref('x'), 1), Calc.max(Calc.ref('x'), 1))).toBe(false)
    })

    test('precision annotations participate in equality', () => {
      expect(Calc.equals(Calc.of(1), Calc.of(1, Precision.decimals(5)))).toBe(false)
    })

    test('supports data-last application', () => {
      expect(Calc.of(1).pipe(Calc.equals(Calc.of(1)))).toBe(true)
    })
  })

  describe('hashing', () => {
    test('equal values hash equally', () => {
      const a = Calc.clamp(0, Calc.ref('u'), 1)
      const b = Calc.clamp(0, Calc.ref('u'), 1)
      expect(Equal.hash(a)).toBe(Equal.hash(b))
    })

    test('hashes are stable across calls (memoization)', () => {
      const expr = Calc.add(Calc.ref('x'), 1)
      expect(Equal.hash(expr)).toBe(Equal.hash(expr))
    })

    test('negative zero hashes like zero', () => {
      expect(Equal.hashNumber(-0)).toBe(Equal.hashNumber(0))
    })

    test('combine is order-sensitive', () => {
      expect(Equal.combine(1, 2)).not.toBe(Equal.combine(2, 1))
    })
  })

  describe('Color.equals', () => {
    test('separately built identical colors are equal', () => {
      const a = Color.oklch(Calc.ref('l'), 0.15, 220)
      const b = Color.oklch(Calc.ref('l'), 0.15, 220)
      expect(Color.equals(a, b)).toBe(true)
      expect(a).toStructurallyEqual(b)
    })

    test('different channels are not equal', () => {
      const a = Color.oklch(Calc.ref('l'), 0.15, 220)
      const b = Color.oklch(Calc.ref('l'), 0.15, 221)
      expect(Color.equals(a, b)).toBe(false)
    })

    test('a color never structurally equals a calc', () => {
      expect(Color.oklch(1, 0, 0)).not.toStructurallyEqual(Calc.of(1))
    })
  })
})
