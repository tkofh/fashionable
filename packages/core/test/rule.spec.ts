import { describe, expect, test } from 'vitest'
import { Calc } from '#calc'
import { Declaration } from '#declaration'
import { MediaQuery } from '#query'
import { MediaRule, RuleSet, StyleRule } from '#rule'
import { Selector } from '#selector'

describe('rule', () => {
  const color = Declaration.make('color', 'red')
  const depth = Declaration.make('--depth', Calc.var('depth'))

  describe('RuleSet', () => {
    test('isEmpty is structural member absence', () => {
      expect(RuleSet.isEmpty(RuleSet.empty)).toBe(true)
      expect(RuleSet.isEmpty(RuleSet.make())).toBe(true)
      expect(RuleSet.isEmpty(RuleSet.make(color))).toBe(false)
    })

    test('preserves member order', () => {
      const set = RuleSet.make(color, depth)
      expect(set.members[0]).toBe(color)
      expect(set.members[1]).toBe(depth)
    })

    test('declarations trailing a nested rule keep their position', () => {
      const nested = StyleRule.make(Selector.class('btn'), RuleSet.make(color))
      const set = RuleSet.make(color, nested, depth)
      expect(set.members[0]).toBe(color)
      expect(set.members[1]).toBe(nested)
      expect(set.members[2]).toBe(depth)
    })

    test('duplicates are kept', () => {
      expect(RuleSet.make(color, color).members).toHaveLength(2)
    })

    test('make() is the empty block', () => {
      expect(RuleSet.equals(RuleSet.make(), RuleSet.empty)).toBe(true)
      expect(RuleSet.empty.members).toHaveLength(0)
    })

    test('append adds at the end without mutating', () => {
      const set = RuleSet.make(color)
      const appended = RuleSet.append(set, depth)
      expect(appended.members).toHaveLength(2)
      expect(appended.members[1]).toBe(depth)
      expect(set.members).toHaveLength(1)
    })

    test('supports data-last append through pipe', () => {
      const appended = RuleSet.make(color).pipe(RuleSet.append(depth))
      expect(appended.members[1]).toBe(depth)
    })

    test('append builds a style rule from selector and block', () => {
      const block = RuleSet.make(color)
      const appended = RuleSet.append(RuleSet.make(depth), Selector.class('btn'), block)
      const member = appended.members[1]
      expect(StyleRule.isStyleRule(member)).toBe(true)
      expect(member).toStructurallyEqual(StyleRule.make(Selector.class('btn'), block))
    })

    test('append builds a media rule from query and block', () => {
      const block = RuleSet.make(color)
      const appended = RuleSet.make(depth).pipe(RuleSet.append(MediaQuery.minWidth(768), block))
      const member = appended.members[1]
      expect(MediaRule.isMediaRule(member)).toBe(true)
      expect(member).toStructurallyEqual(MediaRule.make(MediaQuery.minWidth(768), block))
    })

    test('forSelector lifts a block into a style rule', () => {
      const block = RuleSet.make(depth)
      const rule = RuleSet.forSelector(block, Selector.class('btn'))
      expect(StyleRule.isStyleRule(rule)).toBe(true)
      expect(rule).toStructurallyEqual(StyleRule.make(Selector.class('btn'), block))
    })

    test('supports data-last forSelector through pipe', () => {
      const rule = RuleSet.make(depth).pipe(RuleSet.forSelector(Selector.root))
      expect(rule).toStructurallyEqual(StyleRule.make(Selector.root, RuleSet.make(depth)))
    })

    test('forMediaQuery lifts a block into a media rule', () => {
      const block = RuleSet.make(depth)
      const rule = RuleSet.forMediaQuery(block, MediaQuery.minWidth(768))
      expect(MediaRule.isMediaRule(rule)).toBe(true)
      expect(rule).toStructurallyEqual(MediaRule.make(MediaQuery.minWidth(768), block))
    })

    test('supports data-last forMediaQuery through pipe', () => {
      const rule = RuleSet.make(depth).pipe(
        RuleSet.forMediaQuery(MediaQuery.prefersColorScheme('dark')),
      )
      expect(rule).toStructurallyEqual(
        MediaRule.make(MediaQuery.prefersColorScheme('dark'), RuleSet.make(depth)),
      )
    })

    test('concat keeps left members before right', () => {
      const set = RuleSet.concat(RuleSet.make(color), RuleSet.make(depth))
      expect(set.members[0]).toBe(color)
      expect(set.members[1]).toBe(depth)
    })

    test('concat with empty is identity up to equality', () => {
      const set = RuleSet.make(color, depth)
      expect(RuleSet.equals(RuleSet.concat(set, RuleSet.empty), set)).toBe(true)
      expect(RuleSet.equals(RuleSet.concat(RuleSet.empty, set), set)).toBe(true)
    })

    test('refs union across members and through nesting', () => {
      const nested = StyleRule.make(
        Selector.class('btn'),
        RuleSet.make(Declaration.make('--a', Calc.var('a'))),
      )
      const media = MediaRule.make(
        MediaQuery.minWidth(768),
        RuleSet.make(Declaration.make('--b', Calc.var('b'))),
      )
      expect(RuleSet.vars(RuleSet.make(depth, nested, media))).toEqual(new Set(['depth', 'a', 'b']))
    })
  })

  describe('StyleRule', () => {
    test('exposes selector and block', () => {
      const block = RuleSet.make(color)
      const rule = StyleRule.make(Selector.root, block)
      expect(rule.selector).toBe(Selector.root)
      expect(rule.block).toBe(block)
    })

    test('refs are the block refs', () => {
      const rule = StyleRule.make(Selector.root, RuleSet.make(depth))
      expect(StyleRule.vars(rule)).toEqual(new Set(['depth']))
    })

    test('media rules nest inside a style rule block', () => {
      const rule = StyleRule.make(
        Selector.root,
        RuleSet.make(
          depth,
          MediaRule.make(MediaQuery.prefersColorScheme('dark'), RuleSet.make(color)),
        ),
      )
      expect(rule.block.members).toHaveLength(2)
      expect(MediaRule.isMediaRule(rule.block.members[1])).toBe(true)
    })
  })

  describe('MediaRule', () => {
    test('exposes query and block', () => {
      const query = MediaQuery.minWidth(768)
      const block = RuleSet.make(color)
      const rule = MediaRule.make(query, block)
      expect(rule.query).toBe(query)
      expect(rule.block).toBe(block)
    })

    test('refs are the block refs', () => {
      const rule = MediaRule.make(MediaQuery.minWidth(768), RuleSet.make(depth))
      expect(MediaRule.vars(rule)).toEqual(new Set(['depth']))
    })
  })

  describe('equality', () => {
    test('rule set equality is order-sensitive', () => {
      expect(RuleSet.equals(RuleSet.make(color, depth), RuleSet.make(depth, color))).toBe(false)
    })

    test('nested structures compare structurally', () => {
      const a = StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--x', Calc.var('u'))))
      const b = StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--x', Calc.var('u'))))
      expect(StyleRule.equals(a, b)).toBe(true)
      expect(a).toStructurallyEqual(b)
    })

    test('style rules differ by selector and by block', () => {
      const block = RuleSet.make(color)
      const rule = StyleRule.make(Selector.root, block)
      expect(StyleRule.equals(rule, StyleRule.make(Selector.class('a'), block))).toBe(false)
      expect(StyleRule.equals(rule, StyleRule.make(Selector.root, RuleSet.empty))).toBe(false)
    })

    test('media rules differ by query and by block', () => {
      const block = RuleSet.make(color)
      const rule = MediaRule.make(MediaQuery.minWidth(768), block)
      expect(MediaRule.equals(rule, MediaRule.make(MediaQuery.minWidth(1024), block))).toBe(false)
      expect(MediaRule.equals(rule, MediaRule.make(MediaQuery.minWidth(768), RuleSet.empty))).toBe(
        false,
      )
    })

    test('supports data-last comparison', () => {
      const set = RuleSet.make(color)
      expect(set.pipe(RuleSet.equals(RuleSet.make(color)))).toBe(true)
    })
  })

  describe('guards', () => {
    test('each guard accepts its own kind and rejects the rest', () => {
      const set = RuleSet.make(color)
      const style = StyleRule.make(Selector.root, set)
      const media = MediaRule.make(MediaQuery.minWidth(768), set)
      expect(RuleSet.isRuleSet(set)).toBe(true)
      expect(RuleSet.isRuleSet(style)).toBe(false)
      expect(RuleSet.isRuleSet(null)).toBe(false)
      expect(StyleRule.isStyleRule(style)).toBe(true)
      expect(StyleRule.isStyleRule(media)).toBe(false)
      expect(MediaRule.isMediaRule(media)).toBe(true)
      expect(MediaRule.isMediaRule(color)).toBe(false)
    })
  })

  describe('nesting binder', () => {
    test('accepts nested rules whose selectors reference &', () => {
      const rule = StyleRule.make(
        Selector.class('red'),
        RuleSet.make(
          StyleRule.make(
            Selector.and(Selector.nest, Selector.class('active')),
            RuleSet.make(color),
          ),
        ),
      )
      expect(StyleRule.render(rule)).toBe('.red {\n\t&.active {\n\t\tcolor: red;\n\t}\n}')
    })

    test('rejects a nested rule whose selector does not reference &', () => {
      expect(() =>
        StyleRule.make(
          Selector.class('red'),
          RuleSet.make(StyleRule.make(Selector.class('active'), RuleSet.make(color))),
        ),
      ).toThrow('must reference its parent')
    })

    test('the walk descends through media rules', () => {
      const media = MediaRule.make(
        MediaQuery.minWidth(768),
        RuleSet.make(StyleRule.make(Selector.class('active'), RuleSet.make(color))),
      )
      expect(() => StyleRule.make(Selector.class('red'), RuleSet.make(media))).toThrow(
        'must reference its parent',
      )
    })

    test('the walk stops at nested style rules — each binder checks its own block', () => {
      const inner = StyleRule.make(
        Selector.and(Selector.nest, Selector.pseudoClass('hover')),
        RuleSet.make(color),
      )
      const middle = StyleRule.make(
        Selector.and(Selector.nest, Selector.class('mid')),
        RuleSet.make(inner),
      )
      const outer = StyleRule.make(Selector.class('out'), RuleSet.make(middle))
      expect(StyleRule.render(outer)).toBe(
        '.out {\n\t&.mid {\n\t\t&:hover {\n\t\t\tcolor: red;\n\t\t}\n\t}\n}',
      )
    })

    test('forSelector runs the binder check', () => {
      const block = RuleSet.make(StyleRule.make(Selector.class('active'), RuleSet.make(color)))
      expect(() => block.pipe(RuleSet.forSelector(Selector.class('red')))).toThrow(
        'must reference its parent',
      )
    })
  })
})
