import { describe, expect, test } from 'vitest'
import { MediaQuery } from '#query'

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

    test('max-width renders both syntaxes', () => {
      expect(MediaQuery.render(MediaQuery.maxWidth(1024))).toBe('(max-width: 1024px)')
      expect(MediaQuery.render(MediaQuery.maxWidth(1024), { mediaSyntax: 'range' })).toBe(
        '(width <= 1024px)',
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

    // The concrete canonical order is stable public API: rendered text is
    // consumers' cache-key and test-pin material, so a reordering is a
    // breaking change (design.md principle 2).
    test('the kind ladder is pinned: min-width, max-width, prefers-color-scheme', () => {
      const query = MediaQuery.and(
        MediaQuery.prefersColorScheme('dark'),
        MediaQuery.and(MediaQuery.maxWidth(1024), MediaQuery.minWidth(768)),
      )
      expect(MediaQuery.render(query)).toBe(
        '(min-width: 768px) and (max-width: 1024px) and (prefers-color-scheme: dark)',
      )
    })

    test('max-widths order ascending by threshold', () => {
      const query = MediaQuery.and(MediaQuery.maxWidth(1280), MediaQuery.maxWidth(1024))
      expect(MediaQuery.render(query)).toBe('(max-width: 1024px) and (max-width: 1280px)')
    })

    test('scheme values order alphabetically within their kind', () => {
      const query = MediaQuery.and(
        MediaQuery.prefersColorScheme('light'),
        MediaQuery.prefersColorScheme('dark'),
      )
      expect(MediaQuery.render(query)).toBe(
        '(prefers-color-scheme: dark) and (prefers-color-scheme: light)',
      )
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

  describe('accessors', () => {
    test('getMinWidth returns the threshold', () => {
      expect(MediaQuery.getMinWidth(MediaQuery.minWidth(768))).toBe(768)
    })

    test('getMinWidth returns undefined without a min-width feature', () => {
      expect(MediaQuery.getMinWidth(MediaQuery.prefersColorScheme('dark'))).toBeUndefined()
    })

    // Stacked thresholds conjoin, so the effective lower bound is the
    // largest — the documented contract, pinned here.
    test('getMinWidth returns the effective bound when thresholds stack', () => {
      const query = MediaQuery.and(MediaQuery.minWidth(1024), MediaQuery.minWidth(768))
      expect(MediaQuery.getMinWidth(query)).toBe(1024)
    })

    test('getMinWidth reads through data-last conjunction', () => {
      expect(
        MediaQuery.minWidth(1280).pipe(
          MediaQuery.and(MediaQuery.prefersColorScheme('dark')),
          MediaQuery.getMinWidth,
        ),
      ).toBe(1280)
    })

    // The effective upper bound is the smallest max-width, mirroring
    // getMinWidth's largest-min-width contract.
    test('getMaxWidth returns the effective bound when thresholds stack', () => {
      expect(MediaQuery.getMaxWidth(MediaQuery.maxWidth(1024))).toBe(1024)
      const query = MediaQuery.and(MediaQuery.maxWidth(1280), MediaQuery.maxWidth(1024))
      expect(MediaQuery.getMaxWidth(query)).toBe(1024)
      expect(MediaQuery.getMaxWidth(MediaQuery.minWidth(768))).toBeUndefined()
    })

    test('getPrefersColorScheme returns the required scheme', () => {
      expect(MediaQuery.getPrefersColorScheme(MediaQuery.prefersColorScheme('light'))).toBe('light')
      expect(MediaQuery.getPrefersColorScheme(MediaQuery.minWidth(768))).toBeUndefined()
      const contradiction = MediaQuery.and(
        MediaQuery.prefersColorScheme('light'),
        MediaQuery.prefersColorScheme('dark'),
      )
      expect(MediaQuery.getPrefersColorScheme(contradiction)).toBe('dark')
    })
  })

  describe('feature guards', () => {
    test('has* report feature presence', () => {
      const query = MediaQuery.and(MediaQuery.minWidth(768), MediaQuery.prefersColorScheme('dark'))
      expect(MediaQuery.hasMinWidth(query)).toBe(true)
      expect(MediaQuery.hasMaxWidth(query)).toBe(false)
      expect(MediaQuery.hasPrefersColorScheme(query)).toBe(true)
      expect(MediaQuery.hasMaxWidth(MediaQuery.maxWidth(1024))).toBe(true)
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
