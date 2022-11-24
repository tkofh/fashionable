import rvars from '@fashionable/tailwind-plugin-rvars'
import themeTokens from '@fashionable/tailwind-plugin-theme-tokens'
import type { PluginCreator } from 'tailwindcss/types/config'
import type { PluginOptions } from './types'

const plugin = (options: PluginOptions): { handler: PluginCreator } => {
  const plugins: PluginCreator[] = []
  if (options.rvars !== false) {
    plugins.push(rvars(options.rvars).handler)
  }
  if (options.themeTokens !== false) {
    plugins.push(themeTokens(options.themeTokens).handler)
  }

  return {
    handler: (pluginAPI) => {
      for (const plugin of plugins) {
        plugin(pluginAPI)
      }
    },
  }
}
plugin.__isOptionsFunction = true

export { plugin }
