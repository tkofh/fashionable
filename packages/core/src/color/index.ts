import * as ColorNs from './color.ts'

export type Color<Refs extends string = string> = ColorNs.Color<Refs>

export { ColorNs as Color }
