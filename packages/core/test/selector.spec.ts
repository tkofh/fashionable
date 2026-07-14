import { describe, expect, test } from 'vitest'
import { Selector, Specificity } from '../src/selector/index.ts'

describe('selector', () => {
  describe('part rendering', () => {
    test('renders each simple-selector kind', () => {
      expect(Selector.render(Selector.universal)).toBe('*')
      expect(Selector.render(Selector.type('div'))).toBe('div')
      expect(Selector.render(Selector.id('app'))).toBe('#app')
      expect(Selector.render(Selector.class('btn'))).toBe('.btn')
      expect(Selector.render(Selector.pseudoClass('hover'))).toBe(':hover')
      expect(Selector.render(Selector.pseudoElement('before'))).toBe('::before')
    })

    test('renders attribute selectors', () => {
      expect(Selector.render(Selector.attribute('disabled'))).toBe('[disabled]')
      expect(Selector.render(Selector.attribute('data-scheme', 'dark'))).toBe(
        "[data-scheme='dark']",
      )
      expect(Selector.render(Selector.attribute('href', '^=', 'https:'))).toBe("[href^='https:']")
      expect(Selector.render(Selector.attribute('lang', '|=', 'en'))).toBe("[lang|='en']")
    })

    test('escapes quotes and backslashes in attribute values', () => {
      expect(Selector.render(Selector.attribute('title', "it's"))).toBe("[title='it\\'s']")
    })

    test('renders :not with a full compound argument', () => {
      const argument = Selector.attribute('data-scheme', 'light')
      expect(Selector.render(Selector.not(argument))).toBe(":not([data-scheme='light'])")
    })
  })

  describe('consumer shapes', () => {
    test(':root', () => {
      expect(Selector.render(Selector.root)).toBe(':root')
    })

    test(":root[data-scheme='dark']", () => {
      const selector = Selector.root.pipe(Selector.and(Selector.attribute('data-scheme', 'dark')))
      expect(Selector.render(selector)).toBe(":root[data-scheme='dark']")
    })

    test(":root:not([data-scheme='light'])", () => {
      const selector = Selector.and(
        Selector.root,
        Selector.not(Selector.attribute('data-scheme', 'light')),
      )
      expect(Selector.render(selector)).toBe(":root:not([data-scheme='light'])")
    })
  })

  describe('canonical ordering', () => {
    test('and is commutative', () => {
      const a = Selector.and(Selector.pseudoClass('hover'), Selector.class('btn'))
      const b = Selector.and(Selector.class('btn'), Selector.pseudoClass('hover'))
      expect(Selector.equals(a, b)).toBe(true)
      expect(Selector.render(a)).toBe('.btn:hover')
      expect(Selector.render(b)).toBe('.btn:hover')
    })

    test('type selectors sort first regardless of construction order', () => {
      const selector = Selector.and(Selector.class('a'), Selector.type('div'))
      expect(Selector.render(selector)).toBe('div.a')
    })

    test('within a kind, parts sort by rendered text', () => {
      const selector = Selector.and(Selector.class('b'), Selector.class('a'))
      expect(Selector.render(selector)).toBe('.a.b')
    })

    test('pseudo-elements sort last', () => {
      const selector = Selector.and(
        Selector.pseudoElement('before'),
        Selector.and(Selector.type('a'), Selector.pseudoClass('hover')),
      )
      expect(Selector.render(selector)).toBe('a:hover::before')
    })

    test('duplicates are kept', () => {
      const selector = Selector.and(Selector.class('a'), Selector.class('a'))
      expect(Selector.render(selector)).toBe('.a.a')
    })
  })

  describe('grammar constraints', () => {
    test('rejects two type or universal selectors', () => {
      expect(() => Selector.and(Selector.type('div'), Selector.type('span'))).toThrow(
        'at most one type or universal selector',
      )
      expect(() => Selector.and(Selector.universal, Selector.type('div'))).toThrow(
        'at most one type or universal selector',
      )
    })

    test('rejects two pseudo-elements', () => {
      expect(() =>
        Selector.and(Selector.pseudoElement('before'), Selector.pseudoElement('after')),
      ).toThrow('at most one pseudo-element')
    })

    test('rejects empty names', () => {
      expect(() => Selector.type('')).toThrow('non-empty')
      expect(() => Selector.class('')).toThrow('non-empty')
      expect(() => Selector.attribute('')).toThrow('non-empty')
    })
  })

  describe('specificity', () => {
    test('computes per-kind counts', () => {
      expect(Selector.specificity(Selector.root)).toStructurallyEqual(Specificity.make(0, 1, 0))
      expect(Selector.specificity(Selector.id('app'))).toStructurallyEqual(
        Specificity.make(1, 0, 0),
      )
      expect(Selector.specificity(Selector.universal)).toStructurallyEqual(
        Specificity.make(0, 0, 0),
      )
      expect(
        Selector.specificity(Selector.and(Selector.type('a'), Selector.pseudoElement('before'))),
      ).toStructurallyEqual(Specificity.make(0, 0, 2))
    })

    test('the attribute-qualified root counts two in b', () => {
      const selector = Selector.and(Selector.root, Selector.attribute('data-scheme', 'dark'))
      expect(Selector.specificity(selector)).toStructurallyEqual(Specificity.make(0, 2, 0))
    })

    test(':not contributes its argument, not itself', () => {
      const selector = Selector.and(
        Selector.root,
        Selector.not(Selector.attribute('data-scheme', 'light')),
      )
      expect(Selector.specificity(selector)).toStructurallyEqual(Specificity.make(0, 2, 0))
    })

    test('duplicate parts count each time', () => {
      const selector = Selector.and(Selector.class('a'), Selector.class('a'))
      expect(Selector.specificity(selector)).toStructurallyEqual(Specificity.make(0, 2, 0))
    })
  })

  describe('Specificity', () => {
    test('compares lexicographically', () => {
      expect(Specificity.compare(Specificity.make(1, 0, 0), Specificity.make(0, 9, 9))).toBe(1)
      expect(Specificity.compare(Specificity.make(0, 1, 0), Specificity.make(0, 1, 5))).toBe(-1)
      expect(Specificity.compare(Specificity.make(0, 2, 0), Specificity.make(0, 2, 0))).toBe(0)
    })

    test('supports data-last comparison', () => {
      expect(Specificity.make(1, 0, 0).pipe(Specificity.compare(Specificity.make(0, 9, 9)))).toBe(1)
    })

    test('rejects non-integer components', () => {
      expect(() => Specificity.make(-1, 0, 0)).toThrow('non-negative integers')
      expect(() => Specificity.make(0, 0.5, 0)).toThrow('non-negative integers')
    })

    test('equals is component-wise', () => {
      expect(Specificity.equals(Specificity.make(0, 1, 2), Specificity.make(0, 1, 2))).toBe(true)
      expect(Specificity.equals(Specificity.make(0, 1, 2), Specificity.make(0, 2, 1))).toBe(false)
    })
  })

  describe('equality', () => {
    test('nested :not arguments compare structurally', () => {
      const a = Selector.not(Selector.attribute('data-scheme', 'light'))
      const b = Selector.not(Selector.attribute('data-scheme', 'light'))
      expect(Selector.equals(a, b)).toBe(true)
      expect(a).toStructurallyEqual(b)
    })

    test('the two-argument form equals an explicit = operator', () => {
      const a = Selector.attribute('lang', 'en')
      const b = Selector.attribute('lang', '=', 'en')
      expect(Selector.equals(a, b)).toBe(true)
    })

    test('a presence-only attribute is not equal to a matching one', () => {
      expect(Selector.equals(Selector.attribute('lang'), Selector.attribute('lang', 'en'))).toBe(
        false,
      )
    })

    test('rejects unknown operators at runtime', () => {
      expect(() => Selector.attribute('lang', '!=' as never, 'en')).toThrow(
        'Attribute operator must be one of',
      )
    })

    test('different parts are not equal', () => {
      expect(Selector.equals(Selector.class('a'), Selector.class('b'))).toBe(false)
      expect(Selector.equals(Selector.class('a'), Selector.id('a'))).toBe(false)
    })
  })

  describe('guards', () => {
    test('isSelector accepts selectors and rejects the rest', () => {
      expect(Selector.isSelector(Selector.root)).toBe(true)
      expect(Selector.isSelector(Specificity.make(0, 0, 0))).toBe(false)
      expect(Selector.isSelector(null)).toBe(false)
    })

    test('isSpecificity accepts specificities and rejects the rest', () => {
      expect(Specificity.isSpecificity(Specificity.make(0, 0, 0))).toBe(true)
      expect(Specificity.isSpecificity(Selector.root)).toBe(false)
    })
  })
})
