import { describe, expect, test } from 'vitest'
import { MediaQuery } from '../src/query/index.ts'

describe('query', () => {
  describe('rendering', () => {
    test('min-width renders prefix syntax by default', () => {
      expect(MediaQuery.render(MediaQuery.minWidth(768))).toBe('(min-width: 768px)')
    })

    test('min-width renders range syntax on request', () => {
      expect(MediaQuery.render(MediaQuery.minWidth(768), { mediaSyntax: 'range' })).toBe(
        '(width >= 768px)',
      )
    })

    test('prefers-color-scheme renders identically in both syntaxes', () => {
      const query = MediaQuery.prefersColorScheme('dark')
      expect(MediaQuery.render(query)).toBe('(prefers-color-scheme: dark)')
      expect(MediaQuery.render(query, { mediaSyntax: 'range' })).toBe(
        '(prefers-color-scheme: dark)',
      )
    })

    test('fractional thresholds format without trailing zeros', () => {
      expect(MediaQuery.render(MediaQuery.minWidth(768.5))).toBe('(min-width: 768.5px)')
    })

    test('conjunctions join with and', () => {
      const query = MediaQuery.and(MediaQuery.prefersColorScheme('dark'), MediaQuery.minWidth(1280))
      expect(MediaQuery.render(query)).toBe('(min-width: 1280px) and (prefers-color-scheme: dark)')
    })

    test('the syntax option applies to every width feature', () => {
      const query = MediaQuery.and(MediaQuery.minWidth(768), MediaQuery.prefersColorScheme('dark'))
      expect(MediaQuery.render(query, { mediaSyntax: 'range' })).toBe(
        '(width >= 768px) and (prefers-color-scheme: dark)',
      )
    })
  })

  describe('canonical ordering', () => {
    test('and is commutative', () => {
      const a = MediaQuery.and(MediaQuery.prefersColorScheme('dark'), MediaQuery.minWidth(768))
      const b = MediaQuery.and(MediaQuery.minWidth(768), MediaQuery.prefersColorScheme('dark'))
      expect(MediaQuery.equals(a, b)).toBe(true)
      expect(MediaQuery.render(a)).toBe(MediaQuery.render(b))
    })

    test('min-widths order ascending by threshold', () => {
      const query = MediaQuery.and(MediaQuery.minWidth(1024), MediaQuery.minWidth(768))
      expect(MediaQuery.render(query)).toBe('(min-width: 768px) and (min-width: 1024px)')
    })

    test('and is idempotent: identical features dedup', () => {
      const query = MediaQuery.and(MediaQuery.minWidth(768), MediaQuery.minWidth(768))
      expect(MediaQuery.equals(query, MediaQuery.minWidth(768))).toBe(true)
      expect(MediaQuery.render(query)).toBe('(min-width: 768px)')
    })

    test('distinct features are kept even when one subsumes another', () => {
      const query = MediaQuery.and(MediaQuery.minWidth(768), MediaQuery.minWidth(1024))
      expect(MediaQuery.equals(query, MediaQuery.minWidth(1024))).toBe(false)
    })

    test('supports data-last composition', () => {
      const query = MediaQuery.minWidth(1280).pipe(
        MediaQuery.and(MediaQuery.prefersColorScheme('dark')),
      )
      expect(MediaQuery.render(query)).toBe('(min-width: 1280px) and (prefers-color-scheme: dark)')
    })
  })

  describe('validation', () => {
    test('rejects negative and non-finite thresholds', () => {
      expect(() => MediaQuery.minWidth(-1)).toThrow('non-negative finite')
      expect(() => MediaQuery.minWidth(Number.POSITIVE_INFINITY)).toThrow('non-negative finite')
    })
  })

  describe('equality', () => {
    test('separately built identical queries are equal', () => {
      const a = MediaQuery.and(MediaQuery.minWidth(768), MediaQuery.prefersColorScheme('dark'))
      const b = MediaQuery.and(MediaQuery.prefersColorScheme('dark'), MediaQuery.minWidth(768))
      expect(a).toStructurallyEqual(b)
    })

    test('different schemes are not equal', () => {
      expect(
        MediaQuery.equals(
          MediaQuery.prefersColorScheme('dark'),
          MediaQuery.prefersColorScheme('light'),
        ),
      ).toBe(false)
    })
  })

  describe('guards', () => {
    test('isMediaQuery accepts queries and rejects the rest', () => {
      expect(MediaQuery.isMediaQuery(MediaQuery.minWidth(0))).toBe(true)
      expect(MediaQuery.isMediaQuery({})).toBe(false)
      expect(MediaQuery.isMediaQuery(null)).toBe(false)
    })
  })
})
