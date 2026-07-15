import { describe, expect, test } from 'vitest'
import { Calc } from '#calc'
import { Declaration } from '#declaration'
import { FontFaceRule } from '#fontFace'
import { PropertyRule, PropertySyntax } from '#property'
import { MediaQuery } from '#query'
import { MediaRule, RuleSet, StyleRule } from '#rule'
import { Selector } from '#selector'
import { Stylesheet } from '#stylesheet'

const w = (px: number) => RuleSet.make(Declaration.make('--w', px))

describe('stylesheet', () => {
  const depthRegistration = PropertyRule.make('--depth', PropertySyntax.number, 0)
  const buttonRule = StyleRule.make(
    Selector.class('btn'),
    RuleSet.make(Declaration.make('--indent', Calc.multiply(Calc.var('depth'), 8))),
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

    test('isEmpty is structural node absence', () => {
      expect(Stylesheet.isEmpty(Stylesheet.empty)).toBe(true)
      expect(Stylesheet.isEmpty(Stylesheet.make())).toBe(true)
      expect(Stylesheet.isEmpty(Stylesheet.make(cardRule))).toBe(false)
    })

    test('a sheet whose every node renders empty renders the empty string', () => {
      expect(Stylesheet.render(Stylesheet.empty)).toBe('')
      const hollow = Stylesheet.make(StyleRule.make(Selector.root, RuleSet.empty))
      expect(Stylesheet.isEmpty(hollow)).toBe(false)
      expect(Stylesheet.render(hollow)).toBe('')
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

    test('strict mode refuses a tie whose moved declaration is not re-established', () => {
      // `.card` (0,1,0) ties `:root` (0,1,0) and sets `color` to a value
      // the moved block does not carry: pulling the second `:root` block
      // above it could change the cascade.
      const sheet = Stylesheet.make(
        StyleRule.make(Selector.root, blockA),
        cardRule,
        StyleRule.make(Selector.root, RuleSet.make(Declaration.make('color', 'blue'))),
      )
      expect(() => Stylesheet.coalesce(sheet, { strict: true })).toThrow(
        "would pull 'color' across '.card'",
      )
      expect(Stylesheet.coalesce(sheet).nodes).toHaveLength(2)
    })

    test('strict mode allows a tie with no property overlap', () => {
      // Same tie, but the moved block sets only `background`, which
      // `.card` never mentions — nothing competes, so the pull is safe.
      const sheet = Stylesheet.make(
        StyleRule.make(Selector.root, blockA),
        cardRule,
        StyleRule.make(Selector.root, blockB),
      )
      const coalesced = Stylesheet.coalesce(sheet, { strict: true })
      expect(coalesced.nodes).toHaveLength(2)
      expect(coalesced.nodes[0]).toStructurallyEqual(
        StyleRule.make(Selector.root, RuleSet.concat(blockA, blockB)),
      )
    })

    test('strict mode allows pulls across other specificities and at-rules', () => {
      const sheet = Stylesheet.make(
        StyleRule.make(Selector.root, blockA),
        StyleRule.make(Selector.id('app'), blockB),
        inter,
        depthRegistration,
        StyleRule.make(Selector.root, blockB),
      )
      const coalesced = Stylesheet.coalesce(sheet, { strict: true })
      expect(coalesced.nodes).toHaveLength(4)
      expect(coalesced.nodes[0]).toStructurallyEqual(
        StyleRule.make(Selector.root, RuleSet.concat(blockA, blockB)),
      )
    })

    describe('strict shadow check', () => {
      // The scheme-mirror shapes from docs/feedback-dtcg-resolver.md:
      // both selectors compute to specificity (0,2,0), so every pull
      // across the other half is a tie the shadow check must decide.
      const darkToggle = Selector.root.pipe(Selector.and(Selector.attribute('data-scheme', 'dark')))
      const notLight = Selector.root.pipe(
        Selector.and(Selector.not(Selector.attribute('data-scheme', 'light'))),
      )
      const prefersDark = MediaQuery.prefersColorScheme('dark')
      const wide = MediaQuery.minWidth(1280)

      test('allows the scheme mirror: every moved declaration is re-established', () => {
        // The re-establishing `(min-width: 1280px)` setter arrives from
        // the fourth rule — after the moved third block — so this also
        // pins the check reading the crossed rule's final members, not
        // its members at encounter time.
        const sheet = Stylesheet.make(
          StyleRule.make(notLight, RuleSet.make(MediaRule.make(prefersDark, w(375)))),
          StyleRule.make(darkToggle, w(375)),
          StyleRule.make(
            notLight,
            RuleSet.make(MediaRule.make(MediaQuery.and(prefersDark, wide), w(475))),
          ),
          StyleRule.make(darkToggle, RuleSet.make(MediaRule.make(wide, w(475)))),
        )
        const strict = Stylesheet.coalesce(sheet, { strict: true })
        expect(strict).toStructurallyEqual(Stylesheet.coalesce(sheet))
        expect(Stylesheet.render(strict)).toBe(Stylesheet.render(Stylesheet.coalesce(sheet)))
        // The gated output has no repeated selectors, so re-running the
        // gate is a no-op — the oracle can run on its own result.
        expect(Stylesheet.coalesce(strict, { strict: true })).toBe(strict)
      })

      test('refuses the asymmetric producer: no toggle-side re-establishment', () => {
        const sheet = Stylesheet.make(
          StyleRule.make(notLight, RuleSet.make(MediaRule.make(prefersDark, w(375)))),
          StyleRule.make(darkToggle, w(375)),
          StyleRule.make(
            notLight,
            RuleSet.make(MediaRule.make(MediaQuery.and(prefersDark, wide), w(475))),
          ),
        )
        expect(() => Stylesheet.coalesce(sheet, { strict: true })).toThrow(
          "would pull '--w' across ':root[data-scheme='dark']'",
        )
      })

      test('refuses a partial shadow: a sibling moved declaration diverges', () => {
        const sheet = Stylesheet.make(
          StyleRule.make(notLight, RuleSet.make(MediaRule.make(prefersDark, w(375)))),
          StyleRule.make(
            darkToggle,
            RuleSet.make(
              Declaration.make('--w', 375),
              Declaration.make('--x', 2),
              MediaRule.make(wide, RuleSet.make(Declaration.make('--w', 475))),
            ),
          ),
          StyleRule.make(
            notLight,
            RuleSet.make(
              MediaRule.make(
                MediaQuery.and(prefersDark, wide),
                RuleSet.make(Declaration.make('--w', 475), Declaration.make('--x', 1)),
              ),
            ),
          ),
        )
        expect(() => Stylesheet.coalesce(sheet, { strict: true })).toThrow("would pull '--x'")
      })

      test('refuses a later divergent setter under a co-satisfiable query', () => {
        const sheet = Stylesheet.make(
          StyleRule.make(notLight, RuleSet.make(MediaRule.make(prefersDark, w(375)))),
          StyleRule.make(
            darkToggle,
            RuleSet.make(
              MediaRule.make(wide, RuleSet.make(Declaration.make('--w', 475))),
              Declaration.make('--w', 375),
            ),
          ),
          StyleRule.make(
            notLight,
            RuleSet.make(MediaRule.make(MediaQuery.and(prefersDark, wide), w(475))),
          ),
        )
        expect(() => Stylesheet.coalesce(sheet, { strict: true })).toThrow('later diverges')
      })

      test('ignores divergent setters whose queries cannot co-hold', () => {
        // `prefers-color-scheme: light` conflicts with the moved block's
        // dark scheme; `max-width: 800` empties the width interval
        // against its `min-width: 1280`. Neither can apply in a state
        // where the moved declaration does.
        const sheet = Stylesheet.make(
          StyleRule.make(notLight, RuleSet.make(MediaRule.make(prefersDark, w(375)))),
          StyleRule.make(
            darkToggle,
            RuleSet.make(
              MediaRule.make(wide, RuleSet.make(Declaration.make('--w', 475))),
              MediaRule.make(
                MediaQuery.prefersColorScheme('light'),
                RuleSet.make(Declaration.make('--w', 999)),
              ),
              MediaRule.make(MediaQuery.maxWidth(800), RuleSet.make(Declaration.make('--w', 999))),
            ),
          ),
          StyleRule.make(
            notLight,
            RuleSet.make(MediaRule.make(MediaQuery.and(prefersDark, wide), w(475))),
          ),
        )
        expect(Stylesheet.coalesce(sheet, { strict: true }).nodes).toHaveLength(2)
      })

      test('refuses two moved setters of one property diverging under co-satisfiable queries', () => {
        // Conservative: this twin block is order-preserved and safe, but
        // proving that needs joint reasoning the check does not attempt —
        // each declaration is checked independently, and the crossed
        // rule's other setter breaks its condition 2.
        const twin = () =>
          RuleSet.make(
            MediaRule.make(prefersDark, RuleSet.make(Declaration.make('--w', 400))),
            MediaRule.make(MediaQuery.minWidth(600), RuleSet.make(Declaration.make('--w', 500))),
          )
        const sheet = Stylesheet.make(
          StyleRule.make(notLight, w(300)),
          StyleRule.make(darkToggle, twin()),
          StyleRule.make(notLight, twin()),
        )
        expect(() => Stylesheet.coalesce(sheet, { strict: true })).toThrow('later diverges')
      })

      test('refuses blocks that nest beyond the shadow check', () => {
        const nested = RuleSet.make(
          Declaration.make('--w', 400),
          StyleRule.make(Selector.pseudoClass('hover'), w(475)),
        )
        const crossedNests = Stylesheet.make(
          StyleRule.make(notLight, w(375)),
          StyleRule.make(darkToggle, nested),
          StyleRule.make(notLight, w(400)),
        )
        expect(() => Stylesheet.coalesce(crossedNests, { strict: true })).toThrow(
          'nests beyond the shadow check',
        )
        const movedNests = Stylesheet.make(
          StyleRule.make(notLight, w(375)),
          StyleRule.make(darkToggle, w(375)),
          StyleRule.make(notLight, nested),
        )
        expect(() => Stylesheet.coalesce(movedNests, { strict: true })).toThrow(
          'nests beyond the shadow check',
        )
      })

      test('accepts re-establishment under any implied query, not only the exact one', () => {
        // The `--w` witness sits under `(min-width: 800px)`, implied by
        // the moved `1280`; the `--h` witness under `(max-width: 800px)`,
        // implied by the moved `600`. The crossed rule's bare `--w: 300`
        // diverges but sits before the witness, which shadows it.
        const sheet = Stylesheet.make(
          StyleRule.make(notLight, RuleSet.make(MediaRule.make(prefersDark, w(375)))),
          StyleRule.make(
            darkToggle,
            RuleSet.make(
              Declaration.make('--w', 300),
              MediaRule.make(MediaQuery.minWidth(800), w(475)),
              MediaRule.make(MediaQuery.maxWidth(800), RuleSet.make(Declaration.make('--h', 320))),
            ),
          ),
          StyleRule.make(
            notLight,
            RuleSet.make(
              MediaRule.make(MediaQuery.and(prefersDark, wide), w(475)),
              MediaRule.make(MediaQuery.maxWidth(600), RuleSet.make(Declaration.make('--h', 320))),
            ),
          ),
        )
        expect(Stylesheet.coalesce(sheet, { strict: true }).nodes).toHaveLength(2)
      })

      test('refuses a re-establisher under a query the moved one does not imply', () => {
        // Equal value is not enough: below 1280px the moved declaration
        // applies and the crossed setter does not, so the implication
        // direction is load-bearing.
        const gatedMoved = Stylesheet.make(
          StyleRule.make(notLight, RuleSet.make(MediaRule.make(MediaQuery.minWidth(800), w(475)))),
          StyleRule.make(darkToggle, RuleSet.make(MediaRule.make(wide, w(475)))),
          StyleRule.make(
            notLight,
            RuleSet.make(
              MediaRule.make(MediaQuery.and(prefersDark, MediaQuery.minWidth(800)), w(475)),
            ),
          ),
        )
        expect(() => Stylesheet.coalesce(gatedMoved, { strict: true })).toThrow(
          'without re-establishing',
        )
        const bareMoved = Stylesheet.make(
          StyleRule.make(notLight, RuleSet.make(Declaration.make('--z', 1))),
          StyleRule.make(darkToggle, RuleSet.make(MediaRule.make(wide, w(475)))),
          StyleRule.make(notLight, w(475)),
        )
        expect(() => Stylesheet.coalesce(bareMoved, { strict: true })).toThrow(
          'without re-establishing',
        )
      })

      test('refuses when the only equal-value setter can never apply', () => {
        // `(prefers-color-scheme: dark) and (prefers-color-scheme: light)`
        // matches no state, so the setter under it is no witness — the
        // moved query does not imply it, part by part.
        const unsatisfiable = MediaQuery.and(prefersDark, MediaQuery.prefersColorScheme('light'))
        const sheet = Stylesheet.make(
          StyleRule.make(notLight, RuleSet.make(MediaRule.make(prefersDark, w(375)))),
          StyleRule.make(darkToggle, RuleSet.make(MediaRule.make(unsatisfiable, w(475)))),
          StyleRule.make(
            notLight,
            RuleSet.make(MediaRule.make(MediaQuery.and(prefersDark, wide), w(475))),
          ),
        )
        expect(() => Stylesheet.coalesce(sheet, { strict: true })).toThrow(
          'without re-establishing',
        )
      })

      test('checks every crossed rule: one unshadowing tie refuses', () => {
        // The dark toggle shadows the moved block; the auto toggle ties
        // too and does not — the refusal names it.
        const autoToggle = Selector.root.pipe(
          Selector.and(Selector.attribute('data-scheme', 'auto')),
        )
        const sheet = Stylesheet.make(
          StyleRule.make(notLight, RuleSet.make(MediaRule.make(prefersDark, w(375)))),
          StyleRule.make(
            darkToggle,
            RuleSet.make(Declaration.make('--w', 375), MediaRule.make(wide, w(475))),
          ),
          StyleRule.make(autoToggle, w(111)),
          StyleRule.make(
            notLight,
            RuleSet.make(MediaRule.make(MediaQuery.and(prefersDark, wide), w(475))),
          ),
        )
        expect(() => Stylesheet.coalesce(sheet, { strict: true })).toThrow(
          "across ':root[data-scheme='auto']'",
        )
      })

      test('does not treat a tying rule anchored before the pull as a crossing', () => {
        // The fourth rule's block passes the third rule's original slot,
        // whose `@media` value diverges from its own — but that block
        // folds into the first rule, ahead of the pull's anchor, so their
        // relative order survives the fold and there is nothing to check.
        // Only the third rule's pull crosses anything, and the second
        // rule's final members re-establish it.
        const sheet = Stylesheet.make(
          StyleRule.make(darkToggle, w(375)),
          StyleRule.make(
            notLight,
            RuleSet.make(MediaRule.make(prefersDark, RuleSet.make(Declaration.make('--w', 600)))),
          ),
          StyleRule.make(
            darkToggle,
            RuleSet.make(MediaRule.make(prefersDark, RuleSet.make(Declaration.make('--w', 600)))),
          ),
          StyleRule.make(
            notLight,
            RuleSet.make(
              MediaRule.make(
                MediaQuery.prefersColorScheme('light'),
                RuleSet.make(Declaration.make('--w', 500)),
              ),
            ),
          ),
        )
        const strict = Stylesheet.coalesce(sheet, { strict: true })
        expect(strict).toStructurallyEqual(Stylesheet.coalesce(sheet))
      })

      test('reads final members in the refusing direction: late divergence still refuses', () => {
        // At encounter time the crossed toggle holds only the qualifying
        // `(min-width: 1280px)` setter; the diverging bare `375` arrives
        // from the fourth rule. Conservative: the late `375` wins in both
        // orders here, but condition 2 over the final list does not
        // reason about that.
        const sheet = Stylesheet.make(
          StyleRule.make(notLight, RuleSet.make(MediaRule.make(prefersDark, w(375)))),
          StyleRule.make(darkToggle, RuleSet.make(MediaRule.make(wide, w(475)))),
          StyleRule.make(
            notLight,
            RuleSet.make(MediaRule.make(MediaQuery.and(prefersDark, wide), w(475))),
          ),
          StyleRule.make(darkToggle, w(375)),
        )
        expect(() => Stylesheet.coalesce(sheet, { strict: true })).toThrow('later diverges')
      })
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
        RuleSet.make(Declaration.make('--accent', Calc.var('hue'))),
      )
      expect(Stylesheet.vars(Stylesheet.make(buttonRule, themed))).toEqual(
        new Set(['depth', 'hue']),
      )
    })

    test('at-rules contribute nothing', () => {
      expect(Stylesheet.vars(Stylesheet.make(inter, depthRegistration))).toEqual(new Set())
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
