import { describe, expect, test } from 'vitest'
import { Calc, Precision } from '#calc'
import { Angle, Color, Length } from '#data'
import { PropertyRule, PropertySyntax } from '#property'

describe('property', () => {
  describe('PropertySyntax', () => {
    test('renders the universal syntax and each data type', () => {
      expect(PropertySyntax.render(PropertySyntax.universal)).toBe('*')
      expect(PropertySyntax.render(PropertySyntax.number)).toBe('<number>')
      expect(PropertySyntax.render(PropertySyntax.integer)).toBe('<integer>')
      expect(PropertySyntax.render(PropertySyntax.color)).toBe('<color>')
      expect(PropertySyntax.render(PropertySyntax.lengthPercentage)).toBe('<length-percentage>')
      expect(PropertySyntax.render(PropertySyntax.customIdent)).toBe('<custom-ident>')
      expect(PropertySyntax.render(PropertySyntax.transformFunction)).toBe('<transform-function>')
      expect(PropertySyntax.render(PropertySyntax.transformList)).toBe('<transform-list>')
    })

    test('renders keywords, combinations, and lists', () => {
      expect(PropertySyntax.render(PropertySyntax.keyword('auto'))).toBe('auto')
      expect(
        PropertySyntax.render(
          PropertySyntax.oneOf(PropertySyntax.length, PropertySyntax.keyword('auto')),
        ),
      ).toBe('<length> | auto')
      expect(PropertySyntax.render(PropertySyntax.listOf(PropertySyntax.number))).toBe('<number>+')
      expect(PropertySyntax.render(PropertySyntax.commaListOf(PropertySyntax.color))).toBe(
        '<color>#',
      )
      expect(
        PropertySyntax.render(
          PropertySyntax.oneOf(
            PropertySyntax.listOf(PropertySyntax.length),
            PropertySyntax.keyword('none'),
          ),
        ),
      ).toBe('<length>+ | none')
    })

    test('nested combinations flatten', () => {
      const nested = PropertySyntax.oneOf(
        PropertySyntax.keyword('a'),
        PropertySyntax.oneOf(PropertySyntax.keyword('b'), PropertySyntax.keyword('c')),
      )
      expect(PropertySyntax.render(nested)).toBe('a | b | c')
      expect(
        PropertySyntax.equals(
          nested,
          PropertySyntax.oneOf(
            PropertySyntax.keyword('a'),
            PropertySyntax.keyword('b'),
            PropertySyntax.keyword('c'),
          ),
        ),
      ).toBe(true)
    })

    test('keywords shorthands a keyword combination', () => {
      const set = PropertySyntax.keywords('small', 'medium', 'large')
      expect(PropertySyntax.render(set)).toBe('small | medium | large')
      expect(
        PropertySyntax.equals(
          set,
          PropertySyntax.oneOf(
            PropertySyntax.keyword('small'),
            PropertySyntax.keyword('medium'),
            PropertySyntax.keyword('large'),
          ),
        ),
      ).toBe(true)
    })

    test('a single keywords name is just the keyword', () => {
      expect(
        PropertySyntax.equals(PropertySyntax.keywords('auto'), PropertySyntax.keyword('auto')),
      ).toBe(true)
    })

    test('combination order participates in equality', () => {
      const a = PropertySyntax.oneOf(PropertySyntax.keyword('a'), PropertySyntax.keyword('b'))
      const b = PropertySyntax.oneOf(PropertySyntax.keyword('b'), PropertySyntax.keyword('a'))
      expect(PropertySyntax.equals(a, b)).toBe(false)
      expect(
        PropertySyntax.equals(
          a,
          PropertySyntax.oneOf(PropertySyntax.keyword('a'), PropertySyntax.keyword('b')),
        ),
      ).toBe(true)
    })

    test('rejects invalid grammar', () => {
      expect(() => PropertySyntax.keyword('')).toThrow('non-empty')
      expect(() => PropertySyntax.keyword('initial')).toThrow('CSS-wide')
      expect(() => PropertySyntax.keywords('small', 'default')).toThrow('CSS-wide')
      expect(() => PropertySyntax.oneOf(PropertySyntax.universal, PropertySyntax.length)).toThrow(
        'stands alone',
      )
      expect(() => PropertySyntax.listOf(PropertySyntax.universal)).toThrow('cannot be multiplied')
      expect(() => PropertySyntax.listOf(PropertySyntax.listOf(PropertySyntax.number))).toThrow(
        'at most one multiplier',
      )
      expect(() =>
        PropertySyntax.commaListOf(
          PropertySyntax.oneOf(PropertySyntax.keyword('a'), PropertySyntax.keyword('b')),
        ),
      ).toThrow('single component')
      expect(() => PropertySyntax.listOf(PropertySyntax.transformList)).toThrow('pre-multiplied')
    })

    test('isPropertySyntax accepts syntaxes and rejects the rest', () => {
      expect(PropertySyntax.isPropertySyntax(PropertySyntax.number)).toBe(true)
      expect(PropertySyntax.isPropertySyntax(Calc.of(1))).toBe(false)
      expect(PropertySyntax.isPropertySyntax(null)).toBe(false)
    })
  })

  describe('PropertyRule', () => {
    test('renders a numeric registration', () => {
      const rule = PropertyRule.make('--depth', PropertySyntax.number, 0)
      expect(PropertyRule.render(rule)).toBe(
        "@property --depth {\n\tsyntax: '<number>';\n\tinherits: false;\n\tinitial-value: 0;\n}",
      )
    })

    test('rules register non-inheriting; inheritable opts in', () => {
      const rule = PropertyRule.make('--fill', PropertySyntax.color, 'red')
      expect(PropertyRule.render(rule)).toContain('inherits: false;')
      const inheriting = rule.pipe(PropertyRule.inheritable)
      expect(PropertyRule.render(inheriting)).toContain('inherits: true;')
      expect(PropertyRule.equals(rule, inheriting)).toBe(false)
      expect(PropertyRule.inheritable(inheriting)).toBe(inheriting)
    })

    test('renders literal text and color initial values', () => {
      const text = PropertyRule.make('--surface', PropertySyntax.color, 'transparent')
      expect(PropertyRule.render(text)).toContain('initial-value: transparent;')

      const color = PropertyRule.make('--accent', PropertySyntax.color, Color.oklch(0.7, 0.1, 250))
      expect(PropertyRule.render(color)).toContain('initial-value: oklch(0.7 0.1 250);')
    })

    test('renders a dimensioned expression initial value with its unit', () => {
      const gap = PropertyRule.make('--gap', PropertySyntax.length, Length.px(8))
      expect(PropertyRule.render(gap)).toContain('initial-value: 8px;')

      const spin = PropertyRule.make('--spin', PropertySyntax.angle, Angle.rad(1.5708))
      expect(PropertyRule.render(spin)).toContain('initial-value: 1.5708rad;')

      // a folded length expression renders its computed unit value
      const pad = PropertyRule.make(
        '--pad',
        PropertySyntax.length,
        Calc.add(Length.px(4), Length.px(4)),
      )
      expect(PropertyRule.render(pad)).toContain('initial-value: 8px;')
    })

    test('expression initial values honor the precision context', () => {
      const rule = PropertyRule.make('--third', PropertySyntax.number, Calc.of(1 / 3))
      expect(PropertyRule.render(rule)).toContain('initial-value: 0.33333;')
      expect(PropertyRule.render(rule, { precision: Precision.decimals(2) })).toContain(
        'initial-value: 0.33;',
      )
    })

    test('the syntax defaults to universal, where the initial value is optional', () => {
      const bare = PropertyRule.make('--anything')
      expect(PropertyRule.render(bare)).toBe(
        "@property --anything {\n\tsyntax: '*';\n\tinherits: false;\n}",
      )
      expect(
        PropertyRule.equals(bare, PropertyRule.make('--anything', PropertySyntax.universal)),
      ).toBe(true)
      const seeded = PropertyRule.make('--anything', PropertySyntax.universal, 'anything at all')
      expect(PropertyRule.render(seeded)).toContain('initial-value: anything at all;')
    })

    test('keyword sets render and narrow their initial values', () => {
      const rule = PropertyRule.make('--size', PropertySyntax.keywords('small', 'large'), 'small')
      expect(PropertyRule.render(rule.pipe(PropertyRule.inheritable))).toBe(
        "@property --size {\n\tsyntax: 'small | large';\n\tinherits: true;\n\tinitial-value: small;\n}",
      )
    })

    test('bare numbers coerce to constants', () => {
      expect(
        PropertyRule.equals(
          PropertyRule.make('--x', PropertySyntax.number, 1.5),
          PropertyRule.make('--x', PropertySyntax.number, Calc.of(1.5)),
        ),
      ).toBe(true)
    })

    test('rejects invalid registrations', () => {
      expect(() => PropertyRule.make('depth' as never)).toThrow('custom property name')
      expect(() => PropertyRule.make('--' as never)).toThrow('custom property name')
      expect(() =>
        // @ts-expect-error a non-universal syntax requires an initial value
        PropertyRule.make('--x', PropertySyntax.number),
      ).toThrow('universal syntax')
      expect(() =>
        PropertyRule.make(
          '--x',
          PropertySyntax.number,
          Calc.var('u') as unknown as Calc.Calc<never>,
        ),
      ).toThrow('computationally independent')
    })

    test('equality is structural, including the syntax and expression values', () => {
      const rule = PropertyRule.make('--depth', PropertySyntax.number, Calc.of(0))
      expect(
        PropertyRule.equals(rule, PropertyRule.make('--depth', PropertySyntax.number, Calc.of(0))),
      ).toBe(true)
      expect(rule).toStructurallyEqual(
        PropertyRule.make('--depth', PropertySyntax.number, Calc.of(0)),
      )
      expect(
        PropertyRule.equals(rule, PropertyRule.make('--depth', PropertySyntax.integer, Calc.of(0))),
      ).toBe(false)
      expect(
        PropertyRule.equals(rule, PropertyRule.make('--depth', PropertySyntax.number, 1)),
      ).toBe(false)
      expect(PropertyRule.equals(rule, rule.pipe(PropertyRule.inheritable))).toBe(false)
    })

    test('guards accept property rules and reject the rest', () => {
      const rule = PropertyRule.make('--x')
      expect(PropertyRule.isPropertyRule(rule)).toBe(true)
      expect(PropertyRule.isPropertyRule(PropertySyntax.universal)).toBe(false)
      expect(PropertyRule.isPropertyRule(null)).toBe(false)
    })
  })
})
