import { describe, expect, test } from 'vitest'
import { Calc, Precision } from '#calc'

describe('precision', () => {
  describe('constructors', () => {
    test('decimals validates its range', () => {
      expect(() => Precision.decimals(-1)).toThrow('integer in [0, 100]')
      expect(() => Precision.decimals(2.5)).toThrow('integer in [0, 100]')
      expect(Precision.isPrecision(Precision.decimals(0))).toBe(true)
    })

    test('significant validates its range', () => {
      expect(() => Precision.significant(0)).toThrow('integer in [1, 100]')
      expect(Precision.isPrecision(Precision.significant(10))).toBe(true)
    })
  })

  describe('context default', () => {
    test('unannotated constants use five decimals', () => {
      expect(Calc.serialize(Calc.of(1 / 3))).toBe('0.33333')
    })

    test('the precision option overrides the context default', () => {
      expect(Calc.serialize(Calc.of(1 / 3), { precision: Precision.decimals(2) })).toBe('0.33')
      expect(Calc.serialize(Calc.of(2 / 3), { precision: Precision.significant(4) })).toBe('0.6667')
    })

    test('decimals(0) rounds to integers', () => {
      expect(Calc.serialize(Calc.of(3.7), { precision: Precision.decimals(0) })).toBe('4')
      expect(Calc.serialize(Calc.of(100), { precision: Precision.decimals(0) })).toBe('100')
    })
  })

  describe('per-constant annotation', () => {
    test('an annotated constant overrides the context', () => {
      const k = Calc.of(0.8377580409572781, Precision.significant(10))
      expect(Calc.serialize(Calc.multiply(k, Calc.var('t')))).toBe('calc(0.837758041 * var(--t))')
    })

    test('annotated and unannotated constants coexist in one expression', () => {
      const k = Calc.of(1 / 3, Precision.significant(10))
      const expr = Calc.add(Calc.multiply(k, Calc.var('t')), 2 / 3)
      expect(Calc.serialize(expr)).toBe('calc(0.3333333333 * var(--t) + 0.66667)')
    })

    test('significant mode renders small values as plain decimals', () => {
      const k = Calc.of(0.00001234567, Precision.significant(4))
      expect(Calc.serialize(k)).toBe('0.00001235')
    })

    test('negative zero normalizes to zero', () => {
      expect(Calc.serialize(Calc.of(-0.0000001))).toBe('0')
    })
  })

  describe('folding propagation', () => {
    test('folding keeps the highest-fidelity annotation', () => {
      const annotated = Calc.of(1.23456789, Precision.significant(9))
      const folded = Calc.add(annotated, Calc.of(1))
      expect(Calc.serialize(folded)).toBe('2.23456789')
    })

    test('significant outranks decimals', () => {
      const significant = Calc.of(0.1234567, Precision.significant(7))
      const decimals = Calc.of(0.1, Precision.decimals(2))
      expect(Calc.serialize(Calc.add(significant, decimals))).toBe('0.2234567')
    })

    test('more digits outrank fewer within a mode', () => {
      const coarse = Calc.of(0.111, Precision.decimals(1))
      const fine = Calc.of(0.111111, Precision.decimals(6))
      expect(Calc.serialize(Calc.add(coarse, fine))).toBe('0.222111')
    })

    test('unary folding preserves the annotation', () => {
      const annotated = Calc.of(-1.23456789, Precision.significant(9))
      expect(Calc.serialize(Calc.abs(annotated))).toBe('1.23456789')
    })
  })

  describe('equality interaction', () => {
    test('constants with different annotations are not equal', () => {
      expect(Calc.equals(Calc.of(1), Calc.of(1, Precision.decimals(2)))).toBe(false)
      expect(
        Calc.equals(Calc.of(1, Precision.decimals(2)), Calc.of(1, Precision.decimals(2))),
      ).toBe(true)
    })
  })
})
