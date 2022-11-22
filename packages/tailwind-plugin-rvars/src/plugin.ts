import type { PluginCreator } from 'tailwindcss/types/config'
import { getPluginScreens, toMediaQueryString } from './screens'
import type { PluginOptions } from './types'

const plugin = (options: PluginOptions): { handler: PluginCreator } => ({
  handler: ({ matchUtilities, theme }) => {
    const screens = getPluginScreens(theme('screens'), options)
    const baseBreakpointName = options?.baseBreakpointName ?? 'xs'

    matchUtilities(
      {
        rvar: (value) => {
          const [varName, defaultValue = 0] = value.split(',')

          const result: Record<string, string | Record<string, string>> = {}

          result[
            `--i-${varName}-${baseBreakpointName}`
          ] = `var(--${varName}-${baseBreakpointName}, ${defaultValue})`

          result[`--${varName}`] = `var(--i-${varName}-${baseBreakpointName})`

          for (const [index, screen] of screens.entries()) {
            result[`--i-${varName}-${screen.name}`] = `var(--${varName}-${
              screen.name
            }, var(--i-${varName}-${index === 0 ? baseBreakpointName : screens[index - 1].name}))`

            result[`@media ${toMediaQueryString(screen)}`] = {
              [`--${varName}`]: `var(--i-${varName}-${screen.name})`,
            }
          }

          return result
        },
      },
      {
        modifiers: {},
        supportsNegativeValues: true,
        type: 'any',
        respectImportant: true,
        respectPrefix: true,
      }
    )
  },
})
plugin.__isOptionsFunction = true

export { plugin }
