import { describe, expect, expectTypeOf, test } from 'vitest'
import { Calc } from '#calc'
import { Color } from '#color'
import { Declaration } from '#declaration'
import { FontFaceRule } from '#fontFace'
import { PropertyRule, PropertySyntax } from '#property'
import { MediaQuery } from '#query'
import { MediaRule, RuleSet, StyleRule } from '#rule'
import { Selector } from '#selector'
import { Stylesheet } from '#stylesheet'

// Compile-time assertions only — never invoked.
const rejectsNonMembers = (): void => {
  // @ts-expect-error a selector is not a rule-set member
  RuleSet.make(Selector.root)
  // @ts-expect-error a bare expression is not a rule-set member; wrap it in a declaration
  RuleSet.append(RuleSet.empty, Calc.of(1))
  const property = PropertyRule.make('--x')
  // @ts-expect-error a declaration-block at-rule cannot nest inside a block
  RuleSet.append(RuleSet.empty, property)
  const fontFace = FontFaceRule.make({ family: 'X', src: [FontFaceRule.local('Arial')] })
  // @ts-expect-error a declaration-block at-rule cannot nest inside a block
  RuleSet.make(fontFace)
}

// Compile-time assertions only — never invoked.
const rejectsNonNodes = (): void => {
  const declaration = Declaration.make('color', 'red')
  // @ts-expect-error a declaration cannot sit at the top level of a stylesheet
  Stylesheet.make(declaration)
  const media = MediaRule.make(MediaQuery.minWidth(768), RuleSet.make(declaration))
  // @ts-expect-error a media rule enters the model nested inside a style rule, not at the top level
  Stylesheet.append(Stylesheet.empty, media)
}

// Compile-time assertions only — never invoked.
const rejectsOpenInitialValues = (): void => {
  // @ts-expect-error an initial value must be computationally independent — Calc<'u'> is not Calc<never>
  PropertyRule.make('--depth', PropertySyntax.number, Calc.ref('u'))
  // @ts-expect-error an initial value must be computationally independent — Color<'l'> is not Color<never>
  PropertyRule.make('--accent', PropertySyntax.color, Color.oklch(Calc.ref('l'), 0.1, 250))
}

// Compile-time assertions only — never invoked.
const rejectsMismatchedInitialValues = (): void => {
  // @ts-expect-error a color does not satisfy the <number> syntax
  PropertyRule.make('--depth', PropertySyntax.number, Color.oklch(0.7, 0.1, 250))
  // @ts-expect-error <number> takes the typed forms — a number or closed Calc, not text
  PropertyRule.make('--depth', PropertySyntax.number, '0')
  // @ts-expect-error a length initial value is literal text carrying its unit — expressions serialize unitless
  PropertyRule.make('--gap', PropertySyntax.length, Calc.of(0))
  // @ts-expect-error 'medium' is not in the declared keyword set
  PropertyRule.make('--size', PropertySyntax.keywords('small', 'large'), 'medium')
}

