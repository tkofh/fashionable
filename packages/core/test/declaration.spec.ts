import { describe, expect, test } from 'vitest'
import { Calc, Precision } from '#calc'
import { Color } from '#data'
import { Declaration } from '#declaration'

describe('declaration', () => {
  describe('construction', () => {
    test('exposes name and value', () => {
      const declaration = Declaration.make('color', 'red')
      expect(declaration.name).toBe('color')
      expect(declaration.value).toBe('red')
    })

    test('bare numbers coerce to unannotated constants', () => {
      const declaration = Declaration.make('--depth', 4)
      expect(Calc.isCalc(declaration.value)).toBe(true)
      expect(Declaration.equals(declaration, Declaration.make('--depth', Calc.of(4)))).toBe(true)
    })

    test('rejects empty names', () => {
      expect(() => Declaration.make('', 'red')).toThrow('non-empty')
    })
  })

  describe('refs', () => {
    test('literal text carries no refs', () => {
      expect(Declaration.vars(Declaration.make('color', 'red'))).toEqual(new Set())
    })

    test('calc values expose their refs', () => {
      const declaration = Declaration.make('--fluid', Calc.add(Calc.var('base'), Calc.var('step')))
      expect(Declaration.vars(declaration)).toEqual(new Set(['base', 'step']))
    })

    test('color values expose their channel refs', () => {
      const declaration = Declaration.make('color', Color.oklch(Calc.var('l'), 0.1, 250))
      expect(Declaration.vars(declaration)).toEqual(new Set(['l']))
    })
  })

  describe('bind', () => {
    test('binds calc values, folding to constants when closed', () => {
      const declaration = Declaration.make('--fluid', Calc.add(Calc.var('base'), 2))
      const bound = Declaration.bind(declaration, { base: 14 })
      expect(Declaration.vars(bound)).toEqual(new Set())
      expect(Declaration.equals(bound, Declaration.make('--fluid', Calc.of(16)))).toBe(true)
    })

    test('binds color values', () => {
      const declaration = Declaration.make('color', Color.oklch(Calc.var('l'), 0.1, 250))
      const bound = Declaration.bind(declaration, { l: 0.7 })
      expect(Declaration.equals(bound, Declaration.make('color', Color.oklch(0.7, 0.1, 250)))).toBe(
        true,
      )
    })

    test('is identity on literal text', () => {
      const declaration = Declaration.make('color', 'red')
      expect(Declaration.bind(declaration, { anything: 1 })).toBe(declaration)
    })

    test('supports data-last binding through pipe', () => {
      const bound = Declaration.make('--x', Calc.var('u')).pipe(Declaration.bind({ u: 1 }))
      expect(Declaration.vars(bound)).toEqual(new Set())
    })
  })

  describe('equality', () => {
    test('name and value must both match', () => {
      const declaration = Declaration.make('color', 'red')
      expect(Declaration.equals(declaration, Declaration.make('color', 'red'))).toBe(true)
      expect(Declaration.equals(declaration, Declaration.make('background', 'red'))).toBe(false)
      expect(Declaration.equals(declaration, Declaration.make('color', 'blue'))).toBe(false)
    })

    test('expression values compare structurally', () => {
      const a = Declaration.make('--x', Calc.add(Calc.var('u'), 1))
      const b = Declaration.make('--x', Calc.add(Calc.var('u'), 1))
      expect(Declaration.equals(a, b)).toBe(true)
      expect(a).toStructurallyEqual(b)
    })

    test('literal text never equals an expression', () => {
      expect(
        Declaration.equals(Declaration.make('--x', '1'), Declaration.make('--x', Calc.of(1))),
      ).toBe(false)
    })

    test('precision annotations participate', () => {
      const annotated = Declaration.make('--k', Calc.of(0.5, Precision.significant(10)))
      const plain = Declaration.make('--k', Calc.of(0.5))
      expect(Declaration.equals(annotated, plain)).toBe(false)
    })

    test('supports data-last comparison', () => {
      const declaration = Declaration.make('color', 'red')
      expect(declaration.pipe(Declaration.equals(Declaration.make('color', 'red')))).toBe(true)
    })
  })

  describe('guards', () => {
    test('isDeclaration accepts declarations and rejects the rest', () => {
      expect(Declaration.isDeclaration(Declaration.make('color', 'red'))).toBe(true)
      expect(Declaration.isDeclaration(Calc.of(1))).toBe(false)
      expect(Declaration.isDeclaration(null)).toBe(false)
    })
  })
})
