import { outdent } from 'outdent'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { describe, test } from 'vitest'
import { plugin } from '../src/plugin'

describe('resolveThemeTokens', () => {
  test('it creates a theme', ({ expect }) => {
    expect(
      postcss([
        tailwindcss({
          plugins: [
            plugin({
              themes: [{ name: 'test', tokens: { spacing: { as: 'space', values: ['0'] } } }],
            }),
          ],
          content: [{ raw: '<div class="test"></div>', extension: 'html' }],
        }),
      ])
        .process('@tailwind components;', { from: undefined })
        .then(({ css }) => css)
    ).resolves.toStrictEqual(outdent`
      .test {
          --space-0: 0px
      }
    `)
  })

  test('it handles custom keys', ({ expect }) => {
    expect(
      postcss([
        tailwindcss({
          theme: {
            custom: {
              a: '1',
              b: '2',
            },
          },
          plugins: [
            plugin<'custom'>({
              themes: [{ name: 'test', tokens: { custom: true } }],
            }),
          ],
          content: [{ raw: '<div class="test"></div>', extension: 'html' }],
        }),
      ])
        .process('@tailwind components;', { from: undefined })
        .then(({ css }) => css)
    ).resolves.toStrictEqual(outdent`
      .test {
          --custom-a: 1;
          --custom-b: 2
      }
    `)
  })

  test('it handles missing', ({ expect }) => {
    expect(
      postcss([
        tailwindcss({
          plugins: [
            plugin<'missing'>({
              themes: [{ name: 'test', tokens: { missing: true } }],
            }),
          ],
          content: [{ raw: '<div class="test"></div>', extension: 'html' }],
        }),
      ])
        .process('@tailwind components;', { from: undefined })
        .then(({ css }) => css)
    ).resolves.toStrictEqual(outdent`
      .test {}
    `)
  })
})
