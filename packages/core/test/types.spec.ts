import { describe, expect, expectTypeOf, test } from 'vitest'
import { Calc } from '#calc'
import {
  Angle,
  Channel,
  Color,
  ColorSpace,
  HueInterpolation,
  Length,
  LengthPercentage,
  type Numeric,
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
import { Var } from '#var'

// Compile-time assertions only — never invoked.
const rejectsDeclaredTypeMismatches = (): void => {
  const gap = Var.length('gap')
  const accent = Var.color('accent')
  // @ts-expect-error a color-declared read lifts with Color.var
  Calc.var(accent)
  // @ts-expect-error a calc-declared read lifts with Calc.var
  Color.var(gap)
  // @ts-expect-error a bare-number fallback fits only a number-result read
  Calc.var(Var.fallback(gap, 8))
  // @ts-expect-error a number-family fallback under a length-declared read
  Calc.var(Var.fallback(gap, Calc.of(4)))
  // @ts-expect-error an undeclared nested read is number-result, not length
  Calc.var(Var.fallback(gap, Var.of('other')))
  // the family-true forms hold
  Calc.var(Var.fallback(gap, Length.px(8)))
  Calc.var(Var.fallback(gap, Var.length('other')))
  Color.var(Var.fallback(accent, Color.named('red')))
}

// Compile-time assertions only — never invoked.
const rejectsMistypedBindings = (): void => {
  const gapExpr = Calc.var(Var.length('gap'))
  // @ts-expect-error a bare number where a length is declared
  Calc.bind(gapExpr, { gap: 10 })
  // @ts-expect-error a percentage where a length is declared
  Calc.bind(gapExpr, { gap: Percentage.of(50) })
  // the declared family holds, relative units included (bind threads requirements)
  Calc.bind(gapExpr, { gap: Length.px(8) })
  Calc.bind(gapExpr, { gap: Length.vw(2) })
  // @ts-expect-error solve bindings are pre-satisfied: vw needs a ratio SolveOptions cannot demand
  Calc.solve(gapExpr, { bindings: { gap: Length.vw(2) } })
  Calc.solve(gapExpr, { bindings: { gap: Length.px(8) } })
}

// Compile-time assertions only — never invoked.
const rejectsMistypedRegistrationsAndWrites = (): void => {
  const gap = Var.length('gap')
  const accent = Var.color('accent')
  // @ts-expect-error a length-declared handle takes a length initial value, not a number
  PropertyRule.make(gap, 0)
  // @ts-expect-error a length initial value must be computationally independent (absolute units)
  PropertyRule.make(gap, Length.vw(8))
  // @ts-expect-error a declared handle derives its syntax; universal registration is for undeclared handles
  PropertyRule.make(gap)
  PropertyRule.make(gap, Length.px(8))
  PropertyRule.make(accent, 'transparent')
  PropertyRule.make(Var.of('u'))
  PropertyRule.make(Var.of('u'), PropertySyntax.number, 0)
  // @ts-expect-error a length-declared handle writes length-family values
  Declaration.make(gap, 5)
  // @ts-expect-error a color is not a length-family value
  Declaration.make(gap, Color.named('red'))
  Declaration.make(gap, Length.px(8))
  Declaration.make(gap, '8px')
  const inset = Var.lengthPercentage('inset')
  PropertyRule.make(inset, Length.px(4))
  PropertyRule.make(inset, Percentage.of(25))
  // @ts-expect-error a number is neither a length nor a percentage
  PropertyRule.make(inset, 0)
  Declaration.make(
    inset,
    Calc.subtract(LengthPercentage.of(Percentage.of(100)), Calc.var(Var.lengthPercentage('pad'))),
  )
  // @ts-expect-error a bare number is not a <length-percentage> write
  Declaration.make(inset, 4)
  // an unanchored px + % sum stays a cross-family type error
  // @ts-expect-error the first operand fixes the family: a percentage cannot join a length
  Calc.add(Length.px(4), Percentage.of(50))
  Declaration.make(accent, Color.named('red'))
  Declaration.make(Var.of('u'), 'anything at all')
}

// Compile-time assertions only — never invoked.
const rejectsWorldMismatchedFallbacks = (): void => {
  // @ts-expect-error a color fallback cannot lift into calc
  Calc.var(Var.fallback(Var.of('accent'), Color.named('red')))
  // @ts-expect-error a dimensioned fallback under an undeclared (number-result) read
  Calc.var(Var.fallback(Var.of('gap'), Length.px(8)))
  // @ts-expect-error a calc fallback cannot lift into color
  Color.var(Var.fallback(Var.of('accent'), Calc.of(4)))
  // @ts-expect-error a number fallback is not a color
  Color.var(Var.fallback(Var.of('accent'), 4))
}

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
  // @ts-expect-error a declaration-bearing media rule needs a host selector — only rules-only media sits at the top level
  Stylesheet.append(Stylesheet.empty, media)
}

