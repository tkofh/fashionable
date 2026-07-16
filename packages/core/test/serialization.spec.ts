import { describe, expect, test } from 'vitest'
import { Calc } from '#calc'

describe('serialization', () => {
  describe('constants', () => {
    test('serializes integer constants', () => {
      expect(Calc.serialize(Calc.of(42))).toBe('42')
    })

    test('serializes decimal constants', () => {
      expect(Calc.serialize(Calc.of(1.5))).toBe('1.5')
    })

    test('formats numbers without trailing zeros', () => {
      expect(Calc.serialize(Calc.of(1.5))).toBe('1.5')
      expect(Calc.serialize(Calc.of(2.0))).toBe('2')
    })

    test('formats negative numbers', () => {
      expect(Calc.serialize(Calc.of(-42))).toBe('-42')
    })

    test('formats zero', () => {
      expect(Calc.serialize(Calc.of(0))).toBe('0')
    })

    test('rounds to five decimals by default', () => {
      expect(Calc.serialize(Calc.of(1 / 3))).toBe('0.33333')
    })
  })

  describe('pi', () => {
    test('a bare pi constant renders numerically (not inside a math function)', () => {
      expect(Calc.serialize(Calc.of(Math.PI))).toBe('3.14159')
    })

    test('pi renders as the CSS constant inside calc()', () => {
      expect(Calc.serialize(Calc.multiply(Math.PI, Calc.var('x')))).toBe('calc(pi * var(--x))')
    })

    test('pi renders as the CSS constant inside function forms', () => {
      expect(Calc.serialize(Calc.min(Math.PI, Calc.var('x')))).toBe('min(pi, var(--x))')
    })
  })

  describe('references', () => {
    test('serializes references as var()', () => {
      expect(Calc.serialize(Calc.var('x'))).toBe('var(--x)')
    })

    test('serializes multi-word references', () => {
      expect(Calc.serialize(Calc.var('my-variable'))).toBe('var(--my-variable)')
    })
  })

  describe('binary operations', () => {
    test('serializes addition', () => {
      expect(Calc.serialize(Calc.add(Calc.var('x'), 5))).toBe('calc(var(--x) + 5)')
    })

    test('serializes subtraction', () => {
      expect(Calc.serialize(Calc.subtract(Calc.var('x'), 5))).toBe('calc(var(--x) - 5)')
    })

    test('serializes multiplication', () => {
      expect(Calc.serialize(Calc.multiply(Calc.var('x'), 2))).toBe('calc(var(--x) * 2)')
    })

    test('serializes division', () => {
      expect(Calc.serialize(Calc.divide(Calc.var('x'), 2))).toBe('calc(var(--x) / 2)')
    })

    test('serializes power', () => {
      expect(Calc.serialize(Calc.pow(Calc.var('x'), 2))).toBe('pow(var(--x), 2)')
    })

    test('serializes signed power', () => {
      expect(Calc.serialize(Calc.signedPow(Calc.var('x'), 2))).toBe(
        'calc(pow(abs(var(--x)), 2) * sign(var(--x)))',
      )
    })

    test('serializes max', () => {
      expect(Calc.serialize(Calc.max(Calc.var('x'), 0))).toBe('max(var(--x), 0)')
    })

    test('serializes min', () => {
      expect(Calc.serialize(Calc.min(Calc.var('x'), 100))).toBe('min(var(--x), 100)')
    })
  })

  describe('sign normalization', () => {
    test('adding a negative constant renders subtractively', () => {
      expect(Calc.serialize(Calc.add(Calc.var('x'), -2))).toBe('calc(var(--x) - 2)')
    })

    test('adding a negative-coefficient product renders subtractively', () => {
      expect(Calc.serialize(Calc.add(Calc.var('x'), Calc.multiply(-2, Calc.var('y'))))).toBe(
        'calc(var(--x) - 2 * var(--y))',
      )
    })

    test('subtracting a negative constant renders additively', () => {
      expect(Calc.serialize(Calc.subtract(Calc.var('x'), -2))).toBe('calc(var(--x) + 2)')
    })

    test('subtracting a negative-coefficient quotient renders additively', () => {
      expect(Calc.serialize(Calc.subtract(Calc.var('x'), Calc.divide(-2, Calc.var('y'))))).toBe(
        'calc(var(--x) + 2 / var(--y))',
      )
    })
  })

  describe('variadic operations', () => {
    test('serializes variadic addition', () => {
      expect(Calc.serialize(Calc.add(Calc.var('x'), Calc.var('y'), 5))).toBe(
        'calc(var(--x) + var(--y) + 5)',
      )
    })

    test('serializes variadic max', () => {
      expect(Calc.serialize(Calc.max(Calc.var('x'), 0, Calc.var('y')))).toBe(
        'max(var(--x), 0, var(--y))',
      )
    })

    test('serializes variadic min', () => {
      expect(Calc.serialize(Calc.min(Calc.var('x'), 100, Calc.var('y')))).toBe(
        'min(var(--x), 100, var(--y))',
      )
    })

    test('parenthesizes variadic add inside multiply', () => {
      expect(
        Calc.serialize(Calc.multiply(Calc.add(Calc.var('a'), Calc.var('b'), Calc.var('c')), 2)),
      ).toBe('calc((var(--a) + var(--b) + var(--c)) * 2)')
    })
  })

  describe('unary operations', () => {
    test('serializes sin', () => {
      expect(Calc.serialize(Calc.sin(Calc.var('x')))).toBe('sin(var(--x))')
    })

    test('serializes cos', () => {
      expect(Calc.serialize(Calc.cos(Calc.var('x')))).toBe('cos(var(--x))')
    })

    test('serializes acos', () => {
      expect(Calc.serialize(Calc.acos(Calc.var('x')))).toBe('acos(var(--x))')
    })

    test('serializes abs', () => {
      expect(Calc.serialize(Calc.abs(Calc.var('x')))).toBe('abs(var(--x))')
    })

    test('serializes sign', () => {
      expect(Calc.serialize(Calc.sign(Calc.var('x')))).toBe('sign(var(--x))')
    })
  })

  describe('clamp', () => {
    test('serializes clamp', () => {
      expect(Calc.serialize(Calc.clamp(0, Calc.var('x'), 100))).toBe('clamp(0, var(--x), 100)')
    })
  })

  describe('serialize options', () => {
    test('applies partial bindings, leaving the rest as var()', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'))
      expect(Calc.serialize(expr, { bindings: { x: 10 } })).toBe('calc(10 + var(--y))')
    })

    test('binding everything renders the folded constant', () => {
      const expr = Calc.add(Calc.var('x'), Calc.var('y'))
      expect(Calc.serialize(expr, { bindings: { x: 10, y: 4 } })).toBe('14')
    })
  })

  describe('parenthesization', () => {
    test('does not add parens around function arguments', () => {
      expect(Calc.serialize(Calc.sin(Calc.add(Calc.var('x'), 1)))).toBe('sin(var(--x) + 1)')
    })

    test('adds parens to add/subtract when used in multiply', () => {
      expect(
        Calc.serialize(Calc.multiply(Calc.add(Calc.var('a'), Calc.var('b')), Calc.var('c'))),
      ).toBe('calc((var(--a) + var(--b)) * var(--c))')
    })

    test('adds parens to subtract when used in divide', () => {
      expect(
        Calc.serialize(Calc.divide(Calc.subtract(Calc.var('a'), Calc.var('b')), Calc.var('c'))),
      ).toBe('calc((var(--a) - var(--b)) / var(--c))')
    })

    test('does not add parens to multiply when used in add', () => {
      expect(
        Calc.serialize(Calc.add(Calc.multiply(Calc.var('a'), Calc.var('b')), Calc.var('c'))),
      ).toBe('calc(var(--a) * var(--b) + var(--c))')
    })

    test('handles deeply nested expressions', () => {
      expect(
        Calc.serialize(
          Calc.multiply(
            Calc.add(Calc.var('a'), Calc.var('b')),
            Calc.subtract(Calc.var('c'), Calc.var('d')),
          ),
        ),
      ).toBe('calc((var(--a) + var(--b)) * (var(--c) - var(--d)))')
    })
  })

  describe('complex expressions', () => {
    test('serializes quadratic formula components', () => {
      expect(Calc.serialize(Calc.multiply(Calc.var('a'), Calc.pow(Calc.var('x'), 2)))).toBe(
        'calc(var(--a) * pow(var(--x), 2))',
      )
    })

    test('serializes distance formula', () => {
      expect(
        Calc.serialize(
          Calc.pow(Calc.add(Calc.pow(Calc.var('x'), 2), Calc.pow(Calc.var('y'), 2)), 0.5),
        ),
      ).toBe('pow(pow(var(--x), 2) + pow(var(--y), 2), 0.5)')
    })
  })
})
