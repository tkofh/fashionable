import { describe, expect, expectTypeOf, test } from 'vitest'
import { Calc, Precision } from '#calc'
import { Angle, Length, Percentage, type Unit } from '#data'

describe('data — construction and serialization', () => {
  test('lengths serialize value + unit', () => {
    expect(Calc.serialize(Length.px(16))).toBe('16px')
    expect(Calc.serialize(Length.rem(1.5))).toBe('1.5rem')
    expect(Calc.serialize(Length.vw(100))).toBe('100vw')
  })

  test('angles serialize in radians', () => {
    expect(Calc.serialize(Angle.rad(1.5708))).toBe('1.5708rad')
    // a solved phase constant keeps its digits via a significant annotation
    expect(Calc.serialize(Angle.rad(2.094395102, Precision.significant(10)))).toBe('2.094395102rad')
  })

  test('degrees serialize with the deg unit and lower to radians at solve', () => {
    expect(Calc.serialize(Angle.deg(45))).toBe('45deg')
    expect(Calc.solve(Angle.deg(180))).toBeCloseTo(Math.PI)
    // deg is context-free, like rad — no solve context needed
    expect(Calc.solve(Angle.deg(90))).toBeCloseTo(Math.PI / 2)
  })

  test('same-unit lengths fold; mixed units stay symbolic', () => {
    expect(Calc.serialize(Calc.add(Length.px(10), Length.px(5)))).toBe('15px')
    expect(Calc.serialize(Calc.add(Length.px(16), Length.vw(2)))).toBe('calc(16px + 2vw)')
    expect(Calc.serialize(Calc.subtract(Length.vw(100), Length.px(320)))).toBe(
      'calc(100vw - 320px)',
    )
  })

  test('a number scales a length', () => {
    expect(Calc.serialize(Calc.multiply(Length.px(10), 2))).toBe('20px')
    expect(Calc.serialize(Calc.multiply(3, Length.vw(2)))).toBe('6vw')
  })

  test('length over length cancels to a solvable number', () => {
    const ratio = Calc.divide(Length.px(320), Length.px(160))
    expect(Calc.serialize(ratio)).toBe('2')
    expect(Calc.solve(ratio)).toBe(2)
  })

  test('the fluid position term serializes with its units intact', () => {
    const position = Calc.divide(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160))
    expect(Calc.serialize(position)).toBe('calc((100vw - 320px) / 160px)')
  })

  test('clamp over mixed-unit lengths', () => {
    expect(Calc.serialize(Calc.clamp(Length.px(16), Length.vw(4), Length.px(48)))).toBe(
      'clamp(16px, 4vw, 48px)',
    )
  })
})

describe('data — solving through a unit context', () => {
  test('absolute lengths and angles solve with no context', () => {
    expect(Calc.solve(Length.px(10))).toBe(10)
    expect(Calc.solve(Angle.rad(2))).toBe(2)
    expect(Calc.solve(Calc.add(Length.px(10), Length.px(5)))).toBe(15)
  })

  test('the fluid position term solves at a sample viewport width', () => {
    const position = Calc.divide(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160))
    // (100 * 12.8 - 320) / 160 = 6 at a 1280px viewport
    expect(Calc.solve(position, {}, { vw: 1280 / 100 })).toBe(6)
    expect(Calc.solve(position, {}, { vw: 320 / 100 })).toBe(0)
  })

  test('an absolute override changes the solve base', () => {
    // solve in half-pixels: every px counts double
    expect(Calc.solve(Length.px(10), {}, { px: 2 })).toBe(20)
  })

  test('a relative unit with no ratio throws', () => {
    // typed callers must pass a context; the cast models a dynamic/untyped caller
    expect(() => Calc.solve(Length.vw(10) as unknown as Calc.Calc<never>)).toThrow(
      "no ratio for 'vw'",
    )
  })
})

describe('data — tan(atan2()) as a portable length ratio', () => {
  const numerator = Calc.subtract(Length.vw(100), Length.px(320))
  const viaTan = Calc.tan(Calc.atan2(numerator, Length.px(160)))
  const viaDivide = Calc.divide(numerator, Length.px(160))

  test('serializes as the Firefox-compatible tan(atan2(...)) form', () => {
    expect(Calc.serialize(viaTan)).toBe('tan(atan2(100vw - 320px, 160px))')
  })

  test('solves to the same value as the length division', () => {
    for (const width of [320, 768, 1280]) {
      const context = { vw: width / 100 }
      expect(Calc.solve(viaTan, {}, context)).toBeCloseTo(Calc.solve(viaDivide, {}, context), 12)
    }
  })

  test('atan2 of same-unit constants folds to a radian angle', () => {
    expect(Calc.serialize(Calc.atan2(3, 4))).toBe('0.6435rad')
    expect(Calc.solve(Calc.tan(Calc.atan2(3, 4)))).toBeCloseTo(0.75, 12)
  })
})

