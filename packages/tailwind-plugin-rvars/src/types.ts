export type Entries<T extends Record<string, unknown>> = T extends Record<infer K, infer V>
  ? [K, V][]
  : never

export interface PluginOptions {
  orderedBreakpoints: string[]
  baseBreakpointName?: string
}

export type ScreenConfig =
  | { raw: string }
  | { min: string }
  | { 'min-width': string }
  | { max: string }
  | { min: string; max: string }

export type ScreensConfig = string[] | Record<string, string | ScreenConfig | ScreenConfig[]>

export interface NormalizedScreenValue {
  min?: string
  max?: string
  raw?: string
}

export interface NormalizedScreen {
  name: string
  not: boolean
  values: NormalizedScreenValue[]
}
