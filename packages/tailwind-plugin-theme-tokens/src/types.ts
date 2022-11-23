import type { Config } from 'tailwindcss/types'

// type LooseAutocomplete<T extends string> = T | Omit<string, T>
type RemoveIndex<T> = {
  [P in keyof T as string extends P ? never : number extends P ? never : P]: T[P]
}
interface RecursiveRecord<V = string> {
  [key: string]: V | RecursiveRecord<V>
}

type TailwindThemeConfig = Omit<
  RemoveIndex<Required<Exclude<Config['theme'], undefined>>>,
  'extend'
>

export type TailwindThemeValue = string | number | RecursiveRecord<string | number>

export type SimpleTokenConfig = string[] | boolean
export type RecursiveTokenConfig = RecursiveRecord<SimpleTokenConfig>
export interface AliasedTokenConfig {
  as: string
  values: SimpleTokenConfig | RecursiveTokenConfig
}
export type TokenConfig =
  | SimpleTokenConfig
  | RecursiveTokenConfig
  | AliasedTokenConfig
  | AliasedTokenConfig[]

export type TokensConfig<TAdditionalConfigKeys extends string = never> = {
  [K in keyof TailwindThemeConfig | TAdditionalConfigKeys]?: TokenConfig
}

export interface TokenAccessPath {
  label: string
  head: string
  tail: string[]
}

export interface ThemeOptions<TAdditionalConfigKeys extends string = never> {
  prefix?: string
  tokens: TokensConfig<TAdditionalConfigKeys>
}

export interface NamedThemeOptions<TAdditionalConfigKeys extends string = never>
  extends ThemeOptions<TAdditionalConfigKeys> {
  name: string
}

export interface PluginOptions<TAdditionalConfigKeys extends string = never>
  extends Partial<ThemeOptions<TAdditionalConfigKeys>> {
  themes?: NamedThemeOptions<TAdditionalConfigKeys>[]
}