// Compile-time assertions only — never invoked.
const gatesTopLevelMedia = (): void => {
  const closedRule = StyleRule.make(
    Selector.class('a'),
    RuleSet.make(Declaration.make('color', 'red')),
  )
  const mixed = MediaRule.make(
    MediaQuery.minWidth(768),
    RuleSet.make(closedRule, Declaration.make('color', 'red')),
  )
  // @ts-expect-error a bare declaration puts Parent in the media block's requirements
  Stylesheet.make(mixed)
  const unbound = MediaRule.make(
    MediaQuery.minWidth(768),
    RuleSet.make(
      StyleRule.make(
        Selector.and(Selector.nest, Selector.pseudoClass('hover')),
        RuleSet.make(Declaration.make('color', 'red')),
      ),
    ),
  )
  // @ts-expect-error an &-selector rule inside keeps the media rule nested-only
  Stylesheet.make(unbound)
  const nested = StyleRule.make(
    Selector.and(Selector.nest, Selector.pseudoClass('hover')),
    RuleSet.make(Declaration.make('color', 'red')),
  )
  // @ts-expect-error an &-selector rule cannot sit at the top level — nothing binds the reference
  Stylesheet.make(nested)
}

// Compile-time assertions only — never invoked.
const gatesUnboundNestingSelectors = (): void => {
  const nested = Selector.and(Selector.nest, Selector.pseudoClass('hover'))
  // @ts-expect-error an &-bearing selector takes its specificity from the parent — resolve it with under first
  Selector.specificity(nested)
  // @ts-expect-error nothing above a stylesheet binds & — the pair form rejects Parent-requiring selectors
  Stylesheet.append(Stylesheet.empty, nested, RuleSet.make(Declaration.make('color', 'red')))
  // Resolving against a parent discharges the requirement.
  Selector.specificity(Selector.under(nested, Selector.class('btn')))
}

