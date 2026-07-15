import { describe, expect, test } from 'vitest'
import { Calc } from '#calc'
import { Angle } from '#data'

describe('trig', () => {
  describe('solve', () => {
    test('cos matches Math.cos', () => {
      for (const x of [0, 0.5, 1, Math.PI / 3, Math.PI]) {
        expect(Calc.solve(Calc.cos(Calc.ref('x')), { x })).toBeCloseTo(Math.cos(x), 12)
      }
    })

    test('acos matches Math.acos', () => {
      for (const x of [-1, -0.5, 0, 0.5, 1]) {
        expect(Calc.solve(Calc.acos(Calc.ref('x')), { x })).toBeCloseTo(Math.acos(x), 12)
      }
    })

    test('the closed-form inverse sandwich solves numerically', () => {
      // cos(acos(u) / 3 - 2pi/3): the cardinal-segment inverse shape.
      const phaseValue = (2 * Math.PI) / 3
      const phase = Angle.rad(phaseValue)
      const expr = Calc.cos(
        Calc.subtract(Calc.divide(Calc.acos(Calc.clamp(-1, Calc.ref('u'), 1)), 3), phase),
      )
      for (const u of [-1, -0.25, 0, 0.6, 1]) {
        expect(Calc.solve(expr, { u })).toBeCloseTo(Math.cos(Math.acos(u) / 3 - phaseValue), 12)
      }
    })
  })

  describe('angle serialization', () => {
    test('an angle phase renders with its rad unit', () => {
      const expr = Calc.cos(
        Calc.subtract(Calc.divide(Calc.acos(Calc.ref('u')), 3), Angle.rad(2.0943951)),
      )
      expect(Calc.serialize(expr)).toBe('cos(acos(var(--u)) / 3 - 2.0944rad)')
    })

    test('the consumer inverse shape serializes with clamp intact', () => {
      const expr = Calc.cos(
        Calc.subtract(
          Calc.divide(Calc.acos(Calc.clamp(-1, Calc.ref('u'), 1)), 3),
          Angle.rad(2.0943951),
        ),
      )
      expect(Calc.serialize(expr)).toBe('cos(acos(clamp(-1, var(--u), 1)) / 3 - 2.0944rad)')
    })

    test('a negative angle constant renders subtractively', () => {
      const expr = Calc.add(Calc.acos(Calc.ref('u')), Angle.rad(-1.5))
      expect(Calc.serialize(expr)).toBe('calc(acos(var(--u)) - 1.5rad)')
    })

    test('scaling an angle by a number needs no conversion', () => {
      expect(Calc.serialize(Calc.multiply(Calc.acos(Calc.ref('u')), 2))).toBe(
        'calc(acos(var(--u)) * 2)',
      )
    })

    test('sums without an angle term are untouched', () => {
      expect(Calc.serialize(Calc.add(Calc.cos(Calc.ref('u')), 1))).toBe('calc(cos(var(--u)) + 1)')
    })
  })

  describe('duality', () => {
    test('binding the inverse shape folds it to the solved constant', () => {
      const expr = Calc.cos(
        Calc.subtract(
          Calc.divide(Calc.acos(Calc.clamp(-1, Calc.ref('u'), 1)), 3),
          Angle.rad((2 * Math.PI) / 3),
        ),
      )
      const solved = Calc.solve(expr, { u: 0.6 })
      const serialized = Calc.serialize(expr, { bindings: { u: 0.6 } })
      expect(Number(serialized)).toBeCloseTo(solved, 4)
    })
  })
})
