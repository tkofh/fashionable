import { describe, expect, expectTypeOf, test } from 'vitest'
import { Calc } from '#calc'
import {
  Angle,
  Channel,
  Color,
  ColorSpace,
  HueInterpolation,
  Length,
  Percentage,
  type Unit,
} from '#data'
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
  // @ts-expect-error an initial value must be computationally independent — Calc.Calc<'u'> is not Calc.Calc<never>
  PropertyRule.make('--depth', PropertySyntax.number, Calc.var('u'))
  // @ts-expect-error an initial value must be computationally independent — Color.Color<'l'> is not Color.Color<never>
  PropertyRule.make('--accent', PropertySyntax.color, Color.oklch(Calc.var('l'), 0.1, 250))
  // @ts-expect-error a color reference reads a custom property — Color.Color<'accent'> is not Color.Color<never>
  PropertyRule.make('--accent', PropertySyntax.color, Color.var('accent'))
  // @ts-expect-error a length reading a reference is not computationally independent
  PropertyRule.make('--gap', PropertySyntax.length, Calc.multiply(Length.px(10), Calc.var('scale')))
}

// Compile-time assertions only — never invoked.
const acceptsDimensionedInitialValues = (): void => {
  // a closed dimensioned Calc registers under its data-type syntax
  PropertyRule.make('--gap', PropertySyntax.length, Length.px(8))
  PropertyRule.make('--gap', PropertySyntax.length, Calc.add(Length.px(4), Length.px(4)))
  PropertyRule.make('--spin', PropertySyntax.angle, Angle.rad(1.5708))
  PropertyRule.make('--fill', PropertySyntax.percentage, Percentage.of(50))
  // and, as a <length-percentage>, either kind
  PropertyRule.make('--inset', PropertySyntax.lengthPercentage, Length.px(4))
  PropertyRule.make('--inset', PropertySyntax.lengthPercentage, Percentage.of(25))
  // literal text still works everywhere
  PropertyRule.make('--gap', PropertySyntax.length, '8px')
}

// Compile-time assertions only — never invoked.
const rejectsMismatchedInitialValues = (): void => {
  // @ts-expect-error a color does not satisfy the <number> syntax
  PropertyRule.make('--depth', PropertySyntax.number, Color.oklch(0.7, 0.1, 250))
  // @ts-expect-error <number> takes the typed forms — a number or closed Calc, not text
  PropertyRule.make('--depth', PropertySyntax.number, '0')
  // @ts-expect-error a <number> expression is not a <length> — the kinds differ
  PropertyRule.make('--gap', PropertySyntax.length, Calc.of(0))
  // @ts-expect-error a viewport-relative length is not computationally independent
  PropertyRule.make('--gap', PropertySyntax.length, Length.vw(8))
  // @ts-expect-error 'medium' is not in the declared keyword set
  PropertyRule.make('--size', PropertySyntax.keywords('small', 'large'), 'medium')
}

// Compile-time assertions only — never invoked.
const rejectsInvalidMixMethods = (): void => {
  const red = Color.named('red')
  const blue = Color.named('blue')
  // @ts-expect-error a hue strategy is only grammatical after a polar space
  Color.mix(ColorSpace.srgb, HueInterpolation.longer, red, blue)
  // @ts-expect-error an arm weight is a <percentage>, not a plain number-kind expression
  Color.mix(ColorSpace.oklch, [red, Calc.of(40)], blue)
  // @ts-expect-error an arm weight is a <percentage>, not a <length>
  Color.mix(ColorSpace.oklch, [red, Length.px(40)], blue)
}

// Compile-time assertions only — never invoked.
const rejectsCrossSpaceRelativeChannels = (): void => {
  const accent = Color.var('accent')
  // @ts-expect-error an srgb channel keyword is out of scope for an oklch relative color
  Color.from(accent, ColorSpace.oklch, Channel.R, Channel.C, Channel.H)
  // @ts-expect-error an oklch channel keyword is out of scope for an srgb relative color
  Color.from(accent, ColorSpace.srgb, Channel.L, Channel.G, Channel.B)
  // @ts-expect-error a channel keyword needs a value in the idents section
  Calc.solve(Calc.multiply(Channel.L, 0.8))
  // @ts-expect-error the idents section is required while a channel leaf is present
  Calc.solve(Calc.divide(2, Channel.L))
}