// Compile-time assertions only — never invoked.
const rejectsOpenInitialValues = (): void => {
  // @ts-expect-error an initial value must be computationally independent — Calc.Calc<Var.Var<'u'>> is not Calc.Calc<never>
  PropertyRule.make('--depth', PropertySyntax.number, Calc.var('u'))
  // @ts-expect-error an initial value must be computationally independent — Color.Color<Var.Var<'l'>> is not Color.Color<never>
  PropertyRule.make('--accent', PropertySyntax.color, Color.oklch(Calc.var('l'), 0.1, 250))
  // @ts-expect-error a color reference reads a custom property — Color.Color<Var.Var<'accent'>> is not Color.Color<never>
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
    expectTypeOf(Calc.var('x')).toEqualTypeOf<Calc.Calc<Var.Var<'x'>>>()
  })

  test('lifting a bare read matches the name sugar', () => {
    expectTypeOf(Calc.var(Var.of('x'))).toEqualTypeOf<Calc.Calc<Var.Var<'x'>>>()
    expectTypeOf(Color.var(Var.of('accent'))).toEqualTypeOf<Color.Color<Var.Var<'accent'>>>()
  })

  test('fallback chains flatten into the phantom as identities', () => {
    const read = Var.fallback(Var.of('x'), Calc.var('y'))
    expectTypeOf(Calc.var(read)).toEqualTypeOf<Calc.Calc<Var.Var<'x'> | Var.Var<'y'>>>()
    const nested = Var.fallback(Var.of('a'), Var.fallback(Var.of('b'), 4))
    expectTypeOf(Calc.var(nested)).toEqualTypeOf<Calc.Calc<Var.Var<'a'> | Var.Var<'b'>>>()
  })

  test('vars reports names, not identities', () => {
    const expr = Calc.add(Calc.var('x'), Calc.var('y'))
    expectTypeOf(Calc.vars(expr)).toEqualTypeOf<ReadonlySet<'x' | 'y'>>()
  })

  test('a read as a declaration value carries its names', () => {
    const declaration = Declaration.make(
      'font-family',
      Var.fallback(Var.of('stack'), Var.of('base')),
    )
    expectTypeOf(declaration).toEqualTypeOf<
      Declaration.Declaration<Var.Var<'stack'> | Var.Var<'base'>>
    >()
  })

  test('typed constructors put the data type in the slot', () => {
    expectTypeOf(Var.number('t')).toEqualTypeOf<Var.Var<'t', Numeric.Numeric>>()
    expectTypeOf(Var.length('gap')).toEqualTypeOf<Var.Var<'gap', Length.Length>>()
    expectTypeOf(Var.angle('sweep')).toEqualTypeOf<Var.Var<'sweep', Angle.Angle>>()
    expectTypeOf(Var.percentage('basis')).toEqualTypeOf<Var.Var<'basis', Percentage.Percentage>>()
    expectTypeOf(Var.color('accent')).toEqualTypeOf<Var.Var<'accent', Color.Color>>()
  })

  test('a declared read lifts with its family as the Result', () => {
    const gap = Var.length('gap')
    expectTypeOf(Calc.var(gap)).toEqualTypeOf<
      Calc.Calc<Var.Var<'gap', Length.Length>, Unit.Length, never>
    >()
    expectTypeOf(Calc.add(Calc.var(gap), Length.px(4))).toEqualTypeOf<
      Calc.Calc<Var.Var<'gap', Length.Length>, Unit.Length, Unit.Px>
    >()
    expectTypeOf(Calc.var(Var.number('t'))).toEqualTypeOf<
      Calc.Calc<Var.Var<'t', Numeric.Numeric>, Unit.None, never>
    >()
  })

  test('binding a relative unit threads its requirement through bind', () => {
    const bound = Calc.bind(Calc.var(Var.length('gap')), { gap: Length.vw(2) })
    expectTypeOf(bound).toEqualTypeOf<Calc.Calc<never, Unit.Length, Unit.Vw>>()
  })

  test('a declared write threads the value reads', () => {
    const declaration = Declaration.make(
      Var.length('gap'),
      Calc.add(Calc.var(Var.length('inset')), Length.px(4)),
    )
    expectTypeOf(declaration).toEqualTypeOf<
      Declaration.Declaration<Var.Var<'inset', Length.Length>>
    >()
  })

  test('a length-percentage anchor admits both families', () => {
    const inset = Var.lengthPercentage('inset')
    expectTypeOf(Calc.var(inset)).toEqualTypeOf<
      Calc.Calc<
        Var.Var<'inset', LengthPercentage.LengthPercentage>,
        Unit.Length | Unit.Percentage,
        never
      >
    >()
    expectTypeOf(Calc.subtract(Calc.var(inset), Length.px(24))).toEqualTypeOf<
      Calc.Calc<
        Var.Var<'inset', LengthPercentage.LengthPercentage>,
        Unit.Length | Unit.Percentage,
        Unit.Px
      >
    >()
    expectTypeOf(Calc.add(Calc.var(inset), Percentage.of(10), Length.px(4))).toEqualTypeOf<
      Calc.Calc<
        Var.Var<'inset', LengthPercentage.LengthPercentage>,
        Unit.Length | Unit.Percentage,
        Unit.Percent | Unit.Px
      >
    >()
  })

  test('widening anchors mixing without a read', () => {
    const mixed = Calc.subtract(LengthPercentage.of(Percentage.of(100)), Length.px(24))
    expectTypeOf(mixed).toEqualTypeOf<
      Calc.Calc<never, Unit.Length | Unit.Percentage, Unit.Percent | Unit.Px>
    >()
  })

  test('typed reads flow anywhere the untyped handle is expected', () => {
    const typed = {} as Var.Var<'gap', Unit.Length>
    expectTypeOf(typed).toMatchTypeOf<Var.Var<'gap'>>()
    const lifted = {} as Calc.Calc<Var.Var<'gap', Unit.Length>>
    expectTypeOf(lifted).toMatchTypeOf<Calc.Calc<Var.Var<'gap'>>>()
  })

  test('constants are closed', () => {
    expectTypeOf(Calc.of(1)).toEqualTypeOf<Calc.Calc<never>>()
    expectTypeOf(Calc.add(1, 2)).toEqualTypeOf<Calc.Calc<never>>()
  })

  test('combinators union refs', () => {
    expectTypeOf(Calc.add(Calc.var('x'), Calc.var('y'))).toEqualTypeOf<
      Calc.Calc<Var.Var<'x'> | Var.Var<'y'>>
    >()
    expectTypeOf(Calc.add(Calc.var('x'), 1)).toEqualTypeOf<Calc.Calc<Var.Var<'x'>>>()
    expectTypeOf(Calc.clamp(0, Calc.var('u'), 1)).toEqualTypeOf<Calc.Calc<Var.Var<'u'>>>()
    expectTypeOf(Calc.lerp(Calc.var('a'), Calc.var('b'), Calc.var('t'))).toEqualTypeOf<
      Calc.Calc<Var.Var<'a'> | Var.Var<'b'> | Var.Var<'t'>>
    >()
  })

  test('bind subtracts bound names', () => {
    const expr = Calc.add(Calc.var('x'), Calc.var('y'))
    expectTypeOf(Calc.bind(expr, { x: 1 })).toEqualTypeOf<Calc.Calc<Var.Var<'y'>>>()
    expectTypeOf(Calc.bind(expr, { x: 1, y: 2 })).toEqualTypeOf<Calc.Calc<never>>()
  })

  test('binding to an expression adds its refs', () => {
    expectTypeOf(Calc.bind(Calc.var('x'), { x: Calc.var('a') })).toEqualTypeOf<
      Calc.Calc<Var.Var<'a'>>
    >()
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
      Color.Color<Var.Var<'l'> | Var.Var<'h'>>
    >()
  })

  test('color bind subtracts bound names', () => {
    const color = Color.oklch(Calc.var('l'), Calc.var('c'), 250)
    expectTypeOf(Color.bind(color, { l: 0.5 })).toEqualTypeOf<Color.Color<Var.Var<'c'>>>()
  })

  test('color ref carries its name', () => {
    expectTypeOf(Color.var('accent')).toEqualTypeOf<Color.Color<Var.Var<'accent'>>>()
  })

  test('relative color unions the origin and channel refs', () => {
    const color = Color.from(
      Color.var('accent'),
      ColorSpace.oklch,
      Calc.multiply(Channel.L, Calc.var('k')),
      Channel.C,
      Channel.H,
    )
    expectTypeOf(color).toEqualTypeOf<Color.Color<Var.Var<'accent'> | Var.Var<'k'>>>()
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
    expectTypeOf(color).toEqualTypeOf<Color.Color<Var.Var<'x'> | Var.Var<'a'>>>()
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
    expectTypeOf(color).toEqualTypeOf<Color.Color<Var.Var<'l'> | Var.Var<'t'> | Var.Var<'r'>>>()
  })

  test('mixing in a polar space takes a hue and unions arm refs', () => {
    const color = Color.mix(
      ColorSpace.oklch,
      HueInterpolation.longer,
      Color.var('a'),
      Color.var('b'),
    )
    expectTypeOf(color).toEqualTypeOf<Color.Color<Var.Var<'a'> | Var.Var<'b'>>>()
  })

  test('declarations carry their value refs', () => {
    expectTypeOf(Declaration.make('color', 'red')).toEqualTypeOf<Declaration.Declaration<never>>()
    expectTypeOf(Declaration.make('--depth', 4)).toEqualTypeOf<Declaration.Declaration<never>>()
    expectTypeOf(Declaration.make('--x', Calc.var('u'))).toEqualTypeOf<
      Declaration.Declaration<Var.Var<'u'>>
    >()
    expectTypeOf(Declaration.make('color', Color.oklch(Calc.var('l'), 0.1, 250))).toEqualTypeOf<
      Declaration.Declaration<Var.Var<'l'>>
    >()
  })

  test('declaration bind subtracts bound names', () => {
    const declaration = Declaration.make('--x', Calc.add(Calc.var('u'), Calc.var('v')))
    expectTypeOf(Declaration.bind(declaration, { u: 1 })).toEqualTypeOf<
      Declaration.Declaration<Var.Var<'v'>>
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
    expectTypeOf(set).toEqualTypeOf<RuleSet.RuleSet<Var.Var<'a'> | Var.Var<'b'> | Var.Var<'c'>>>()
  })

  test('empty rule sets are closed on both channels', () => {
    expectTypeOf(RuleSet.empty).toEqualTypeOf<RuleSet.RuleSet<never, never>>()
    expectTypeOf(RuleSet.make()).toEqualTypeOf<RuleSet.RuleSet<never, never>>()
  })

  test('append and concat union refs', () => {
    const set = RuleSet.make(Declaration.make('--a', Calc.var('a')))
    expectTypeOf(RuleSet.append(set, Declaration.make('--b', Calc.var('b')))).toEqualTypeOf<
      RuleSet.RuleSet<Var.Var<'a'> | Var.Var<'b'>>
    >()
    expectTypeOf(
      RuleSet.concat(set, RuleSet.make(Declaration.make('--c', Calc.var('c')))),
    ).toEqualTypeOf<RuleSet.RuleSet<Var.Var<'a'> | Var.Var<'c'>>>()
  })

  test('pair-form appends union the block refs', () => {
    const set = RuleSet.make(Declaration.make('--a', Calc.var('a')))
    const block = RuleSet.make(Declaration.make('--b', Calc.var('b')))
    expectTypeOf(RuleSet.append(set, Selector.class('btn'), block)).toEqualTypeOf<
      RuleSet.RuleSet<Var.Var<'a'> | Var.Var<'b'>>
    >()
    expectTypeOf(RuleSet.append(set, MediaQuery.minWidth(768), block)).toEqualTypeOf<
      RuleSet.RuleSet<Var.Var<'a'> | Var.Var<'b'>>
    >()
    expectTypeOf(set.pipe(RuleSet.append(MediaQuery.minWidth(768), block))).toEqualTypeOf<
      RuleSet.RuleSet<Var.Var<'a'> | Var.Var<'b'>>
    >()
    const sheet = Stylesheet.make(
      StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--a', Calc.var('a')))),
    )
    expectTypeOf(Stylesheet.append(sheet, Selector.class('btn'), block)).toEqualTypeOf<
      Stylesheet.Stylesheet<Var.Var<'a'> | Var.Var<'b'>>
    >()
  })

  test('forSelector and forMediaQuery thread the block refs', () => {
    const block = RuleSet.make(Declaration.make('--a', Calc.var('a')))
    expectTypeOf(RuleSet.forSelector(block, Selector.class('btn'))).toEqualTypeOf<
      StyleRule.StyleRule<Var.Var<'a'>>
    >()
    expectTypeOf(block.pipe(RuleSet.forSelector(Selector.root))).toEqualTypeOf<
      StyleRule.StyleRule<Var.Var<'a'>>
    >()
    expectTypeOf(RuleSet.forMediaQuery(block, MediaQuery.minWidth(768))).toEqualTypeOf<
      MediaRule.MediaRule<Var.Var<'a'>>
    >()
    expectTypeOf(block.pipe(RuleSet.forMediaQuery(MediaQuery.minWidth(768)))).toEqualTypeOf<
      MediaRule.MediaRule<Var.Var<'a'>>
    >()
  })

  test('stylesheets union their nodes refs', () => {
    const sheet = Stylesheet.make(
      StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--a', Calc.var('a')))),
      StyleRule.make(Selector.class('btn'), RuleSet.make(Declaration.make('--b', Calc.var('b')))),
      PropertyRule.make('--a', PropertySyntax.number, 0),
    )
    expectTypeOf(sheet).toEqualTypeOf<Stylesheet.Stylesheet<Var.Var<'a'> | Var.Var<'b'>>>()
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
    expectTypeOf(appended).toEqualTypeOf<Stylesheet.Stylesheet<Var.Var<'a'> | Var.Var<'c'>>>()
    expectTypeOf(Stylesheet.merge(a, b)).toEqualTypeOf<
      Stylesheet.Stylesheet<Var.Var<'a'> | Var.Var<'b'>>
    >()
    expectTypeOf(Stylesheet.mergeAll([a, b])).toEqualTypeOf<
      Stylesheet.Stylesheet<Var.Var<'a'> | Var.Var<'b'>>
    >()
  })

  test('world-mismatched fallbacks are rejected at compile time', () => {
    expect(rejectsWorldMismatchedFallbacks).toBeTypeOf('function')
  })

  test('declared-type mismatches are rejected at compile time', () => {
    expect(rejectsDeclaredTypeMismatches).toBeTypeOf('function')
    expect(rejectsMistypedBindings).toBeTypeOf('function')
    expect(rejectsMistypedRegistrationsAndWrites).toBeTypeOf('function')
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

  test('unbound nesting selectors are rejected at compile time', () => {
    expect(gatesUnboundNestingSelectors).toBeTypeOf('function')
  })

  test('parent-needing nodes are rejected at the top level at compile time', () => {
    expect(gatesTopLevelMedia).toBeTypeOf('function')
  })

  test('the requirements channel flows through the containers', () => {
    // The containers are recursive types, which trips toEqualTypeOf's
    // deep comparison — extract the phantom and compare the brand alone.
    type RequiresOf<T> =
      T extends RuleSet.RuleSet<Var.Any, infer R>
        ? R
        : T extends StyleRule.StyleRule<Var.Any, infer R>
          ? R
          : T extends MediaRule.MediaRule<Var.Any, infer R>
            ? R
            : never

    const declarations = RuleSet.make(Declaration.make('color', 'red'))
    expectTypeOf<RequiresOf<typeof declarations>>().toEqualTypeOf<Selector.Parent>()

    const closedRule = StyleRule.make(Selector.class('a'), declarations)
    expectTypeOf<RequiresOf<typeof closedRule>>().toEqualTypeOf<never>()

    const nestedRule = StyleRule.make(
      Selector.and(Selector.nest, Selector.pseudoClass('hover')),
      declarations,
    )
    expectTypeOf<RequiresOf<typeof nestedRule>>().toEqualTypeOf<Selector.Parent>()

    const carrying = RuleSet.make(nestedRule)
    expectTypeOf<RequiresOf<typeof carrying>>().toEqualTypeOf<Selector.Parent>()

    const grouped = MediaRule.make(MediaQuery.minWidth(768), RuleSet.make(closedRule))
    expectTypeOf<RequiresOf<typeof grouped>>().toEqualTypeOf<never>()
    // A rules-only media rule is a node; the sheet accepts it at compile time.
    expect(Stylesheet.isStylesheet(Stylesheet.make(grouped))).toBe(true)
  })

  test('selector requirements accumulate and discharge', () => {
    expectTypeOf(Selector.nest).toEqualTypeOf<Selector.Selector<Selector.Parent>>()
    expectTypeOf(Selector.class('a')).toEqualTypeOf<Selector.Selector>()
    expectTypeOf(Selector.and(Selector.nest, Selector.class('a'))).toEqualTypeOf<
      Selector.Selector<Selector.Parent>
    >()
    expectTypeOf(
      Selector.is(Selector.nest, Selector.descendant(Selector.nest, Selector.universal)),
    ).toEqualTypeOf<Selector.Selector<Selector.Parent>>()
    expectTypeOf(Selector.is(Selector.class('a'), Selector.class('b'))).toEqualTypeOf<
      Selector.Selector<never>
    >()
    expectTypeOf(
      Selector.under(Selector.and(Selector.nest, Selector.class('a')), Selector.class('b')),
    ).toEqualTypeOf<Selector.Selector<never>>()
  })
})
