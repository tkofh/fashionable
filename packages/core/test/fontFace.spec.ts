import { describe, expect, test } from 'vitest'
import { FontFaceRule } from '../src/fontFace/index.ts'

describe('fontFace', () => {
  describe('FontFaceRule', () => {
    test('renders a minimal face', () => {
      const rule = FontFaceRule.make({
        family: 'Inter',
        src: [FontFaceRule.url('/fonts/inter.woff2', 'woff2')],
      })
      expect(FontFaceRule.render(rule)).toBe(
        "@font-face {\n\tfont-family: 'Inter';\n\tsrc: url('/fonts/inter.woff2') format('woff2');\n}",
      )
    })

    test('renders the consumer shape byte-exact', () => {
      const rule = FontFaceRule.make({
        family: 'Inter',
        weight: 400,
        style: 'normal',
        display: 'swap',
        src: [
          FontFaceRule.url('/fonts/inter-regular.woff2', 'woff2'),
          FontFaceRule.url('/fonts/inter-regular.woff', 'woff'),
        ],
      })
      expect(FontFaceRule.render(rule, { indent: '  ' })).toBe(
        [
          '@font-face {',
          "  font-family: 'Inter';",
          '  font-weight: 400;',
          '  font-style: normal;',
          '  font-display: swap;',
          '  src:',
          "    url('/fonts/inter-regular.woff2') format('woff2'),",
          "    url('/fonts/inter-regular.woff') format('woff');",
          '}',
        ].join('\n'),
      )
    })

    test('renders weight ranges space-separated', () => {
      const rule = FontFaceRule.make({
        family: 'Inter',
        weight: [1, 1000],
        src: [FontFaceRule.url('/fonts/inter-variable.woff2', 'woff2')],
      })
      expect(FontFaceRule.render(rule)).toContain('font-weight: 1 1000;')
    })

    test('renders a metrics-adjusted fallback face', () => {
      const rule = FontFaceRule.make({
        family: 'Inter Fallback',
        display: 'swap',
        src: [FontFaceRule.local('Arial')],
        ascentOverride: 90.44,
        descentOverride: 22.5,
        lineGapOverride: 0,
        sizeAdjust: 107.64,
      })
      expect(FontFaceRule.render(rule)).toBe(
        [
          '@font-face {',
          "\tfont-family: 'Inter Fallback';",
          '\tfont-display: swap;',
          "\tsrc: local('Arial');",
          '\tascent-override: 90.44%;',
          '\tdescent-override: 22.5%;',
          '\tline-gap-override: 0%;',
          '\tsize-adjust: 107.64%;',
          '}',
        ].join('\n'),
      )
    })

    test('renders a url without a format hint', () => {
      const rule = FontFaceRule.make({ family: 'X', src: [FontFaceRule.url('/x.woff2')] })
      expect(FontFaceRule.render(rule)).toContain("src: url('/x.woff2');")
    })

    test('escapes quotes in names', () => {
      const rule = FontFaceRule.make({
        family: "It's",
        src: [FontFaceRule.local("O'Neil")],
      })
      const rendered = FontFaceRule.render(rule)
      expect(rendered).toContain("font-family: 'It\\'s';")
      expect(rendered).toContain("src: local('O\\'Neil');")
    })

    test('rejects invalid descriptors', () => {
      const src = [FontFaceRule.local('Arial')]
      expect(() => FontFaceRule.make({ family: '', src })).toThrow('non-empty')
      expect(() => FontFaceRule.make({ family: 'X', src: [] })).toThrow('at least one source')
      expect(() => FontFaceRule.make({ family: 'X', src, weight: 0 })).toThrow('[1, 1000]')
      expect(() => FontFaceRule.make({ family: 'X', src, weight: [900, 100] })).toThrow(
        'min then max',
      )
      expect(() => FontFaceRule.make({ family: 'X', src, ascentOverride: -1 })).toThrow(
        'non-negative',
      )
      expect(() => FontFaceRule.url('')).toThrow('non-empty')
      expect(() => FontFaceRule.url('/x.woff2', '')).toThrow('non-empty')
      expect(() => FontFaceRule.local('')).toThrow('non-empty')
    })

    test('equality is structural over descriptors', () => {
      const descriptors: FontFaceRule.Descriptors = {
        family: 'Inter',
        weight: [100, 900],
        src: [FontFaceRule.url('/inter.woff2', 'woff2'), FontFaceRule.local('Inter')],
      }
      expect(
        FontFaceRule.equals(FontFaceRule.make(descriptors), FontFaceRule.make(descriptors)),
      ).toBe(true)
      expect(FontFaceRule.make(descriptors)).toStructurallyEqual(FontFaceRule.make(descriptors))
    })

    test('src order participates in equality', () => {
      const a = FontFaceRule.make({
        family: 'X',
        src: [FontFaceRule.url('/a.woff2'), FontFaceRule.url('/b.woff2')],
      })
      const b = FontFaceRule.make({
        family: 'X',
        src: [FontFaceRule.url('/b.woff2'), FontFaceRule.url('/a.woff2')],
      })
      expect(FontFaceRule.equals(a, b)).toBe(false)
    })

    test('a single weight never equals a range', () => {
      const src = [FontFaceRule.local('Arial')]
      const single = FontFaceRule.make({ family: 'X', src, weight: 400 })
      const range = FontFaceRule.make({ family: 'X', src, weight: [400, 400] })
      expect(FontFaceRule.equals(single, range)).toBe(false)
    })

    test('guards accept their own kind and reject the rest', () => {
      const source = FontFaceRule.local('Arial')
      const rule = FontFaceRule.make({ family: 'X', src: [source] })
      expect(FontFaceRule.isFontFaceRule(rule)).toBe(true)
      expect(FontFaceRule.isFontFaceRule(source)).toBe(false)
      expect(FontFaceRule.isSource(source)).toBe(true)
      expect(FontFaceRule.isSource(rule)).toBe(false)
      expect(FontFaceRule.isFontFaceRule(null)).toBe(false)
    })
  })
})
