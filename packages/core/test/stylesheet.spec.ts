import { describe, expect, test } from 'vitest'
import { Calc } from '../src/calc/index.ts'
import { Declaration } from '../src/declaration/index.ts'
import { FontFaceRule } from '../src/fontFace/index.ts'
import { PropertyRule, PropertySyntax } from '../src/property/index.ts'
import { RuleSet, StyleRule } from '../src/rule/index.ts'
import { Selector } from '../src/selector/index.ts'
import { Stylesheet } from '../src/stylesheet/index.ts'

describe('stylesheet', () => {
  const depthRegistration = PropertyRule.make('--depth', PropertySyntax.number, 0)
  const buttonRule = StyleRule.make(
    Selector.class('btn'),
    RuleSet.make(Declaration.make('--indent', Calc.multiply(Calc.ref('depth'), 8))),
  )
  const cardRule = StyleRule.make(
    Selector.class('card'),
    RuleSet.make(Declaration.make('color', 'red')),
  )
  const inter = FontFaceRule.make({ family: 'Inter', src: [FontFaceRule.local('Inter')] })

  describe('construction', () => {
    test('preserves node order', () => {
      const sheet = Stylesheet.make(depthRegistration, buttonRule, inter)
      expect(sheet.nodes[0]).toBe(depthRegistration)
      expect(sheet.nodes[1]).toBe(buttonRule)
      expect(sheet.nodes[2]).toBe(inter)
    })

    test('drops structural duplicates, first occurrence winning', () => {
      const again = PropertyRule.make('--depth', PropertySyntax.number, 0)
      const sheet = Stylesheet.make(depthRegistration, buttonRule, again)
      expect(sheet.nodes).toHaveLength(2)
      expect(sheet.nodes[0]).toBe(depthRegistration)
    })

    test('make() is the empty sheet', () => {
      expect(Stylesheet.make()).toBe(Stylesheet.empty)
      expect(Stylesheet.empty.nodes).toHaveLength(0)
    })

    test('append adds at the end without mutating', () => {
      const sheet = Stylesheet.make(depthRegistration)
      const appended = Stylesheet.append(sheet, buttonRule)
      expect(appended.nodes).toHaveLength(2)
      expect(appended.nodes[1]).toBe(buttonRule)
      expect(sheet.nodes).toHaveLength(1)
    })

    test('appending a node already present returns the same sheet', () => {
      const sheet = Stylesheet.make(depthRegistration, buttonRule)
      const again = PropertyRule.make('--depth', PropertySyntax.number, 0)
      expect(Stylesheet.append(sheet, again)).toBe(sheet)
    })

    test('supports data-last append through pipe', () => {
      const appended = Stylesheet.make(depthRegistration).pipe(Stylesheet.append(buttonRule))
      expect(appended.nodes[1]).toBe(buttonRule)
    })

    test('append builds a style rule from selector and block', () => {
      const block = RuleSet.make(Declaration.make('color', 'red'))
      const appended = Stylesheet.empty.pipe(Stylesheet.append(Selector.class('card'), block))
      expect(appended.nodes[0]).toStructurallyEqual(StyleRule.make(Selector.class('card'), block))
    })

    test('append from parts deduplicates like append of the built rule', () => {
      const block = RuleSet.make(Declaration.make('color', 'red'))
      const sheet = Stylesheet.make(StyleRule.make(Selector.class('card'), block))
      expect(Stylesheet.append(sheet, Selector.class('card'), block)).toBe(sheet)
    })
  })

  describe('merge', () => {
    test('keeps left nodes before right', () => {
      const merged = Stylesheet.merge(Stylesheet.make(depthRegistration), Stylesheet.make(inter))
      expect(merged.nodes[0]).toBe(depthRegistration)
      expect(merged.nodes[1]).toBe(inter)
    })

    test('collapses shared nodes to the first occurrence', () => {
      const emitterA = Stylesheet.make(depthRegistration, buttonRule)
      const emitterB = Stylesheet.make(
        PropertyRule.make('--depth', PropertySyntax.number, 0),
        cardRule,
      )
      const merged = Stylesheet.merge(emitterA, emitterB)
      expect(merged.nodes).toHaveLength(3)
      expect(merged.nodes[0]).toBe(depthRegistration)
      expect(merged.nodes[1]).toBe(buttonRule)
      expect(merged.nodes[2]).toBe(cardRule)
    })

    test('is associative', () => {
      const a = Stylesheet.make(depthRegistration, buttonRule)
      const b = Stylesheet.make(buttonRule, cardRule)
      const c = Stylesheet.make(cardRule, inter)
      expect(Stylesheet.merge(Stylesheet.merge(a, b), c)).toStructurallyEqual(
        Stylesheet.merge(a, Stylesheet.merge(b, c)),
      )
    })

    test('empty is the identity on both sides', () => {
      const sheet = Stylesheet.make(depthRegistration, buttonRule)
      expect(Stylesheet.merge(sheet, Stylesheet.empty)).toBe(sheet)
      expect(Stylesheet.merge(Stylesheet.empty, sheet)).toBe(sheet)
    })

    test('is idempotent', () => {
      const sheet = Stylesheet.make(depthRegistration, buttonRule)
      expect(Stylesheet.merge(sheet, sheet)).toBe(sheet)
    })

    test('supports data-last merge through pipe', () => {
      const merged = Stylesheet.make(depthRegistration).pipe(
        Stylesheet.merge(Stylesheet.make(cardRule)),
      )
      expect(merged.nodes).toHaveLength(2)
    })

    test('mergeAll folds emitters in order, sharing the contract', () => {
      const contract = Stylesheet.make(depthRegistration)
      const emitters = [
        Stylesheet.merge(contract, Stylesheet.make(buttonRule)),
        Stylesheet.merge(contract, Stylesheet.make(cardRule)),
        Stylesheet.merge(contract, Stylesheet.make(inter)),
      ]
      const merged = Stylesheet.mergeAll(emitters)
      expect(merged.nodes).toHaveLength(4)
      expect(merged.nodes[0]).toBe(depthRegistration)
      expect(merged.nodes[1]).toBe(buttonRule)
      expect(merged.nodes[2]).toBe(cardRule)
      expect(merged.nodes[3]).toBe(inter)
    })

    test('mergeAll of nothing is the empty sheet', () => {
      expect(Stylesheet.mergeAll([])).toBe(Stylesheet.empty)
    })

    test('mergeAll of one sheet is that sheet', () => {
      const sheet = Stylesheet.make(depthRegistration)
      expect(Stylesheet.mergeAll([sheet])).toBe(sheet)
    })
  })

  describe('coalesce', () => {
    const blockA = RuleSet.make(Declaration.make('color', 'red'))
    const blockB = RuleSet.make(Declaration.make('background', 'blue'))

    test('merges same-selector rules into the first occurrence', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(Selector.root, blockA),
        cardRule,
        StyleRule.make(Selector.root, blockB),
      )
      const coalesced = Stylesheet.coalesce(sheet)
      expect(coalesced.nodes).toHaveLength(2)
      expect(coalesced.nodes[0]).toStructurallyEqual(
        StyleRule.make(Selector.root, RuleSet.concat(blockA, blockB)),
      )
      expect(coalesced.nodes[1]).toBe(cardRule)
    })

    test('concatenates blocks in sheet order', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(Selector.root, blockB),
        StyleRule.make(Selector.root, blockA),
      )
      const coalesced = Stylesheet.coalesce(sheet)
      expect(coalesced.nodes[0]).toStructurallyEqual(
        StyleRule.make(Selector.root, RuleSet.concat(blockB, blockA)),
      )
    })

    test('passes at-rules through untouched, in position', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(Selector.root, blockA),
        inter,
        StyleRule.make(Selector.root, blockB),
        depthRegistration,
      )
      const coalesced = Stylesheet.coalesce(sheet)
      expect(coalesced.nodes).toHaveLength(3)
      expect(coalesced.nodes[1]).toBe(inter)
      expect(coalesced.nodes[2]).toBe(depthRegistration)
    })

    test('returns the same sheet when no selector repeats', () => {
      const sheet = Stylesheet.make(StyleRule.make(Selector.root, blockA), cardRule, inter)
      expect(Stylesheet.coalesce(sheet)).toBe(sheet)
    })

    test('is idempotent', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(Selector.root, blockA),
        StyleRule.make(Selector.root, blockB),
      )
      const once = Stylesheet.coalesce(sheet)
      expect(Stylesheet.coalesce(once)).toBe(once)
    })
  })

  describe('refs', () => {
    test('unions across style rules', () => {
      const themed = StyleRule.make(
        Selector.root,
        RuleSet.make(Declaration.make('--accent', Calc.ref('hue'))),
      )
      expect(Stylesheet.refs(Stylesheet.make(buttonRule, themed))).toEqual(
        new Set(['depth', 'hue']),
      )
    })

    test('at-rules contribute nothing', () => {
      expect(Stylesheet.refs(Stylesheet.make(inter, depthRegistration))).toEqual(new Set())
    })
  })

  describe('equality', () => {
    test('is order-sensitive', () => {
      expect(
        Stylesheet.equals(
          Stylesheet.make(depthRegistration, buttonRule),
          Stylesheet.make(buttonRule, depthRegistration),
        ),
      ).toBe(false)
    })

    test('compares structurally', () => {
      const a = Stylesheet.make(PropertyRule.make('--depth', PropertySyntax.number, 0), cardRule)
      const b = Stylesheet.make(
        PropertyRule.make('--depth', PropertySyntax.number, 0),
        StyleRule.make(Selector.class('card'), RuleSet.make(Declaration.make('color', 'red'))),
      )
      expect(Stylesheet.equals(a, b)).toBe(true)
    })

    test('guards the brand', () => {
      expect(Stylesheet.isStylesheet(Stylesheet.empty)).toBe(true)
      expect(Stylesheet.isStylesheet(buttonRule)).toBe(false)
    })
  })
})
