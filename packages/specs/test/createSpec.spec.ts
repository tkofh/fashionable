import { describe, test } from 'vitest'
import { createSpec } from '../src'

describe('createSpec', () => {
  const spec = createSpec({
    base: 'base',
    variants: {
      a: {
        1: 'a-1 duplicate duplicate',
        2: 'a-2',
        3: 'a-3',
      },
      b: {
        1: 'b-1',
        2: 'b-2',
        3: 'b-3',
      },
    },
    defaults: {
      a: 1,
      b: 1,
    },
    compound: [
      { when: { a: 1, b: 1 }, value: 'a-1-and-b-1' },
      { when: { a: 2, b: 2 }, value: 'a-2-and-b-2' },
      { when: { a: 3, b: 3 }, value: 'a-3-and-b-3' },
    ],
  })

  test('it respects variants', ({ expect }) => {
    for (const aOption of [1, 2, 3] as const) {
      for (const bOption of [1, 2, 3] as const) {
        const result = spec({ a: aOption, b: bOption })
        expect(result.includes(`a-${aOption}`)).toBe(true)
        expect(result.includes(`b-${bOption}`)).toBe(true)
      }
    }
  })

  test('it respects defaults', ({ expect }) => {
    const result = spec()
    expect(result.includes('a-1')).toBe(true)
    expect(result.includes('b-1')).toBe(true)
  })

  test('it respects base', ({ expect }) => {
    const result = spec()
    expect(result.includes('base')).toBe(true)
  })

  test('it respects compound', ({ expect }) => {
    for (const option of [1, 2, 3] as const) {
      expect(spec({ a: option, b: option }).includes(`a-${option}-and-b-${option}`)).toBe(true)
    }
  })

  test('it mixes input with defautls', ({ expect }) => {
    for (const option of [1, 2, 3] as const) {
      const resultA = spec({ a: option })
      expect(resultA.includes(`a-${option}`)).toBe(true)
      expect(resultA.includes('b-1')).toBe(true)

      const resultB = spec({ b: option })
      expect(resultB.includes('a-1')).toBe(true)
      expect(resultB.includes(`b-${option}`)).toBe(true)
    }
  })

  test('it removes duplicate classnames', ({ expect }) => {
    const result = spec()
    expect((result.match(/duplicate/g) ?? []).length).toBe(1)
  })
})
