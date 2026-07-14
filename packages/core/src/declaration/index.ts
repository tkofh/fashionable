import * as DeclarationNs from './declaration.ts'

export type Declaration<Refs extends string = string> = DeclarationNs.Declaration<Refs>

export { DeclarationNs as Declaration }
