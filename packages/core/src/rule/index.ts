import * as MediaRuleNs from './mediaRule.ts'
import * as RuleSetNs from './ruleSet.ts'
import * as StyleRuleNs from './styleRule.ts'

export type MediaRule<Refs extends string = string> = MediaRuleNs.MediaRule<Refs>
export type RuleSet<Refs extends string = string> = RuleSetNs.RuleSet<Refs>
export type StyleRule<Refs extends string = string> = StyleRuleNs.StyleRule<Refs>

export { MediaRuleNs as MediaRule }
export { RuleSetNs as RuleSet }
export { StyleRuleNs as StyleRule }