describe('types', () => {
  test('ref infers its name', () => {
    expectTypeOf(Calc.ref('x')).toEqualTypeOf<Calc<'x'>>()
  })

  test('constants are closed', () => {
    expectTypeOf(Calc.of(1)).toEqualTypeOf<Calc<never>>()
    expectTypeOf(Calc.add(1, 2)).toEqualTypeOf<Calc<never>>()
  })

  test('combinators union refs', () => {
    expectTypeOf(Calc.add(Calc.ref('x'), Calc.ref('y'))).toEqualTypeOf<Calc<'x' | 'y'>>()
    expectTypeOf(Calc.add(Calc.ref('x'), 1)).toEqualTypeOf<Calc<'x'>>()
    expectTypeOf(Calc.clamp(0, Calc.ref('u'), 1)).toEqualTypeOf<Calc<'u'>>()
    expectTypeOf(Calc.lerp(Calc.ref('a'), Calc.ref('b'), Calc.ref('t'))).toEqualTypeOf<
      Calc<'a' | 'b' | 't'>
    >()
  })

  test('bind subtracts bound names', () => {
    const expr = Calc.add(Calc.ref('x'), Calc.ref('y'))
    expectTypeOf(Calc.bind(expr, { x: 1 })).toEqualTypeOf<Calc<'y'>>()
    expectTypeOf(Calc.bind(expr, { x: 1, y: 2 })).toEqualTypeOf<Calc<never>>()
  })

  test('binding to an expression adds its refs', () => {
    expectTypeOf(Calc.bind(Calc.ref('x'), { x: Calc.ref('a') })).toEqualTypeOf<Calc<'a'>>()
  })

  test('data-last bind composes through pipe', () => {
    const bound = Calc.ref('x').pipe(Calc.bind({ x: 2 }))
    expectTypeOf(bound).toEqualTypeOf<Calc<never>>()
  })

  test('solve requires a closed expression', () => {
    expect(() =>
      Calc.solve(
        // @ts-expect-error an expression with unbound references needs the bindings overload
        Calc.ref('x'),
      ),
    ).toThrow('unbound references remain')
  })

  test('color channels union refs', () => {
    expectTypeOf(Color.oklch(Calc.ref('l'), 0.1, Calc.ref('h'))).toEqualTypeOf<Color<'l' | 'h'>>()
  })

  test('color bind subtracts bound names', () => {
    const color = Color.oklch(Calc.ref('l'), Calc.ref('c'), 250)
    expectTypeOf(Color.bind(color, { l: 0.5 })).toEqualTypeOf<Color<'c'>>()
  })

  test('declarations carry their value refs', () => {
    expectTypeOf(Declaration.make('color', 'red')).toEqualTypeOf<Declaration<never>>()
    expectTypeOf(Declaration.make('--depth', 4)).toEqualTypeOf<Declaration<never>>()
    expectTypeOf(Declaration.make('--x', Calc.ref('u'))).toEqualTypeOf<Declaration<'u'>>()
    expectTypeOf(Declaration.make('color', Color.oklch(Calc.ref('l'), 0.1, 250))).toEqualTypeOf<
      Declaration<'l'>
    >()
  })

  test('declaration bind subtracts bound names', () => {
    const declaration = Declaration.make('--x', Calc.add(Calc.ref('u'), Calc.ref('v')))
    expectTypeOf(Declaration.bind(declaration, { u: 1 })).toEqualTypeOf<Declaration<'v'>>()
    expectTypeOf(declaration.pipe(Declaration.bind({ u: 1, v: 2 }))).toEqualTypeOf<
      Declaration<never>
    >()
  })

  test('rule containers union their members refs', () => {
    const set = RuleSet.make(
      Declaration.make('--a', Calc.ref('a')),
      StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--b', Calc.ref('b')))),
      MediaRule.make(
        MediaQuery.minWidth(768),
        RuleSet.make(Declaration.make('--c', Calc.ref('c'))),
      ),
    )
    expectTypeOf(set).toEqualTypeOf<RuleSet<'a' | 'b' | 'c'>>()
  })

  test('empty rule sets are closed', () => {
    expectTypeOf(RuleSet.empty).toEqualTypeOf<RuleSet<never>>()
    expectTypeOf(RuleSet.make()).toEqualTypeOf<RuleSet<never>>()
  })

  test('append and concat union refs', () => {
    const set = RuleSet.make(Declaration.make('--a', Calc.ref('a')))
    expectTypeOf(RuleSet.append(set, Declaration.make('--b', Calc.ref('b')))).toEqualTypeOf<
      RuleSet<'a' | 'b'>
    >()
    expectTypeOf(
      RuleSet.concat(set, RuleSet.make(Declaration.make('--c', Calc.ref('c')))),
    ).toEqualTypeOf<RuleSet<'a' | 'c'>>()
  })

  test('pair-form appends union the block refs', () => {
    const set = RuleSet.make(Declaration.make('--a', Calc.ref('a')))
    const block = RuleSet.make(Declaration.make('--b', Calc.ref('b')))
    expectTypeOf(RuleSet.append(set, Selector.class('btn'), block)).toEqualTypeOf<
      RuleSet<'a' | 'b'>
    >()
    expectTypeOf(RuleSet.append(set, MediaQuery.minWidth(768), block)).toEqualTypeOf<
      RuleSet<'a' | 'b'>
    >()
    expectTypeOf(set.pipe(RuleSet.append(MediaQuery.minWidth(768), block))).toEqualTypeOf<
      RuleSet<'a' | 'b'>
    >()
    const sheet = Stylesheet.make(
      StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--a', Calc.ref('a')))),
    )
    expectTypeOf(Stylesheet.append(sheet, Selector.class('btn'), block)).toEqualTypeOf<
      Stylesheet<'a' | 'b'>
    >()
  })

  test('stylesheets union their nodes refs', () => {
    const sheet = Stylesheet.make(
      StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--a', Calc.ref('a')))),
      StyleRule.make(Selector.class('btn'), RuleSet.make(Declaration.make('--b', Calc.ref('b')))),
      PropertyRule.make('--a', PropertySyntax.number, 0),
    )
    expectTypeOf(sheet).toEqualTypeOf<Stylesheet<'a' | 'b'>>()
  })

  test('empty stylesheets are closed', () => {
    expectTypeOf(Stylesheet.empty).toEqualTypeOf<Stylesheet<never>>()
    expectTypeOf(Stylesheet.make()).toEqualTypeOf<Stylesheet<never>>()
  })

  test('at-rule nodes contribute no refs', () => {
    const fontFace = FontFaceRule.make({ family: 'Inter', src: [FontFaceRule.local('Inter')] })
    const sheet = Stylesheet.make(fontFace, PropertyRule.make('--x'))
    expectTypeOf(sheet).toEqualTypeOf<Stylesheet<never>>()
  })

  test('append, merge, and mergeAll union refs', () => {
    const a = Stylesheet.make(
      StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--a', Calc.ref('a')))),
    )
    const b = Stylesheet.make(
      StyleRule.make(Selector.class('btn'), RuleSet.make(Declaration.make('--b', Calc.ref('b')))),
    )
    const appended = Stylesheet.append(
      a,
      StyleRule.make(Selector.class('card'), RuleSet.make(Declaration.make('--c', Calc.ref('c')))),
    )
    expectTypeOf(appended).toEqualTypeOf<Stylesheet<'a' | 'c'>>()
    expectTypeOf(Stylesheet.merge(a, b)).toEqualTypeOf<Stylesheet<'a' | 'b'>>()
    expectTypeOf(Stylesheet.mergeAll([a, b])).toEqualTypeOf<Stylesheet<'a' | 'b'>>()
  })

  test('non-members are rejected at compile time', () => {
    expect(rejectsNonMembers).toBeTypeOf('function')
  })

  test('non-nodes are rejected at compile time', () => {
    expect(rejectsNonNodes).toBeTypeOf('function')
  })

  test('open initial values are rejected at compile time', () => {
    expect(rejectsOpenInitialValues).toBeTypeOf('function')
  })

  test('initial values narrow to the declared syntax at compile time', () => {
    expect(rejectsMismatchedInitialValues).toBeTypeOf('function')
  })
})
