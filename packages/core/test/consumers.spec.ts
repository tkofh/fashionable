import { describe, expect, test } from 'vitest'
import { Calc } from '../src/calc/index.ts'
import { Color } from '../src/color/index.ts'
import { Declaration } from '../src/declaration/index.ts'
import { FontFaceRule } from '../src/fontFace/index.ts'
import { PropertyRule, PropertySyntax } from '../src/property/index.ts'
import { MediaQuery } from '../src/query/index.ts'
import { RuleSet, StyleRule } from '../src/rule/index.ts'
import { Selector } from '../src/selector/index.ts'
import { Stylesheet } from '../src/stylesheet/index.ts'

// The JS reference for the gamut tent below — the same closed form the
// expression tree encodes, evaluated with Math directly.
const tentClosedForm = (lightness: number): number => {
  const gate = Math.max(0, Math.sign(lightness - 0.654))
  const rising = (0.29307 * lightness) / 0.654
  const falling =
    (0.29307 * (1 - lightness)) / (1 - 0.654) +
    -0.07636 *
      Math.pow(Math.sin(Math.max(0, (lightness - 0.654) / (1 - 0.654)) * Math.PI), 0.95) *
      0.29307
  return (1 - gate) * rising + gate * falling
}

describe('consumers', () => {
  // The ok-apca pattern: @property registrations (underscore prefix =>
  // non-inheriting scratch channel) plus a role block whose custom
  // properties form a computed chain — a gamut "tent" authored once over
  // named references, bound per hue, solved in JS and serialized to CSS
  // from the same tree.
  describe('ok-apca: a computed @property color chain', () => {
    const gate = Calc.max(0, Calc.sign(Calc.subtract(Calc.ref('lightness'), Calc.ref('apexL'))))
    const rising = Calc.divide(
      Calc.multiply(Calc.ref('apexC'), Calc.ref('lightness')),
      Calc.ref('apexL'),
    )
    const fallProgress = Calc.max(
      0,
      Calc.divide(
        Calc.subtract(Calc.ref('lightness'), Calc.ref('apexL')),
        Calc.subtract(1, Calc.ref('apexL')),
      ),
    )
    const falling = Calc.add(
      Calc.divide(
        Calc.multiply(Calc.ref('apexC'), Calc.subtract(1, Calc.ref('lightness'))),
        Calc.subtract(1, Calc.ref('apexL')),
      ),
      Calc.multiply(
        Calc.multiply(
          Calc.ref('tentK'),
          Calc.pow(Calc.sin(Calc.multiply(fallProgress, Math.PI)), 0.95),
        ),
        Calc.ref('apexC'),
      ),
    )
    const tent = Calc.add(
      Calc.multiply(Calc.subtract(1, gate), rising),
      Calc.multiply(gate, falling),
    )
    const redTent: Calc<'lightness'> = Calc.bind(tent, {
      apexL: 0.654,
      apexC: 0.29307,
      tentK: -0.07636,
    })

    const sheet = Stylesheet.make(
      PropertyRule.make('--lightness', PropertySyntax.number, 0).pipe(PropertyRule.inheritable),
      PropertyRule.make('--chroma', PropertySyntax.number, 0).pipe(PropertyRule.inheritable),
      PropertyRule.make('--_fill-mc', PropertySyntax.number, 0),
      PropertyRule.make('--color-fill', PropertySyntax.color, 'transparent').pipe(
        PropertyRule.inheritable,
      ),
    ).pipe(
      Stylesheet.append(
        Selector.class('fill'),
        RuleSet.make(
          Declaration.make('--_fill-mc', redTent),
          Declaration.make(
            '--color-fill',
            Color.oklch(
              Calc.ref('lightness'),
              Calc.multiply(Calc.ref('_fill-mc'), Calc.ref('chroma')),
              30,
            ),
          ),
        ),
      ),
    )

    test('registrations and the role block render as one sheet', () => {
      expect(Stylesheet.render(sheet)).toBe(
        [
          "@property --lightness {\n\tsyntax: '<number>';\n\tinherits: true;\n\tinitial-value: 0;\n}",
          "@property --chroma {\n\tsyntax: '<number>';\n\tinherits: true;\n\tinitial-value: 0;\n}",
          "@property --_fill-mc {\n\tsyntax: '<number>';\n\tinherits: false;\n\tinitial-value: 0;\n}",
          "@property --color-fill {\n\tsyntax: '<color>';\n\tinherits: true;\n\tinitial-value: transparent;\n}",
          '.fill {\n\t--_fill-mc: calc((1 - max(0, sign(var(--lightness) - 0.654))) * 0.29307 * var(--lightness) / 0.654 + max(0, sign(var(--lightness) - 0.654)) * (0.29307 * (1 - var(--lightness)) / 0.346 + -0.07636 * pow(sin(max(0, (var(--lightness) - 0.654) / 0.346) * pi), 0.95) * 0.29307));\n\t--color-fill: oklch(var(--lightness) calc(var(--_fill-mc) * var(--chroma)) 30);\n}',
        ].join('\n\n'),
      )
    })

    test('the serialized expression and the solved expression are the same tree', () => {
      for (const lightness of [0.2, 0.4, 0.654, 0.7, 0.9]) {
        expect(Calc.solve(redTent, { lightness })).toBeCloseTo(tentClosedForm(lightness), 12)
      }
    })

    test('the sheet reports the custom properties it reads', () => {
      expect(Stylesheet.refs(sheet)).toEqual(new Set(['lightness', 'chroma', '_fill-mc']))
    })
  })

  // The dtcg-resolver pattern: independent per-token-type emitters each
  // produce a sheet that leads with the shared scheme contract; the fold
  // must carry exactly one contract copy, in first-occurrence order.
  describe('dtcg: a multi-emitter merge fold', () => {
    const rootLight = Selector.root.pipe(Selector.and(Selector.attribute('data-scheme', 'light')))
    const rootDark = Selector.root.pipe(Selector.and(Selector.attribute('data-scheme', 'dark')))
    const notLight = Selector.root.pipe(
      Selector.and(Selector.not(Selector.attribute('data-scheme', 'light'))),
    )

    const contract = Stylesheet.make(
      StyleRule.make(Selector.root, RuleSet.make(Declaration.make('color-scheme', 'light dark'))),
      StyleRule.make(rootLight, RuleSet.make(Declaration.make('color-scheme', 'light'))),
      StyleRule.make(rootDark, RuleSet.make(Declaration.make('color-scheme', 'dark'))),
    )

    const colors = contract.pipe(
      Stylesheet.append(
        Selector.root,
        RuleSet.make(
          Declaration.make('--surface', 'light-dark(color(srgb 1 1 1), color(srgb 0 0 0))'),
        ),
      ),
    )

    const strokes = contract.pipe(
      Stylesheet.append(
        Selector.root,
        RuleSet.make(Declaration.make('--stroke-card', 'light-dark(#d0d0d0, #3a3a3a)')),
      ),
    )

    // The fluid-curve helper property: dtcg's closed-form cardinal-segment
    // inverse, a cos(acos(...)) chain reading one unbound reference.
    const fluidT: Calc<'type-fluid-u'> = Calc.cos(
      Calc.subtract(
        Calc.divide(Calc.acos(Calc.clamp(-1, Calc.ref('type-fluid-u'), 1)), 3),
        2.0943951,
      ),
    )

    const typography = contract.pipe(
      Stylesheet.append(
        FontFaceRule.make({
          family: 'Inter',
          weight: [1, 1000],
          style: 'normal',
          display: 'swap',
          src: [FontFaceRule.url('/fonts/inter.woff2', 'woff2')],
        }),
      ),
      Stylesheet.append(
        FontFaceRule.make({
          family: 'Inter Fallback',
          src: [FontFaceRule.local('Arial')],
          ascentOverride: 95,
          descentOverride: 25,
          lineGapOverride: 5,
          sizeAdjust: 112.1577,
        }),
      ),
      Stylesheet.append(
        Selector.root,
        RuleSet.make(
          Declaration.make('--fonts-body', "'Inter', 'Inter Fallback', sans-serif"),
          Declaration.make('--type-body-size', '1.5rem'),
          Declaration.make('--type-body-size--t', fluidT),
          Declaration.make('--type-body-weight', '400'),
        ).pipe(
          RuleSet.append(
            MediaQuery.minWidth(1280),
            RuleSet.make(Declaration.make('--type-body-size', '3rem')),
          ),
        ),
      ),
      Stylesheet.append(
        notLight,
        RuleSet.empty.pipe(
          RuleSet.append(
            MediaQuery.prefersColorScheme('dark'),
            RuleSet.make(Declaration.make('--type-body-weight', '375')),
          ),
        ),
      ),
      Stylesheet.append(rootDark, RuleSet.make(Declaration.make('--type-body-weight', '375'))),
    )

    const merged = Stylesheet.mergeAll([colors, strokes, typography])

    test('the emitters fold to one contract copy', () => {
      expect(colors.nodes).toHaveLength(4)
      expect(strokes.nodes).toHaveLength(4)
      expect(typography.nodes).toHaveLength(8)
      expect(merged.nodes).toHaveLength(10)
      expect(merged.nodes[0]).toBe(contract.nodes[0])
      expect(merged.nodes[1]).toBe(contract.nodes[1])
      expect(merged.nodes[2]).toBe(contract.nodes[2])
    })

    test('the merged file renders in first-occurrence order', () => {
      expect(Stylesheet.render(merged, { indent: '  ' })).toBe(
        [
          ':root {\n  color-scheme: light dark;\n}',
          ":root[data-scheme='light'] {\n  color-scheme: light;\n}",
          ":root[data-scheme='dark'] {\n  color-scheme: dark;\n}",
          ':root {\n  --surface: light-dark(color(srgb 1 1 1), color(srgb 0 0 0));\n}',
          ':root {\n  --stroke-card: light-dark(#d0d0d0, #3a3a3a);\n}',
          "@font-face {\n  font-family: 'Inter';\n  font-weight: 1 1000;\n  font-style: normal;\n  font-display: swap;\n  src: url('/fonts/inter.woff2') format('woff2');\n}",
          "@font-face {\n  font-family: 'Inter Fallback';\n  src: local('Arial');\n  ascent-override: 95%;\n  descent-override: 25%;\n  line-gap-override: 5%;\n  size-adjust: 112.1577%;\n}",
          ":root {\n  --fonts-body: 'Inter', 'Inter Fallback', sans-serif;\n  --type-body-size: 1.5rem;\n  --type-body-size--t: cos(acos(clamp(-1, var(--type-fluid-u), 1)) / 3 - 2.0944rad);\n  --type-body-weight: 400;\n}",
          '@media (min-width: 1280px) {\n  :root {\n    --type-body-size: 3rem;\n  }\n}',
          "@media (prefers-color-scheme: dark) {\n  :root:not([data-scheme='light']) {\n    --type-body-weight: 375;\n  }\n}",
          ":root[data-scheme='dark'] {\n  --type-body-weight: 375;\n}",
        ].join('\n\n'),
      )
    })

    test('the sheet reports its one unbound reference', () => {
      expect(Stylesheet.refs(merged)).toEqual(new Set(['type-fluid-u']))
    })

    test('coalesce folds same-selector rules into their first occurrence', () => {
      const coalesced = Stylesheet.coalesce(merged)
      expect(coalesced.nodes).toHaveLength(6)
      expect(Stylesheet.render(coalesced, { indent: '  ' })).toBe(
        [
          ":root {\n  color-scheme: light dark;\n  --surface: light-dark(color(srgb 1 1 1), color(srgb 0 0 0));\n  --stroke-card: light-dark(#d0d0d0, #3a3a3a);\n  --fonts-body: 'Inter', 'Inter Fallback', sans-serif;\n  --type-body-size: 1.5rem;\n  --type-body-size--t: cos(acos(clamp(-1, var(--type-fluid-u), 1)) / 3 - 2.0944rad);\n  --type-body-weight: 400;\n}",
          '@media (min-width: 1280px) {\n  :root {\n    --type-body-size: 3rem;\n  }\n}',
          ":root[data-scheme='light'] {\n  color-scheme: light;\n}",
          ":root[data-scheme='dark'] {\n  color-scheme: dark;\n  --type-body-weight: 375;\n}",
          "@font-face {\n  font-family: 'Inter';\n  font-weight: 1 1000;\n  font-style: normal;\n  font-display: swap;\n  src: url('/fonts/inter.woff2') format('woff2');\n}",
          "@font-face {\n  font-family: 'Inter Fallback';\n  src: local('Arial');\n  ascent-override: 95%;\n  descent-override: 25%;\n  line-gap-override: 5%;\n  size-adjust: 112.1577%;\n}",
          "@media (prefers-color-scheme: dark) {\n  :root:not([data-scheme='light']) {\n    --type-body-weight: 375;\n  }\n}",
        ].join('\n\n'),
      )
    })
  })
})