describe('types', () => {
  test('ref infers its name', () => {
    expectTypeOf(Calc.var('x')).toEqualTypeOf<Calc.Calc<'x'>>()
  })

  test('constants are closed', () => {
    expectTypeOf(Calc.of(1)).toEqualTypeOf<Calc.Calc<never>>()
    expectTypeOf(Calc.add(1, 2)).toEqualTypeOf<Calc.Calc<never>>()
  })

  test('combinators union refs', () => {
    expectTypeOf(Calc.add(Calc.var('x'), Calc.var('y'))).toEqualTypeOf<Calc.Calc<'x' | 'y'>>()
    expectTypeOf(Calc.add(Calc.var('x'), 1)).toEqualTypeOf<Calc.Calc<'x'>>()
    expectTypeOf(Calc.clamp(0, Calc.var('u'), 1)).toEqualTypeOf<Calc.Calc<'u'>>()
    expectTypeOf(Calc.lerp(Calc.var('a'), Calc.var('b'), Calc.var('t'))).toEqualTypeOf<
      Calc.Calc<'a' | 'b' | 't'>
    >()
  })

  test('bind subtracts bound names', () => {
    const expr = Calc.add(Calc.var('x'), Calc.var('y'))
    expectTypeOf(Calc.bind(expr, { x: 1 })).toEqualTypeOf<Calc.Calc<'y'>>()
    expectTypeOf(Calc.bind(expr, { x: 1, y: 2 })).toEqualTypeOf<Calc.Calc<never>>()
  })

  test('binding to an expression adds its refs', () => {
    expectTypeOf(Calc.bind(Calc.var('x'), { x: Calc.var('a') })).toEqualTypeOf<Calc.Calc<'a'>>()
  })

  test('data-last bind composes through pipe', () => {
    const bound = Calc.var('x').pipe(Calc.bind({ x: 2 }))
    expectTypeOf(bound).toEqualTypeOf<Calc.Calc<never>>()
  })

  test('solve requires a closed expression', () => {
    expect(() =>
      Calc.solve(
        // @ts-expect-error an expression with unbound variables needs the options overload
        Calc.var('x'),
      ),
    ).toThrow('unbound variables remain')
  })

  test('color channels union refs', () => {
    expectTypeOf(Color.oklch(Calc.var('l'), 0.1, Calc.var('h'))).toEqualTypeOf<
      Color.Color<'l' | 'h'>
    >()
  })

  test('color bind subtracts bound names', () => {
    const color = Color.oklch(Calc.var('l'), Calc.var('c'), 250)
    expectTypeOf(Color.bind(color, { l: 0.5 })).toEqualTypeOf<Color.Color<'c'>>()
  })

  test('color ref carries its name', () => {
    expectTypeOf(Color.var('accent')).toEqualTypeOf<Color.Color<'accent'>>()
  })

  test('relative color unions the origin and channel refs', () => {
    const color = Color.from(
      Color.var('accent'),
      ColorSpace.oklch,
      Calc.multiply(Channel.L, Calc.var('k')),
      Channel.C,
      Channel.H,
    )
    expectTypeOf(color).toEqualTypeOf<Color.Color<'accent' | 'k'>>()
  })

  test('relative alpha contributes its refs', () => {
    const color = Color.from(
      Color.var('x'),
      ColorSpace.srgb,
      Channel.R,
      Channel.G,
      Channel.B,
      Calc.multiply(Channel.Alpha, Calc.var('a')),
    )
    expectTypeOf(color).toEqualTypeOf<Color.Color<'x' | 'a'>>()
  })

  test('channel keywords carry their leaf brand', () => {
    expectTypeOf(Channel.L).toEqualTypeOf<Calc.Calc<never, Unit.None, Channel.ChannelIdent<'l'>>>()
  })

  test('a channel keyword is solvable with its value in the idents section', () => {
    expectTypeOf(
      Calc.solve(Calc.multiply(Channel.L, 0.8), { idents: { l: 0.5 } }),
    ).toEqualTypeOf<number>()
  })

  test('ident leaves survive the combinator algebra', () => {
    // pow and sign propagate leaves instead of rejecting leaf-carrying operands
    expectTypeOf(Calc.pow(Channel.L, 2.2)).toEqualTypeOf<
      Calc.Calc<never, Unit.None, Channel.ChannelIdent<'l'>>
    >()
    expectTypeOf(Calc.sign(Length.px(-4))).toEqualTypeOf<Calc.Calc<never, Unit.None, Unit.Px>>()
    // a number-result divisor's requirements survive division
    expectTypeOf(Calc.divide(2, Channel.L)).toEqualTypeOf<
      Calc.Calc<never, Unit.None, Channel.ChannelIdent<'l'>>
    >()
    // same-singleton cancellation never fires for idents — they are not constants
    expectTypeOf(Calc.divide(Calc.acos(Channel.L), Calc.acos(Channel.L))).toEqualTypeOf<
      Calc.Calc<never, Unit.None, Channel.ChannelIdent<'l'>>
    >()
    // lerp: t contributes requirements but never the result
    expectTypeOf(
      Calc.lerp(Length.px(0), Length.vw(8), Calc.multiply(Channel.L, 0.5)),
    ).toEqualTypeOf<
      Calc.Calc<never, Unit.Px | Unit.Vw, Unit.Px | Unit.Vw | Channel.ChannelIdent<'l'>>
    >()
  })

  test('color mix unions both arms and both percentage refs', () => {
    const color = Color.mix(
      ColorSpace.oklch,
      [Color.oklch(Calc.var('l'), 0.1, 250), Calc.multiply(Percentage.of(50), Calc.var('t'))],
      Color.srgb(Calc.var('r'), 0.2, 0.3),
    )
    expectTypeOf(color).toEqualTypeOf<Color.Color<'l' | 't' | 'r'>>()
  })

  test('mixing in a polar space takes a hue and unions arm refs', () => {
    const color = Color.mix(
      ColorSpace.oklch,
      HueInterpolation.longer,
      Color.var('a'),
      Color.var('b'),
    )
    expectTypeOf(color).toEqualTypeOf<Color.Color<'a' | 'b'>>()
  })

  test('declarations carry their value refs', () => {
    expectTypeOf(Declaration.make('color', 'red')).toEqualTypeOf<Declaration.Declaration<never>>()
    expectTypeOf(Declaration.make('--depth', 4)).toEqualTypeOf<Declaration.Declaration<never>>()
    expectTypeOf(Declaration.make('--x', Calc.var('u'))).toEqualTypeOf<
      Declaration.Declaration<'u'>
    >()
    expectTypeOf(Declaration.make('color', Color.oklch(Calc.var('l'), 0.1, 250))).toEqualTypeOf<
      Declaration.Declaration<'l'>
    >()
  })

  test('declaration bind subtracts bound names', () => {
    const declaration = Declaration.make('--x', Calc.add(Calc.var('u'), Calc.var('v')))
    expectTypeOf(Declaration.bind(declaration, { u: 1 })).toEqualTypeOf<
      Declaration.Declaration<'v'>
    >()
    expectTypeOf(declaration.pipe(Declaration.bind({ u: 1, v: 2 }))).toEqualTypeOf<
      Declaration.Declaration<never>
    >()
  })

  test('media query brands track known features through conjunction', () => {
    expectTypeOf(MediaQuery.minWidth(768)).toEqualTypeOf<
      MediaQuery.MediaQuery<MediaQuery.MinWidth>
    >()
    expectTypeOf(MediaQuery.maxWidth(1024)).toEqualTypeOf<
      MediaQuery.MediaQuery<MediaQuery.MaxWidth>
    >()
    expectTypeOf(MediaQuery.prefersColorScheme('dark')).toEqualTypeOf<
      MediaQuery.MediaQuery<MediaQuery.PrefersColorScheme>
    >()
    expectTypeOf(
      MediaQuery.and(MediaQuery.minWidth(768), MediaQuery.prefersColorScheme('dark')),
    ).toEqualTypeOf<MediaQuery.MediaQuery<MediaQuery.MinWidth & MediaQuery.PrefersColorScheme>>()
  })

  test('accessors are guaranteed exactly where the brand proves the feature', () => {
    expectTypeOf(MediaQuery.getMinWidth(MediaQuery.minWidth(768))).toEqualTypeOf<number>()
    expectTypeOf(MediaQuery.getMinWidth(MediaQuery.prefersColorScheme('dark'))).toEqualTypeOf<
      number | undefined
    >()
    expectTypeOf(MediaQuery.getMaxWidth(MediaQuery.maxWidth(1024))).toEqualTypeOf<number>()
    expectTypeOf(MediaQuery.getMaxWidth(MediaQuery.minWidth(768))).toEqualTypeOf<
      number | undefined
    >()
    expectTypeOf(
      MediaQuery.getPrefersColorScheme(MediaQuery.prefersColorScheme('dark')),
    ).toEqualTypeOf<'dark' | 'light'>()
    expectTypeOf(MediaQuery.getPrefersColorScheme(MediaQuery.minWidth(768))).toEqualTypeOf<
      'dark' | 'light' | undefined
    >()
    expectTypeOf(
      MediaQuery.minWidth(768).pipe(
        MediaQuery.and(MediaQuery.prefersColorScheme('dark')),
        MediaQuery.getMinWidth,
      ),
    ).toEqualTypeOf<number>()
  })

  test('feature guards narrow a plain query to the branded one', () => {
    const query: MediaQuery.MediaQuery = MediaQuery.minWidth(768)
    expectTypeOf(MediaQuery.getMinWidth(query)).toEqualTypeOf<number | undefined>()
    if (MediaQuery.hasMinWidth(query)) {
      expectTypeOf(MediaQuery.getMinWidth(query)).toEqualTypeOf<number>()
    }
  })

  test('rule containers union their members refs', () => {
    const set = RuleSet.make(
      Declaration.make('--a', Calc.var('a')),
      StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--b', Calc.var('b')))),
      MediaRule.make(
        MediaQuery.minWidth(768),
        RuleSet.make(Declaration.make('--c', Calc.var('c'))),
      ),
    )
    expectTypeOf(set).toEqualTypeOf<RuleSet.RuleSet<'a' | 'b' | 'c'>>()
  })

  test('empty rule sets are closed', () => {
    expectTypeOf(RuleSet.empty).toEqualTypeOf<RuleSet.RuleSet<never>>()
    expectTypeOf(RuleSet.make()).toEqualTypeOf<RuleSet.RuleSet<never>>()
  })

  test('append and concat union refs', () => {
    const set = RuleSet.make(Declaration.make('--a', Calc.var('a')))
    expectTypeOf(RuleSet.append(set, Declaration.make('--b', Calc.var('b')))).toEqualTypeOf<
      RuleSet.RuleSet<'a' | 'b'>
    >()
    expectTypeOf(
      RuleSet.concat(set, RuleSet.make(Declaration.make('--c', Calc.var('c')))),
    ).toEqualTypeOf<RuleSet.RuleSet<'a' | 'c'>>()
  })

  test('pair-form appends union the block refs', () => {
    const set = RuleSet.make(Declaration.make('--a', Calc.var('a')))
    const block = RuleSet.make(Declaration.make('--b', Calc.var('b')))
    expectTypeOf(RuleSet.append(set, Selector.class('btn'), block)).toEqualTypeOf<
      RuleSet.RuleSet<'a' | 'b'>
    >()
    expectTypeOf(RuleSet.append(set, MediaQuery.minWidth(768), block)).toEqualTypeOf<
      RuleSet.RuleSet<'a' | 'b'>
    >()
    expectTypeOf(set.pipe(RuleSet.append(MediaQuery.minWidth(768), block))).toEqualTypeOf<
      RuleSet.RuleSet<'a' | 'b'>
    >()
    const sheet = Stylesheet.make(
      StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--a', Calc.var('a')))),
    )
    expectTypeOf(Stylesheet.append(sheet, Selector.class('btn'), block)).toEqualTypeOf<
      Stylesheet.Stylesheet<'a' | 'b'>
    >()
  })

  test('forSelector and forMediaQuery thread the block refs', () => {
    const block = RuleSet.make(Declaration.make('--a', Calc.var('a')))
    expectTypeOf(RuleSet.forSelector(block, Selector.class('btn'))).toEqualTypeOf<
      StyleRule.StyleRule<'a'>
    >()
    expectTypeOf(block.pipe(RuleSet.forSelector(Selector.root))).toEqualTypeOf<
      StyleRule.StyleRule<'a'>
    >()
    expectTypeOf(RuleSet.forMediaQuery(block, MediaQuery.minWidth(768))).toEqualTypeOf<
      MediaRule.MediaRule<'a'>
    >()
    expectTypeOf(block.pipe(RuleSet.forMediaQuery(MediaQuery.minWidth(768)))).toEqualTypeOf<
      MediaRule.MediaRule<'a'>
    >()
  })

  test('stylesheets union their nodes refs', () => {
    const sheet = Stylesheet.make(
      StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--a', Calc.var('a')))),
      StyleRule.make(Selector.class('btn'), RuleSet.make(Declaration.make('--b', Calc.var('b')))),
      PropertyRule.make('--a', PropertySyntax.number, 0),
    )
    expectTypeOf(sheet).toEqualTypeOf<Stylesheet.Stylesheet<'a' | 'b'>>()
  })

  test('empty stylesheets are closed', () => {
    expectTypeOf(Stylesheet.empty).toEqualTypeOf<Stylesheet.Stylesheet<never>>()
    expectTypeOf(Stylesheet.make()).toEqualTypeOf<Stylesheet.Stylesheet<never>>()
  })

  test('at-rule nodes contribute no refs', () => {
    const fontFace = FontFaceRule.make({ family: 'Inter', src: [FontFaceRule.local('Inter')] })
    const sheet = Stylesheet.make(fontFace, PropertyRule.make('--x'))
    expectTypeOf(sheet).toEqualTypeOf<Stylesheet.Stylesheet<never>>()
  })

  test('append, merge, and mergeAll union refs', () => {
    const a = Stylesheet.make(
      StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--a', Calc.var('a')))),
    )
    const b = Stylesheet.make(
      StyleRule.make(Selector.class('btn'), RuleSet.make(Declaration.make('--b', Calc.var('b')))),
    )
    const appended = Stylesheet.append(
      a,
      StyleRule.make(Selector.class('card'), RuleSet.make(Declaration.make('--c', Calc.var('c')))),
    )
    expectTypeOf(appended).toEqualTypeOf<Stylesheet.Stylesheet<'a' | 'c'>>()
    expectTypeOf(Stylesheet.merge(a, b)).toEqualTypeOf<Stylesheet.Stylesheet<'a' | 'b'>>()
    expectTypeOf(Stylesheet.mergeAll([a, b])).toEqualTypeOf<Stylesheet.Stylesheet<'a' | 'b'>>()
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

  test('closed dimensioned initial values are accepted at compile time', () => {
    expect(acceptsDimensionedInitialValues).toBeTypeOf('function')
  })

  test('invalid color-mix methods and weights are rejected at compile time', () => {
    expect(rejectsInvalidMixMethods).toBeTypeOf('function')
  })

  test('cross-space channels and unresolved channel solves are rejected at compile time', () => {
    expect(rejectsCrossSpaceRelativeChannels).toBeTypeOf('function')
  })
})
