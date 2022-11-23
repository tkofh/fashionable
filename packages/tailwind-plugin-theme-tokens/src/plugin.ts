import type { PluginCreator } from 'tailwindcss/types/config'
import { resolveThemeTokens } from './lib'
import type { PluginOptions, ThemeOptions } from './types'

const plugin = <TAdditionalConfigKeys extends string = never>(
  options: PluginOptions<TAdditionalConfigKeys>
): { handler: PluginCreator } => ({
  handler: ({ addBase, addComponents, theme: resolveTailwindThemeValue }) => {
    if (options.tokens != null) {
      addBase({
        ':root': resolveThemeTokens(
          options as ThemeOptions<TAdditionalConfigKeys>,
          resolveTailwindThemeValue
        ),
      })
    }
    if (options.themes) {
      const components = Object.fromEntries(
        options.themes.map((theme) => [
          `.${theme.name}`,
          resolveThemeTokens(theme, resolveTailwindThemeValue),
        ])
      )
      addComponents(components)
    }
  },
})
plugin.__isOptionsFunction = true

export { plugin }
