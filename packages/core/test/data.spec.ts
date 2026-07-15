import { describe, expect, expectTypeOf, test } from 'vitest'
import { Calc, Precision } from '#calc'
import { Angle, Length, type Unit } from '#data'

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

  test('a dimensioned tree is not evaluable without a context', () => {
    // typed callers cannot reach this; the cast models a dynamic/untyped caller
    expect(() => Calc.solve(Length.px(10) as unknown as Calc.Calc<never>)).toThrow('unit context')
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
}
void dimensionalTypes
