import type { PluginCreator } from 'tailwindcss/types/config'
import { resolveThemeTokens } from './lib'
import type { PluginOptions, ThemeOptions } from './types'

const plugin = <TAdditionalConfigKeys extends string = never>(
  options: PluginOptions<TAdditionalConfigKeys>
): { handler: PluginCreator } => ({
  handler: (pluginAPI) => {
    if (options.tokens != null) {
      pluginAPI.addBase({
        ':root': resolveThemeTokens(options as ThemeOptions<TAdditionalConfigKeys>, pluginAPI),
      })
    }
    if (options.themes) {
      pluginAPI.addComponents(
        Object.fromEntries(
          options.themes.map((theme) => {
            const tokens = resolveThemeTokens(theme, pluginAPI)
            return [`.${theme.name}`, tokens]
          })
        )
      )
    }
  },
})
plugin.__isOptionsFunction = true

export { plugin }
