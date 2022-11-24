import type { PluginOptions as RVarsPluginOptions } from '@fashionable/tailwind-plugin-rvars'
import type { PluginOptions as ThemeTokensPluginOptions } from '@fashionable/tailwind-plugin-theme-tokens'

export interface PluginOptions {
  rvars: RVarsPluginOptions | false
  themeTokens: ThemeTokensPluginOptions | false
}
