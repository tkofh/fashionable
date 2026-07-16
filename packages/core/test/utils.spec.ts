import { describe, expect, test } from 'vitest'
import { Calc } from '#calc'
import { dual, flow, invariant, pipe } from '#util'

describe('utils', () => {
  describe('pipe', () => {
    test('threads a value through functions left to right', () => {
      expect(
        pipe(
          1,
          (n: number) => n + 1,
          (n: number) => n * 2,
        ),
      ).toBe(4)
    })
  })

  describe('flow', () => {
    test('composes functions left to right', () => {
      const f = flow(
        (n: number) => n + 1,
        (n: number) => n * 2,
      )
      expect(f(1)).toBe(4)
    })
  })

  describe('dual', () => {
    const scaleBy = dual<
      (factor: number) => (value: number) => number,
      (value: number, factor: number) => number
    >(2, (value, factor) => value * factor)

    test('dispatches data-first at full arity', () => {
      expect(scaleBy(10, 2)).toBe(20)
    })

    test('dispatches data-last below arity', () => {
      expect(scaleBy(2)(10)).toBe(20)
    })

    test('throws for arity below 2', () => {
      expect(() => dual(1, (x: number) => x)).toThrow(RangeError)
    })
  })

  describe('Pipeable', () => {
    test('library values flow through data-last operations', () => {
      expect(Calc.add(Calc.var('x'), 1).pipe(Calc.bind({ x: 2 }), Calc.serialize)).toBe('3')
    })
  })

  describe('invariant', () => {
    test('passes on true conditions', () => {
      expect(() => invariant(true, 'nope')).not.toThrow()
    })

    test('throws the message on false conditions', () => {
      expect(() => invariant(false, 'nope')).toThrow('nope')
    })
  })
})