// the JS reference for the fluid curve below: the same closed form, with Math
const fluidClosedForm = (width: number): number => {
  const ratio = Math.min(1, Math.max(0, (width - 320) / 160))
  const clamped = Math.min(1, Math.max(-1, 1 - 1.21633068 * ratio))
  return 0.8731780843 + 1.746356169 * Math.cos(Math.acos(clamped) / 3 - 2.094395102)
}

describe('data — the full fluid curve', () => {
  const sig = Precision.significant(10)
  // dtcg's closed-form cardinal-segment inverse over a fluid position term. The
  // position ratio is emitted as tan(atan2(...)) — the portable form, since
  // Firefox does not yet support <length> / <length> in calc().
  const position = Calc.clamp(
    0,
    Calc.tan(Calc.atan2(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160))),
    1,
  )
  const inner = Calc.subtract(1, Calc.multiply(Calc.of(1.21633068, sig), position))
  const curve = Calc.add(
    Calc.of(0.8731780843, sig),
    Calc.multiply(
      Calc.of(1.746356169, sig),
      Calc.cos(
        Calc.subtract(
          Calc.divide(Calc.acos(Calc.clamp(-1, inner, 1)), 3),
          Angle.rad(2.094395102, sig),
        ),
      ),
    ),
  )

  test('serializes byte-exact, units and rad phase intact', () => {
    expect(Calc.serialize(curve)).toBe(
      'calc(0.8731780843 + 1.746356169 * cos(acos(clamp(-1, 1 - 1.21633068 * clamp(0, tan(atan2(100vw - 320px, 160px)), 1), 1)) / 3 - 2.094395102rad))',
    )
  })

  test('solves against the closed form at sample viewport widths', () => {
    for (const width of [320, 480, 768, 1280]) {
      expect(Calc.solve(curve, {}, { vw: width / 100 })).toBeCloseTo(fluidClosedForm(width), 9)
    }
  })

  test('is number-kind at the top but carries its units as leaves', () => {
    expectTypeOf(curve).toEqualTypeOf<Calc.Calc<never, 'number', Unit.Vw | Unit.Px | Unit.Rad>>()
  })
})

describe('data — percentages', () => {
  test('a percentage serializes value + %', () => {
    expect(Calc.serialize(Percentage.of(40))).toBe('40%')
    expect(Calc.serialize(Percentage.of(12.5))).toBe('12.5%')
  })

  test('a precision annotation pins the percentage digits', () => {
    expect(Calc.serialize(Percentage.of(33.333333, Precision.significant(4)))).toBe('33.33%')
  })

  test('same-unit percentages fold; a number scales one', () => {
    expect(Calc.serialize(Calc.add(Percentage.of(20), Percentage.of(5)))).toBe('25%')
    expect(Calc.serialize(Calc.multiply(Percentage.of(50), 2))).toBe('100%')
    expect(Calc.serialize(Calc.multiply(Percentage.of(50), Calc.ref('t')))).toBe(
      'calc(50% * var(--t))',
    )
  })

  test('percentage over percentage cancels to a solvable number', () => {
    const ratio = Calc.divide(Percentage.of(50), Percentage.of(100))
    expect(Calc.serialize(ratio)).toBe('0.5')
    expect(Calc.solve(ratio)).toBe(0.5)
  })

  test('a percentage differs from the bare number and from a length', () => {
    expect(Calc.equals(Percentage.of(40), Calc.of(40))).toBe(false)
    expect(Calc.equals(Percentage.of(40), Percentage.of(40))).toBe(true)
    expect(Calc.equals(Percentage.of(10), Length.px(10))).toBe(false)
  })
})

describe('data — structural equality', () => {
  test('a length differs from the bare number', () => {
    expect(Calc.equals(Length.px(10), Calc.of(10))).toBe(false)
  })

  test('same unit and value are equal', () => {
    expect(Calc.equals(Length.px(10), Length.px(10))).toBe(true)
    expect(Calc.equals(Length.px(10), Length.rem(10))).toBe(false)
  })
})

