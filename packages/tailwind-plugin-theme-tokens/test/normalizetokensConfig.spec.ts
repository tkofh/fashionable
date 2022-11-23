import { describe, test } from 'vitest'
import { normalizeTokensConfig } from '../src/lib/normalizeTokensConfig'

describe('normalizeTokensConfig', () => {
  test('it handles simple token configs', ({ expect }) => {
    expect(normalizeTokensConfig({ tokens: { colors: true } })).toStrictEqual([
      ['colors', 'colors'],
    ])
    expect(normalizeTokensConfig({ tokens: { colors: [] } })).toStrictEqual([['colors', 'colors']])
    expect(normalizeTokensConfig({ tokens: { colors: [''] } })).toStrictEqual([
      ['colors', 'colors'],
    ])
    expect(normalizeTokensConfig({ tokens: { colors: ['red'] } })).toStrictEqual([
      ['colors-red', 'colors.red'],
    ])
  })

  test('it handles recursive token configs', ({ expect }) => {
    expect(
      normalizeTokensConfig({ tokens: { colors: { red: true, green: ['100', '200', '200'] } } })
    ).toStrictEqual([
      ['colors-red', 'colors.red'],
      ['colors-green-100', 'colors.green.100'],
      ['colors-green-200', 'colors.green.200'],
    ])
  })

  test('it handles single aliases', ({ expect }) => {
    expect(
      normalizeTokensConfig({ tokens: { colors: { as: 'coloring', values: ['red', 'blue'] } } })
    ).toStrictEqual([
      ['coloring-red', 'colors.red'],
      ['coloring-blue', 'colors.blue'],
    ])
  })

  test('it handles lists of aliases', ({ expect }) => {
    expect(
      normalizeTokensConfig({
        tokens: {
          colors: [
            { as: 'coloring', values: ['blue', 'green'] },
            { as: 'colorfulness', values: ['blue', 'green'] },
          ],
        },
      })
    ).toStrictEqual([
      ['coloring-blue', 'colors.blue'],
      ['coloring-green', 'colors.green'],
      ['colorfulness-blue', 'colors.blue'],
      ['colorfulness-green', 'colors.green'],
    ])
  })

  test('it handles a theme prefix', ({ expect }) => {
    expect(normalizeTokensConfig({ tokens: { colors: true }, prefix: 'app' })).toStrictEqual([
      ['app-colors', 'colors'],
    ])
    expect(
      normalizeTokensConfig({ tokens: { colors: ['red', 'blue'] }, prefix: 'app' })
    ).toStrictEqual([
      ['app-colors-red', 'colors.red'],
      ['app-colors-blue', 'colors.blue'],
    ])
    expect(
      normalizeTokensConfig({ tokens: { colors: { red: ['100', '200'] } }, prefix: 'app' })
    ).toStrictEqual([
      ['app-colors-red-100', 'colors.red.100'],
      ['app-colors-red-200', 'colors.red.200'],
    ])
    expect(
      normalizeTokensConfig({
        tokens: { colors: { as: 'coloring', values: ['red', 'blue'] } },
        prefix: 'app',
      })
    ).toStrictEqual([
      ['app-coloring-red', 'colors.red'],
      ['app-coloring-blue', 'colors.blue'],
    ])
    expect(
      normalizeTokensConfig({
        tokens: {
          colors: [
            { as: 'coloring', values: ['red', 'blue'] },
            { as: 'colorfulness', values: { red: ['100', '200'] } },
          ],
        },
        prefix: 'app',
      })
    ).toStrictEqual([
      ['app-coloring-red', 'colors.red'],
      ['app-coloring-blue', 'colors.blue'],
      ['app-colorfulness-red-100', 'colors.red.100'],
      ['app-colorfulness-red-200', 'colors.red.200'],
    ])
  })

  test('it trims whitespace', ({ expect }) => {
    expect(normalizeTokensConfig({ tokens: { colors: [' '] } })).toStrictEqual([
      ['colors', 'colors'],
    ])
    expect(normalizeTokensConfig({ tokens: { colors: [' red'] } })).toStrictEqual([
      ['colors-red', 'colors.red'],
    ])
    expect(
      normalizeTokensConfig({ tokens: { colors: { as: ' colorful ', values: ['red '] } } })
    ).toStrictEqual([['colorful-red', 'colors.red']])
    expect(normalizeTokensConfig({ tokens: { colors: { ' red ': true } } })).toStrictEqual([
      ['colors-red', 'colors.red'],
    ])
  })
})
