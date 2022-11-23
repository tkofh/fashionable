import type {
  AliasedTokenConfig,
  RecursiveTokenConfig,
  SimpleTokenConfig,
  ThemeOptions,
  TokenConfig,
} from '../types'

const resolveAccessPathTails = (
  input: SimpleTokenConfig | RecursiveTokenConfig,
  base: string[] = []
): string[][] => {
  const trimmedBase = base.map((segment) => segment.trim())
  const accessPaths: string[][] = []
  if (typeof input === 'boolean') {
    if (input === true) {
      accessPaths.push([...trimmedBase])
    }
  } else if (Array.isArray(input)) {
    const trimmedInput = new Set(input.map((segment) => segment.trim()))
    if (trimmedInput.has('') || trimmedInput.size === 0) {
      accessPaths.push([...trimmedBase])
    } else {
      accessPaths.push(...Array.from(trimmedInput).map((path) => [...trimmedBase, path]))
    }
  } else {
    for (const [key, value] of Object.entries(input)) {
      accessPaths.push(...resolveAccessPathTails(value, [...trimmedBase, key]))
    }
  }

  return accessPaths
}

const configIsAliasedConfigList = (config: TokenConfig): config is AliasedTokenConfig[] =>
  Array.isArray(config) && configIsAliasedConfig(config[0])

const configIsAliasedConfig = (config: TokenConfig | string): config is AliasedTokenConfig =>
  typeof config === 'object' &&
  Object.hasOwn(config, 'as') &&
  Object.hasOwn(config, 'values') &&
  Object.keys(config).length === 2

export const normalizeTokensConfig = (theme: ThemeOptions) => {
  const knownAliases = new Map<string, string>()
  let entries: [string, string][] = []
  for (const [tailwindConfigKey, tokenConfig] of Object.entries(theme.tokens)) {
    for (const singleTokenConfig of configIsAliasedConfigList(tokenConfig)
      ? tokenConfig
      : [tokenConfig]) {
      if (configIsAliasedConfig(singleTokenConfig)) {
        const labelBase = (
          theme.prefix ? [theme.prefix, singleTokenConfig.as] : [singleTokenConfig.as]
        ).map((segment) => segment.trim())

        if (knownAliases.has(singleTokenConfig.as)) {
          // eslint-disable-next-line no-console
          console.warn(
            `[@fashionable/tailwind-plugin-theme-tokens]: Duplicate alias '${
              singleTokenConfig.as
            }' in ${knownAliases.get(
              singleTokenConfig.as
            )!} and ${tailwindConfigKey}. The former will be overwritten.`
          )
        }
        knownAliases.set(singleTokenConfig.as, tailwindConfigKey)
        entries = entries.filter((entry) => !entry[0].startsWith(labelBase.join('-')))

        for (const path of resolveAccessPathTails(singleTokenConfig.values)) {
          entries.push([[...labelBase, ...path].join('-'), [tailwindConfigKey, ...path].join('.')])
        }
      } else {
        const labelBase = (
          theme.prefix ? [theme.prefix, tailwindConfigKey] : [tailwindConfigKey]
        ).map((segment) => segment.trim())
        for (const path of resolveAccessPathTails(singleTokenConfig)) {
          entries.push([[...labelBase, ...path].join('-'), [tailwindConfigKey, ...path].join('.')])
        }
      }
    }
  }

  return entries
}
