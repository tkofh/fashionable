import { describe, expect, test } from 'vitest'
import { Calc, Precision } from '#calc'
import { Color } from '#data'
import { Declaration } from '#declaration'
import { FontFaceRule } from '#fontFace'
import { PropertyRule, PropertySyntax } from '#property'
import { MediaQuery } from '#query'
import { MediaRule, RuleSet, StyleRule } from '#rule'
import { Selector } from '#selector'
import { Stylesheet } from '#stylesheet'

describe('render', () => {
  describe('fragments', () => {
    test('a declaration renders as name: value;', () => {
      expect(Declaration.render(Declaration.make('--depth', 4))).toBe('--depth: 4;')
      expect(
        Declaration.render(Declaration.make('--indent', Calc.multiply(Calc.var('depth'), 8))),
      ).toBe('--indent: calc(var(--depth) * 8);')
    })

    test('a declaration render honors precision', () => {
      expect(
        Declaration.render(Declaration.make('--third', Calc.divide(1, 3)), {
          precision: Precision.decimals(2),
        }),
      ).toBe('--third: 0.33;')
    })

    test('a rule set renders its body without braces', () => {
      const set = RuleSet.make(
        Declaration.make('--depth', 4),
        Declaration.make('color', 'red'),
      ).pipe(RuleSet.append(MediaQuery.minWidth(768), RuleSet.make(Declaration.make('--depth', 6))))
      expect(RuleSet.render(set)).toBe(
        '--depth: 4;\ncolor: red;\n@media (min-width: 768px) {\n\t--depth: 6;\n}',
      )
    })

    test('a style rule renders in nested form', () => {
      const rule = StyleRule.make(
        Selector.root,
        RuleSet.make(Declaration.make('--depth', 4)).pipe(
          RuleSet.append(MediaQuery.minWidth(768), RuleSet.make(Declaration.make('--depth', 6))),
        ),
      )
      expect(StyleRule.render(rule)).toBe(
        ':root {\n\t--depth: 4;\n\t@media (min-width: 768px) {\n\t\t--depth: 6;\n\t}\n}',
      )
    })

    test('a media rule renders its query block with declarations direct', () => {
      const rule = MediaRule.make(
        MediaQuery.minWidth(768),
        RuleSet.make(Declaration.make('--gutter', 24)),
      )
      expect(MediaRule.render(rule)).toBe('@media (min-width: 768px) {\n\t--gutter: 24;\n}')
      expect(MediaRule.render(rule, { mediaSyntax: 'range' })).toBe(
        '@media (width >= 768px) {\n\t--gutter: 24;\n}',
      )
    })

    test('empty fragments render as the empty string', () => {
      expect(RuleSet.render(RuleSet.empty)).toBe('')
      expect(StyleRule.render(StyleRule.make(Selector.root, RuleSet.empty))).toBe('')
      expect(MediaRule.render(MediaRule.make(MediaQuery.minWidth(768), RuleSet.empty))).toBe('')
    })
  })

  describe('stylesheet', () => {
    test('renders a bare style rule', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(
          Selector.root,
          RuleSet.make(Declaration.make('--gutter', 16), Declaration.make('color', 'red')),
        ),
      )
      expect(Stylesheet.render(sheet)).toBe(':root {\n\t--gutter: 16;\n\tcolor: red;\n}')
    })

    test('keeps a nested media block inside its rule', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(
          Selector.root,
          RuleSet.make(
            MediaRule.make(MediaQuery.minWidth(768), RuleSet.make(Declaration.make('--gap', 24))),
          ),
        ),
      )
      expect(Stylesheet.render(sheet)).toBe(
        ':root {\n\t@media (min-width: 768px) {\n\t\t--gap: 24;\n\t}\n}',
      )
    })

    test('keeps declarations trailing a nested rule in cascade position', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(
          Selector.root,
          RuleSet.make(
            Declaration.make('--a', 1),
            MediaRule.make(MediaQuery.minWidth(768), RuleSet.make(Declaration.make('--a', 2))),
            Declaration.make('--b', 3),
          ),
        ),
      )
      expect(Stylesheet.render(sheet)).toBe(
        ':root {\n\t--a: 1;\n\t@media (min-width: 768px) {\n\t\t--a: 2;\n\t}\n\t--b: 3;\n}',
      )
    })

    test('nests media within media', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(
          Selector.root,
          RuleSet.make(
            MediaRule.make(
              MediaQuery.minWidth(768),
              RuleSet.make(
                MediaRule.make(
                  MediaQuery.prefersColorScheme('dark'),
                  RuleSet.make(Declaration.make('--x', 1)),
                ),
              ),
            ),
          ),
        ),
      )
      expect(Stylesheet.render(sheet)).toBe(
        ':root {\n\t@media (min-width: 768px) {\n\t\t@media (prefers-color-scheme: dark) {\n\t\t\t--x: 1;\n\t\t}\n\t}\n}',
      )
    })

    test('serializes expression and color values, honoring precision', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(
          Selector.root,
          RuleSet.make(
            Declaration.make('--indent', Calc.multiply(Calc.var('depth'), 8)),
            Declaration.make('--third', Calc.divide(1, 3)),
            Declaration.make('color', Color.oklch(0.7, 0.1, 250)),
          ),
        ),
      )
      expect(Stylesheet.render(sheet, { precision: Precision.decimals(2) })).toBe(
        ':root {\n\t--indent: calc(var(--depth) * 8);\n\t--third: 0.33;\n\tcolor: oklch(0.7 0.1 250);\n}',
      )
    })

    test('renders media in range syntax on request', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(
          Selector.root,
          RuleSet.make(
            MediaRule.make(MediaQuery.minWidth(768), RuleSet.make(Declaration.make('--gap', 24))),
          ),
        ),
      )
      expect(Stylesheet.render(sheet, { mediaSyntax: 'range' })).toBe(
        ':root {\n\t@media (width >= 768px) {\n\t\t--gap: 24;\n\t}\n}',
      )
    })

    test('skips empty blocks entirely', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(Selector.root, RuleSet.empty),
        StyleRule.make(
          Selector.class('btn'),
          RuleSet.make(MediaRule.make(MediaQuery.minWidth(768), RuleSet.empty)),
        ),
      )
      expect(Stylesheet.render(sheet)).toBe('')
    })

    test('the empty sheet renders as the empty string', () => {
      expect(Stylesheet.render(Stylesheet.empty)).toBe('')
    })

    test('renders a nested style rule as an indented sub-block, & verbatim', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(
          Selector.root,
          RuleSet.make(
            StyleRule.make(
              Selector.and(Selector.nest, Selector.pseudoClass('hover')),
              RuleSet.make(Declaration.make('color', 'red')),
            ),
          ),
        ),
      )
      expect(Stylesheet.render(sheet)).toBe(':root {\n\t&:hover {\n\t\tcolor: red;\n\t}\n}')
    })

    test('a nested style rule whose block is empty contributes nothing', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(
          Selector.root,
          RuleSet.make(
            Declaration.make('--depth', 4),
            StyleRule.make(Selector.nest, RuleSet.make()),
          ),
        ),
      )
      expect(Stylesheet.render(sheet)).toBe(':root {\n\t--depth: 4;\n}')
    })
  })

  describe('golden fixture (consumer-1 shape)', () => {
    const darkScheme = Selector.root.pipe(Selector.and(Selector.attribute('data-scheme', 'dark')))
    const autoScheme = Selector.root.pipe(
      Selector.and(Selector.not(Selector.attribute('data-scheme', 'light'))),
    )
    const sheet = Stylesheet.make(
      PropertyRule.make('--depth', PropertySyntax.number, 0),
      FontFaceRule.make({
        family: 'Inter',
        display: 'swap',
        src: [FontFaceRule.url('/fonts/inter.woff2', 'woff2')],
      }),
    ).pipe(
      Stylesheet.append(
        Selector.root,
        RuleSet.make(Declaration.make('--gutter', 16)).pipe(
          RuleSet.append(MediaQuery.minWidth(768), RuleSet.make(Declaration.make('--gutter', 24))),
          RuleSet.append(MediaQuery.minWidth(1280), RuleSet.make(Declaration.make('--gutter', 48))),
        ),
      ),
      Stylesheet.append(darkScheme, RuleSet.make(Declaration.make('--scheme', 'dark'))),
      Stylesheet.append(
        autoScheme,
        RuleSet.empty.pipe(
          RuleSet.append(
            MediaQuery.prefersColorScheme('dark'),
            RuleSet.make(Declaration.make('--scheme', 'dark')),
          ),
        ),
      ),
    )

    test('renders the consumer-1 shape in nested form', () => {
      expect(Stylesheet.render(sheet, { indent: '  ' })).toBe(
        [
          "@property --depth {\n  syntax: '<number>';\n  inherits: false;\n  initial-value: 0;\n}",
          "@font-face {\n  font-family: 'Inter';\n  font-display: swap;\n  src: url('/fonts/inter.woff2') format('woff2');\n}",
          ':root {\n  --gutter: 16;\n  @media (min-width: 768px) {\n    --gutter: 24;\n  }\n  @media (min-width: 1280px) {\n    --gutter: 48;\n  }\n}',
          ":root[data-scheme='dark'] {\n  --scheme: dark;\n}",
          ":root:not([data-scheme='light']) {\n  @media (prefers-color-scheme: dark) {\n    --scheme: dark;\n  }\n}",
        ].join('\n\n'),
      )
    })
  })
})
