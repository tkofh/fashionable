import type {
  Entries,
  NormalizedScreen,
  NormalizedScreenValue,
  PluginOptions,
  ScreenConfig,
  ScreensConfig,
} from './types'

const resolveScreenValue = (value: ScreenConfig): NormalizedScreenValue => {
  if ('raw' in value) {
    return { raw: value.raw }
  } else {
    const resolved: NormalizedScreenValue = {}

    if ('min' in value) {
      resolved.min = value.min
    } else if ('min-width' in value) {
      resolved.min = value['min-width']
    }

    if ('max' in value) {
      resolved.max = value.max
    }

    return resolved
  }
}

const normalizeScreens = (
  screens: ScreensConfig | Entries<Exclude<ScreensConfig, string[]>>,
  root = true
): NormalizedScreen[] => {
  if (Array.isArray(screens)) {
    return screens.map((screen) => {
      if (root && Array.isArray(screen)) {
        throw new Error('The tuple syntax is not supported for `screens`.')
      }

      if (typeof screen === 'string') {
        return { name: screen.toString(), not: false, values: [{ min: screen }] }
      }

      const name = screen[0].toString()
      const options = screen[1]

      if (typeof options === 'string') {
        return { name, not: false, values: [{ min: options, max: undefined }] }
      }

      if (Array.isArray(options)) {
        return { name, not: false, values: options.map((option) => resolveScreenValue(option)) }
      }

      return { name, not: false, values: [resolveScreenValue(options)] }
    })
  }

  return normalizeScreens(Object.entries(screens ?? {}), false)
}

export const getPluginScreens = (
  themeScreens: ScreensConfig,
  options: PluginOptions
): NormalizedScreen[] => {
  const normalizedThemeScreens = normalizeScreens(themeScreens)

  const screens = options.orderedBreakpoints.map((breakpoint) =>
    normalizedThemeScreens.find((screen) => screen.name === breakpoint)
  )

  for (const [index, screen] of screens.entries()) {
    if (screen == null) {
      throw new Error(
        `[@fashionable/tailwind-rvars]: Missing breakpoint ${
          options.orderedBreakpoints![index]
        }. Please make sure this breakpoint is defined in the Tailwind Config's theme.screens map.`
      )
    }
    if (
      screen.not ||
      screen.values.some(
        (value) => value.max !== undefined || value.raw !== undefined || value.min === undefined
      )
    ) {
      throw new Error(
        '[@fashionable/tailwind-rvars]: max-width or raw screen detected. This plugin only supports simple min-width media queries. Please specify which screens to include in the options passed to this plugin.'
      )
    }
  }

  return screens as NormalizedScreen[]
}

export const toMediaQueryString = (screen: NormalizedScreen) => {
  const values = screen.values.map((screen) => {
    if (screen.raw !== undefined) {
      return screen.raw
    }

    return [screen.min && `(min-width: ${screen.min})`, screen.max && `(max-width: ${screen.max})`]
      .filter(Boolean)
      .join(' and ')
  })

  return screen.not ? `not all and ${values}` : values
}
