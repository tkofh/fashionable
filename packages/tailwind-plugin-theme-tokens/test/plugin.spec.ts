import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { outdent } from 'outdent'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import type { Config } from 'tailwindcss/types'
import { describe, expect, test } from 'vitest'
import type { PluginOptions } from '../src'
import { plugin } from '../src/plugin'

const run = <TAdditionalConfigKeys extends string = never>(
  options: PluginOptions<TAdditionalConfigKeys>,
  html = '',
  config: Omit<Config, 'content'> = {}
) => {
  const { currentTestName } = expect.getState()

  return postcss(
    tailwindcss({
      ...config,
      content: [{ raw: html, extension: 'html' }],
      plugins: [plugin(options)],
      corePlugins: { preflight: false },
      experimental: {
        // clears away all other base styles
        optimizeUniversalDefaults: true,
      },
    })
  ).process(['@tailwind base;', '@tailwind components;', '@tailwind utilities'].join('\n'), {
    from: `${resolve(fileURLToPath(import.meta.url))}?test=${currentTestName}`,
  })
}

describe('plugin', () => {
  test('it creates a root theme', async ({ expect }) => {
    expect(await run({ tokens: { spacing: ['0'] }}).css).toBe(outdent`
      :root {
          --spacing-0: 0px
      }
    `)
  })
  test('it creates a theme', async ({ expect }) => {
    expect(
      await run(
        {
          themes: [{ name: 'test', tokens: { spacing: { as: 'space', values: ['0'] } } }],
        },
        '<div class="test"></div>'
      ).css
    ).toBe(outdent`
      .test {
          --space-0: 0px
      }
    `)
  })

  test('it handles custom keys', async ({ expect }) => {
    expect(
      await run({ tokens: { custom: true } }, '', {
        theme: {
          custom: {
            a: '1',
            b: '2',
          },
        },
      }).css
    ).toBe(outdent`
      :root {
          --custom-a: 1;
          --custom-b: 2
      }
    `)
  })

  test('it handles missing', async ({ expect }) => {
    expect(await run({ tokens: { missing: true } }).css).toBe(outdent`
      :root {}
    `)
  })

  test('it escapes variable names', async ({ expect }) => {
    expect(await run({ tokens: { spacing: ['2.5'] } }).css).toBe(outdent`
      :root {
          --spacing-2\\.5: 0.625rem
      }
    `)
  })
})
