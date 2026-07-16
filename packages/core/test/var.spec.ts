import { describe, expect, test } from 'vitest'
import { Calc } from '#calc'
import { Color, Length } from '#data'
import { Declaration } from '#declaration'
import { RuleSet } from '#rule'
import { Var } from '#var'

describe('Var', () => {
  describe('construction', () => {
    test('bare reads intern per name', () => {
      expect(Var.of('gap')).toBe(Var.of('gap'))
      expect(Var.of('gap')).not.toBe(Var.of('inset'))
    })

    test('the name accessor returns the bare name', () => {
      expect(Var.name(Var.of('gap'))).toBe('gap')
    })

    test('an empty name throws', () => {
      expect(() => Var.of('')).toThrow('non-empty')
    })

    test('isVar recognizes reads and nothing else', () => {
      expect(Var.isVar(Var.of('gap'))).toBe(true)
      expect(Var.isVar(Calc.var('gap'))).toBe(false)
      expect(Var.isVar('gap')).toBe(false)
    })

    test('fallback derives a new read and leaves the handle untouched', () => {
      const gap = Var.of('gap')
      const withFallback = gap.pipe(Var.fallback(8))
      expect(withFallback).not.toBe(gap)
      expect(Var.name(withFallback)).toBe('gap')
      expect(Var.of('gap')).toBe(gap)
    })

    test('an undefined fallback throws', () => {
      expect(() => Var.fallback(Var.of('gap'), undefined)).toThrow('undefined')
    })
  })

  describe('vars report', () => {
    test('a bare read reads its own name', () => {
      expect(Var.vars(Var.of('gap'))).toEqual(new Set(['gap']))
    })

    test('a fallback chain unions every name read', () => {
      const read = Var.of('x').pipe(Var.fallback(Var.of('y').pipe(Var.fallback(4))))
      expect(Var.vars(read)).toEqual(new Set(['x', 'y']))
    })

    test('an expression fallback contributes its vars', () => {
      const read = Var.of('x').pipe(Var.fallback(Calc.add(Calc.var('y'), 1)))
      expect(Var.vars(read)).toEqual(new Set(['x', 'y']))
    })
  })

  describe('equality', () => {
    test('bare reads of one name are equal; names differ, reads differ', () => {
      expect(Var.equals(Var.of('gap'), Var.of('gap'))).toBe(true)
      expect(Var.equals(Var.of('gap'), Var.of('inset'))).toBe(false)
    })

    test('a bare read never equals a fallback-carrying one', () => {
      expect(Var.equals(Var.of('gap'), Var.of('gap').pipe(Var.fallback(8)))).toBe(false)
    })

    test('fallbacks compare structurally', () => {
      const a = Var.of('gap').pipe(Var.fallback(Calc.add(Calc.var('u'), 1)))
      const b = Var.of('gap').pipe(Var.fallback(Calc.add(Calc.var('u'), 1)))
      expect(Var.equals(a, b)).toBe(true)
      expect(Var.equals(a, Var.of('gap').pipe(Var.fallback(8)))).toBe(false)
    })
  })

  describe('Calc.var lifts', () => {
    test('a bare read lifts to the interned expression', () => {
      expect(Calc.var(Var.of('x'))).toBe(Calc.var('x'))
    })

    test('numeric fallbacks render', () => {
      expect(Calc.serialize(Calc.var(Var.of('gap').pipe(Var.fallback(8))))).toBe('var(--gap, 8)')
    })

    test('an arithmetic fallback carries its own calc() wrapper', () => {
      const read = Var.of('gap').pipe(Var.fallback(Calc.add(Calc.var('u'), 2)))
      expect(Calc.serialize(Calc.var(read))).toBe('var(--gap, calc(var(--u) + 2))')
    })

    test('nested reads render as nested var()', () => {
      const read = Var.of('x').pipe(Var.fallback(Var.of('y').pipe(Var.fallback(4))))
      expect(Calc.serialize(Calc.var(read))).toBe('var(--x, var(--y, 4))')
    })

    test('the expression reads every name in the chain', () => {
      const expr = Calc.var(Var.of('x').pipe(Var.fallback(Calc.var('y'))))
      expect(Calc.vars(expr)).toEqual(new Set(['x', 'y']))
    })

    test('binding the read name replaces the whole read, fallback discarded', () => {
      const expr = Calc.var(Var.of('x').pipe(Var.fallback(Calc.var('y'))))
      expect(Calc.serialize(Calc.bind(expr, { x: 5 }))).toBe('5')
    })

    test('binding a fallback name substitutes inside the fallback', () => {
      const expr = Calc.var(Var.of('x').pipe(Var.fallback(Calc.var('y'))))
      expect(Calc.serialize(expr, { bindings: { y: 5 } })).toBe('var(--x, 5)')
    })

    test('solve requires a binding for every name, fallback names included', () => {
      const expr = Calc.var(Var.of('x').pipe(Var.fallback(Calc.var('y'))))
      expect(Calc.solve(expr, { bindings: { x: 2, y: 99 } })).toBe(2)
      // @ts-expect-error the fallback name is still required
      expect(() => Calc.solve(expr, { bindings: { x: 2 } })).toThrow('unbound variables remain')
    })

    test('units and idents reports exclude fallback contents', () => {
      const read = Var.of('gap').pipe(
        Var.fallback(Calc.multiply(Calc.var('u'), Calc.divide(Length.vw(8), Length.px(1)))),
      )
      const expr = Calc.var(read)
      expect(Calc.units(expr)).toEqual(new Set())
      expect(Calc.idents(expr)).toEqual(new Set())
    })

    test('structural equality covers fallbacks', () => {
      const a = Calc.var(Var.of('gap').pipe(Var.fallback(8)))
      const b = Calc.var(Var.of('gap').pipe(Var.fallback(8)))
      expect(Calc.equals(a, b)).toBe(true)
      expect(Calc.equals(a, Calc.var('gap'))).toBe(false)
    })

    test('a non-numeric fallback is rejected at runtime', () => {
      const read = Var.of('gap').pipe(Var.fallback(Color.named('red') as never))
      expect(() => Calc.var(read as never)).toThrow('number, a Calc expression, or a Var read')
    })
  })

  describe('Color.var lifts', () => {
    test('color fallbacks render, text coerced through named', () => {
      expect(Color.serialize(Color.var(Var.of('accent').pipe(Var.fallback('rebeccapurple'))))).toBe(
        'var(--accent, rebeccapurple)',
      )
      const read = Var.of('accent').pipe(Var.fallback(Color.oklch(0.7, 0.1, 250)))
      expect(Color.serialize(Color.var(read))).toBe('var(--accent, oklch(0.7 0.1 250))')
    })

    test('nested color reads render as nested var()', () => {
      const read = Var.of('a').pipe(Var.fallback(Var.of('b').pipe(Var.fallback('red'))))
      expect(Color.serialize(Color.var(read))).toBe('var(--a, var(--b, red))')
    })

    test('a CSS-wide keyword fallback is rejected by the named guard', () => {
      expect(() => Color.var(Var.of('accent').pipe(Var.fallback('inherit')))).toThrow(
        'CSS-wide keyword',
      )
    })

    test('the color reads every name in the chain', () => {
      const color = Color.var(Var.of('a').pipe(Var.fallback(Color.oklch(Calc.var('l'), 0.1, 30))))
      expect(Color.vars(color)).toEqual(new Set(['a', 'l']))
    })

    test('bind substitutes inside a fallback color channels', () => {
      const color = Color.var(Var.of('a').pipe(Var.fallback(Color.oklch(Calc.var('l'), 0.1, 30))))
      expect(Color.serialize(Color.bind(color, { l: 0.7 }))).toBe('var(--a, oklch(0.7 0.1 30))')
    })

    test('a non-color fallback is rejected at runtime', () => {
      const read = Var.of('accent').pipe(Var.fallback(Calc.of(4) as never))
      expect(() => Color.var(read as never)).toThrow('Color, color text, or a Var read')
    })
  })

  describe('declaration values', () => {
    test('a bare read is a whole declaration value', () => {
      expect(Declaration.render(Declaration.make('font-family', Var.of('stack')))).toBe(
        'font-family: var(--stack);',
      )
    })

    test('a text fallback renders verbatim', () => {
      const declaration = Declaration.make(
        'font-family',
        Var.of('stack').pipe(Var.fallback('sans-serif')),
      )
      expect(Declaration.render(declaration)).toBe('font-family: var(--stack, sans-serif);')
    })

    test('expression fallbacks render under the precision context', () => {
      const declaration = Declaration.make(
        '--indent',
        Var.of('indent').pipe(Var.fallback(Calc.multiply(Calc.var('depth'), 8))),
      )
      expect(Declaration.render(declaration)).toBe(
        '--indent: var(--indent, calc(var(--depth) * 8));',
      )
    })

    test('the declaration reports the read and its fallback chain', () => {
      const declaration = Declaration.make(
        'font-family',
        Var.of('stack').pipe(Var.fallback(Var.of('base'))),
      )
      expect(Declaration.vars(declaration)).toEqual(new Set(['stack', 'base']))
    })

    test('binding the read name replaces the whole value', () => {
      const declaration = Declaration.make('--x', Var.of('x').pipe(Var.fallback(4)))
      expect(Declaration.render(Declaration.bind(declaration, { x: 10 }))).toBe('--x: 10;')
    })

    test('binding a fallback name substitutes inside the fallback', () => {
      const declaration = Declaration.make(
        '--x',
        Var.of('x').pipe(Var.fallback(Calc.add(Calc.var('y'), 1))),
      )
      expect(Declaration.render(Declaration.bind(declaration, { y: 2 }))).toBe('--x: var(--x, 3);')
    })

    test('unrelated bindings return the same declaration', () => {
      const declaration = Declaration.make('--x', Var.of('x').pipe(Var.fallback(4)))
      expect(Declaration.bind(declaration, { unrelated: 1 })).toBe(declaration)
    })

    test('read-valued declarations compare structurally', () => {
      const a = Declaration.make('--x', Var.of('x').pipe(Var.fallback(4)))
      const b = Declaration.make('--x', Var.of('x').pipe(Var.fallback(4)))
      expect(Declaration.equals(a, b)).toBe(true)
      expect(Declaration.equals(a, Declaration.make('--x', Var.of('x')))).toBe(false)
    })

    test('containers report read names', () => {
      const set = RuleSet.make(
        Declaration.make('font-family', Var.of('stack').pipe(Var.fallback('sans-serif'))),
      )
      expect(RuleSet.vars(set)).toEqual(new Set(['stack']))
    })

    test('a fallback no declaration can hold is rejected at runtime', () => {
      const read = Var.of('x').pipe(Var.fallback({ bogus: true } as never))
      expect(() => Declaration.make('--x', read as never)).toThrow(
        'text, a number, an expression, or a Var read',
      )
    })
  })
})
