export type VariantValue = string | string[]
type BooleanMap<T> = T extends 'true' | 'false' ? boolean : T
export type VariantsDefinition = Record<string, Record<string, VariantValue>>
export type VariantsInput<Variants extends VariantsDefinition> = {
  [Variant in keyof Variants]?: BooleanMap<keyof Variants[Variant]>
}
export interface CompoundVariant<Variants extends VariantsDefinition> {
  when: VariantsInput<Variants>
  value: VariantValue
}
export interface SpecDefinition<Variants extends VariantsDefinition> {
  base?: VariantValue
  variants?: Variants
  defaults?: VariantsInput<Variants>
  compound?: Array<CompoundVariant<Variants>>
}
export type SpecFn<Variants extends VariantsDefinition> = (
  options?: VariantsInput<Variants>
) => string

export type SpecInput<TSpecFn extends SpecFn<VariantsDefinition>> = Parameters<TSpecFn>[0]

const NOT_PROD = process.env.NODE_ENV !== 'production'

const valueToSet = (value: VariantValue | undefined): Set<string> => {
  const definedValue = value ?? ''
  const output = new Set<string>()

  for(const member of Array.isArray(definedValue) ? definedValue : [definedValue]) {
    if(member.trim() !== '') {
      for (const element of member.split(/\s/g)) {
        output.add(element)
      }
    }
  }

  return output
}

const matchInput = <Variants extends VariantsDefinition>(input: VariantsInput<Variants>, compare: VariantsInput<Variants>): boolean => {
  let result = true
  for(const [variant, option] of Object.entries(compare)) {
    if(!Object.hasOwn(input, variant) || input[variant] !== option) {
      result = false
    }
  }

  return result
}

export const createSpec = <Variants extends VariantsDefinition>(
  definition: SpecDefinition<Variants>
): SpecFn<Variants> => {
  const base = valueToSet(definition.base)

  const variantMap = new Map<string, Map<string, Set<string>>>()
  if(definition.variants) {
    for(const [name, options] of Object.entries(definition.variants)) {
      const optionsMap = new Map<string, Set<string>>()
      for(const [optionName, optionValue] of Object.entries(options)) {
        optionsMap.set(optionName, valueToSet(optionValue))
      }

      variantMap.set(name, optionsMap)
    }
  }

  const compoundVariants = new Map<VariantsInput<Variants>, Set<string>>()
  if(definition.compound) {
    for(const compoundVariant of definition.compound) {
      compoundVariants.set(compoundVariant.when, valueToSet(compoundVariant.value))
    }
  }

  return (input) => {
    const output = new Set(base)

    const selectedVariants = Object.assign({}, definition.defaults ?? {}, input ?? {}) as VariantsInput<Variants>

    for(const [variant, option] of Object.entries(selectedVariants) as [string, string | boolean][]) {
      const optionMap = variantMap.get(variant)!
      if(!optionMap) {
        if(NOT_PROD) {
          // eslint-disable-next-line no-console
          console.warn(`[createSpec] unrecognized variant name: ${variant}`)
        }
        continue
      }
      const optionSet = optionMap.get(String(option))!
      if(!optionSet) {
        if(NOT_PROD) {
          // eslint-disable-next-line no-console
          console.warn(`[createSpec] unrecognized value for variant ${variant}: ${String(option)}`)
        }
        continue
      }
      for(const member of optionSet) {
        if(!output.has(member)) {
          output.add(member)
        }
      }
    }

    for(const compoundVariant of compoundVariants.keys()) {
      if(matchInput(selectedVariants, compoundVariant)) {
        for(const member of compoundVariants.get(compoundVariant)!) {
          output.add(member)
        }
      }
    }

    return Array.from(output).join(' ')
  }
}