// Compile-time assertions only — never invoked.
const dimensionalTypes = (): void => {
  expectTypeOf(Length.px(16)).toEqualTypeOf<Calc.Calc<never, 'length', Unit.Px>>()
  expectTypeOf(Angle.rad(2)).toEqualTypeOf<Calc.Calc<never, 'angle', Unit.Rad>>()

  // leaves accrue across a sum; the kind stays length
  expectTypeOf(Calc.add(Length.px(16), Length.vw(2))).toEqualTypeOf<
    Calc.Calc<never, 'length', Unit.Px | Unit.Vw>
  >()

  // variadic add keeps precision past the old 4-arg ceiling
  expectTypeOf(
    Calc.add(Length.px(1), Length.px(2), Length.px(3), Length.px(4), Length.px(5)),
  ).toEqualTypeOf<Calc.Calc<never, 'length', Unit.Px>>()

  // same-single-unit division proves pure; the position term stays conservative
  expectTypeOf(Calc.divide(Length.px(320), Length.px(160))).toEqualTypeOf<
    Calc.Calc<never, 'number', never>
  >()
  expectTypeOf(
    Calc.divide(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160)),
  ).toEqualTypeOf<Calc.Calc<never, 'number', Unit.Vw | Unit.Px>>()

  // number * length is a length; length / number keeps the length
  expectTypeOf(Calc.multiply(Length.px(10), 2)).toEqualTypeOf<Calc.Calc<never, 'length', Unit.Px>>()
  expectTypeOf(Calc.divide(Length.vw(100), 4)).toEqualTypeOf<Calc.Calc<never, 'length', Unit.Vw>>()

  // @ts-expect-error a <length> plus a <number> is invalid CSS
  Calc.add(Length.px(10), 5)
  // @ts-expect-error a <length> plus an <angle> is invalid CSS
  Calc.add(Length.px(10), Angle.rad(1))
  // @ts-expect-error two dimensioned factors are not a modeled product
  Calc.multiply(Length.px(10), Length.px(10))
  // @ts-expect-error a <length> divided by an <angle> is invalid
  Calc.divide(Length.px(10), Angle.rad(1))

  // solve: context-free trees need no context; relative units require one
  const position = Calc.divide(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160))
  expectTypeOf(Calc.solve(Length.px(10))).toBeNumber()
  expectTypeOf(Calc.solve(position, {}, { vw: 12.8 })).toBeNumber()
  // @ts-expect-error a viewport-relative tree is not solvable without a context
  Calc.solve(position)
  // @ts-expect-error the context must supply the relative unit's ratio
  Calc.solve(position, {}, {})
  // @ts-expect-error px is an absolute override, not a substitute for the vw ratio
  Calc.solve(position, {}, { px: 1 })

  // tan(atan2(length, length)) is a <number> carrying both units — a portable a/b
  expectTypeOf(
    Calc.tan(Calc.atan2(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160))),
  ).toEqualTypeOf<Calc.Calc<never, 'number', Unit.Vw | Unit.Px>>()
  // @ts-expect-error atan2 requires a shared kind — a <length> and an <angle> do not
  Calc.atan2(Length.px(10), Angle.rad(1))

  // a percentage is its own kind: it folds and scales, but never mixes with a
  // bare number or another dimension
  expectTypeOf(Percentage.of(40)).toEqualTypeOf<Calc.Calc<never, 'percentage', Unit.Percent>>()
  expectTypeOf(Calc.add(Percentage.of(20), Percentage.of(5))).toEqualTypeOf<
    Calc.Calc<never, 'percentage', Unit.Percent>
  >()
  expectTypeOf(Calc.multiply(Percentage.of(50), 2)).toEqualTypeOf<
    Calc.Calc<never, 'percentage', Unit.Percent>
  >()
  expectTypeOf(Calc.divide(Percentage.of(50), Percentage.of(100))).toEqualTypeOf<
    Calc.Calc<never, 'number', never>
  >()
  // @ts-expect-error a <percentage> plus a bare number is invalid CSS
  Calc.add(Percentage.of(20), 5)
  // @ts-expect-error a <percentage> plus a <length> is invalid CSS
  Calc.add(Percentage.of(20), Length.px(10))

  // the dimension aliases name the widened Calc for each kind. A single-unit
  // constructor lands on a narrower leaf than its alias — Angle now spans rad
  // and deg, Percentage has just `%` — but every specific expression, single-
  // or mixed-unit, is assignable to the wide alias.
  expectTypeOf(Angle.rad(2)).toEqualTypeOf<Calc.Calc<never, 'angle', Unit.Rad>>()
  expectTypeOf(Angle.deg(45)).toEqualTypeOf<Calc.Calc<never, 'angle', Unit.Deg>>()
  expectTypeOf(Percentage.of(40)).toEqualTypeOf<Percentage.Percentage<never>>()
  const wideAngle: Angle.Angle = Angle.rad(2)
  const wideLength: Length.Length = Calc.add(Length.px(16), Length.vw(2))
  const widePercentage: Percentage.Percentage = Percentage.of(40)
  void wideAngle
  void wideLength
  void widePercentage
}
void dimensionalTypes
