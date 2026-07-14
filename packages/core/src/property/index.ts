import * as PropertyRuleNs from './propertyRule.ts'
import * as PropertySyntaxNs from './propertySyntax.ts'

export type PropertyRule = PropertyRuleNs.PropertyRule
export type PropertySyntax<V = PropertySyntaxNs.Value> = PropertySyntaxNs.PropertySyntax<V>

export { PropertyRuleNs as PropertyRule }
export { PropertySyntaxNs as PropertySyntax }
