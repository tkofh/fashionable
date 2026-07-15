# Consumer feedback: dtcg-resolver (toward 0.3.0)

Field notes from fashionable's first consumer, round two. Everything from the 0.2.0 round shipped (typed units + context-lowered solve, `tan`/`atan2`, the color coverage, canonical-order stability, the render/QoL items) and the resolver is bumped and green against the release. Adoption state: migration slices 1–3 are in — modeled preludes and nested output, typed requirement/`@font-face` channels, and rank retirement. This round has one subject: what rank retirement revealed about `coalesce`, and the investigation it motivates. (MediaQuery part inspectability is deliberately not specified here — that work is already in flight; §2 notes why the checker turns out not to wait on it.)

Nothing in this document blocks the resolver — it restructured its assembly and shipped. The question is whether `strict` coalesce should be completable into the checkable gate it was built to be.

## 1. The finding: strict coalesce refuses the resolver's real output

The resolver's scheme dimension emits dark values through a **two-rule mirror**: one logical placement, two physical spellings — `@media (prefers-color-scheme: dark)` under `:root:not([data-scheme='light'])`, and the bare manual toggle `:root[data-scheme='dark']`. Both selectors compute to specificity 0-2-0, and every rule behind the gate lands in **both** projections with identical values. When dark values also vary by breakpoint, the pre-coalesce sheet (group-major order) looks like:

```css
:root:not([data-scheme='light']) {
  @media (prefers-color-scheme: dark) {
    --w: 375;
  }
}
:root[data-scheme='dark'] {
  --w: 375;
}
:root:not([data-scheme='light']) {
  @media (min-width: 1280px) and (prefers-color-scheme: dark) {
    --w: 475;
  }
}
:root[data-scheme='dark'] {
  @media (min-width: 1280px) {
    --w: 475;
  }
}
```

`coalesce` anchors each selector at its first occurrence, so the third rule's block moves backward across the second — an intervening rule whose selector **ties** the coalesced selector. That is exactly the move `{ strict: true }` refuses, and the refusal fires on every media×scheme cross the resolver emits.

The refusal is _correct_ per the conservative contract. Consider an element that matches both selectors — `data-scheme='dark'` set, OS in dark mode — at ≥1280px. Equal specificity means source order is the whole cascade. Pre-move, the last applicable `--w` is the dark∘1280 value, `475`. Post-move, the `475`-under-`prefers∧1280` block sits _before_ the toggle's base `375`, which now beats it. The output stays correct only because the toggle rule re-establishes `475` in its own `@media (min-width: 1280px)` block afterward. A producer that emitted the width-gated value behind the `prefers` half only — no toggle-side twin — would get silently broken CSS from the same coalesce: the co-match state computes `375` instead of `475`. Structurally the safe world and the broken world look identical, so a checker that can't reason about shadowing has to refuse both.

Consequence: **`strict: true` cannot serve as a build gate for mirror-shaped sheets** — the one output shape whose producer most wants a gate is the shape the gate rejects.

## 2. Proposal: shadow-safe strict coalesce

The refusal case is over-broad in a provable way. The move above is safe because the crossed rule _re-establishes_ the moved content: it contains a structurally-equal declaration under a query the moved block's query implies. That's a checkable theorem, not a trust-me. The investigation: refine strict mode from "any tie refuses" to "a tie refuses unless every moved declaration is provably shadowed."

**The hazard, precisely.** Moving block `X` — query `Q`, declarations `D`, selector `A` — backward across a tying rule `R` (selector `B`): for every state where `Q` holds and an element matches both `A` and `B`, declarations in `D` that formerly overrode `R`'s same-property members now lose to them.

**The sufficient check, per declaration `(p, v)` in `D`:** if `R` sets `p` nowhere, nothing competes and the declaration passes (test 6 below). Otherwise, among `R`'s members that set `p`,

1. there exists a setter `(Q′, v′)` with `Q ⇒ Q′` and `v′` structurally equal to `v` — it applies whenever `X` does, re-establishing the value; and
2. every setter _after_ it whose query is co-satisfiable with `Q` also sets a value structurally equal to `v` — a later divergent setter could win in some co-match state.

If both hold for every declaration in `D`, the move cannot change any computed value: in every `Q`-state the last applicable `p`-setter in `R` equals `v`, and where none applies, the moved `d` still wins with `v`. Both query relations are computable on canonical and-sets of the current features. Implication is "every part of `Q′` is implied by some part of `Q`" — `min-width: a ⇒ min-width: b` iff `a ≥ b`, `max-width: a ⇒ max-width: b` iff `a ≤ b`, `prefers-color-scheme` by exact match. Co-satisfiability is "no conflicting `prefers` values and a non-empty width interval": the largest `min-width` in the union at most the smallest `max-width`, both bounds inclusive. Part-wise implication also disposes of the degenerate both-schemes query for free — a `dark ∧ light` setter qualifies only against a moved block that carries the same contradiction and so never applies.

**Part inspectability turns out not to be a dependency after all.** The checker lives inside the library, so it reads the internal and-set directly — necessarily so, not just conveniently: the public accessors report effective bounds (`getPrefersColorScheme` answers `'dark'` for a `dark ∧ light` query), which would let a never-applying setter pass condition 1. The in-flight accessor work is adjacent API, not a prerequisite.

Worked against §1: the moved block `(prefers∧1280, --w: 475)` finds the toggle rule's `(@1280, 475)` — `prefers∧1280 ⇒ 1280` ✓, values equal ✓, nothing after it ✓ → allowed. Note _where_ it finds it: in the toggle rule's **final** member list, because the `(@1280, 475)` setter arrives from the fourth rule — a node _after_ the moved block. At the moment the third rule's block is pulled, the toggle rule holds only `(∅, 375)`, so a check that fires at encounter time refuses the very shape the gate exists for; the two-pass note below is load-bearing, not an implementation detail. The asymmetric producer's crossed rule offers only `(∅, 375)` even in final form — no qualifying setter → refused, which is the genuine bug caught.

**Semantics and scope notes:**

- No new option. `strict`'s documented contract is "throws when coalescing can change the cascade"; this refines _can change_ from conservative to proved-safe. Strictly more permissive strict mode is a minor bump.
- v1 scope: moved blocks and crossed-rule members that are declarations or `MediaRule`s of declarations (one level — today's real shapes). A crossed rule containing nested style rules refuses as before rather than reasoning through nesting.
- Two passes, not a fold-time guard. Crossings are collected during the fold — for each pull, the tying anchors sitting between the pull's own anchor and its original position — but checked only after the fold completes, against each crossed rule's **final** member list. The worked example shows why: the re-establishing setter can arrive from a node after the moved block, invisible to any check that fires at encounter time. A tying rule whose own anchor precedes the pull's anchor is not a crossing at all — its members land before the moved block on both sides of the fold, so their relative order is preserved.
- The safety argument is correspondingly global, not per-step (a per-move induction does not survive the two-pass shape — each move would be validated against a sheet state it never executed in). Coalescing preserves member order within every selector family, so a moved declaration's crossed family keeps its `p`-setters in relative order; conditions 1–2 over the final list pin that family's last applicable `p`-setter to `v` in every `Q`-state, and where none applies the moved `d` wins with `v`. Wherever `d` originally sat among those setters, pre- and post-move winners are both `v`.
- Multiple crossed rules: the check runs per crossing; every crossing of every pull must pass.
- Refusal messages should name the unshadowed declaration and the crossing rule — the failure is now specific enough to be actionable.

**Test matrix for the investigation:**

1. The mirror×media cross (§1) → allowed; output byte-equal to non-strict coalesce. This row pins the two-pass property: the re-establishing setter arrives from a node _after_ the moved block, so a fold-time check would refuse it.
2. Asymmetric producer (no toggle-side re-establishment) → refused.
3. Partial shadow — moved block sets `--w` and `--x`, crossed rule re-establishes `--w` but sets `--x` to a different value → refused. (A crossed rule that never mentions `--x` is row 6 territory: nothing competes.)
4. Later divergence — crossed rule re-establishes `v`, then a later co-satisfiable setter gives a different value → refused.
5. Disjoint queries — crossed setter under `prefers: light` against a moved `prefers: dark` block is not co-satisfiable → ignored; move allowed. Likewise an empty width interval: a `max-width: 800` setter against a moved `min-width: 1280` block.
6. Ties with no property overlap at all → allowed (already-safe case the current conservative check refuses).
7. Non-tying crossings → unchanged from today.
8. Two same-property setters in the moved block, co-satisfiable queries, different values → refused: each declaration is checked independently, and whichever qualifying setter sits later in the crossed rule breaks the other declaration's condition 2. Conservative — the twin-block instance of this shape is order-preserved and safe, but proving it needs joint reasoning v1 doesn't attempt.
9. Re-establishment under an implied query, not only the exact one — a moved `min-width: 1280` block finds its witness under `min-width: 800`, a moved `max-width: 600` under `max-width: 800` → allowed. Pins the threshold direction of implication and the tolerated earlier divergence.
10. The reverse direction — a witness gated on `min-width: 1280` against a moved `min-width: 800` block, or against a bare moved declaration → refused: the witness must apply everywhere the moved declaration does.
11. A value-equal setter under `dark ∧ light` → refused: it never applies, and part-wise implication rejects it as a witness (an effective-bounds reading would have accepted it — the §2 soundness point, pinned).
12. Several tying crossings, one unshadowing → refused, naming the rule that fails.
13. A tying rule anchored before the pull's anchor is no crossing → allowed: both blocks fold to their anchors in original order. Conversely, divergence arriving in the crossed rule from a node _after_ the moved block → refused — final members bind in the refusing direction too.

**How the resolver would consume it.** Production assembly stays the per-selector fold (below) — but the shadow-safe gate gives the resolver an _independent test oracle_: build the group-major sheet, run `coalesce({ strict: true })`, and assert the result equals the fold's output. Two constructions, one checked by the library, agreeing — that's the verification shape the whole adoption has been chasing.

## 3. What the resolver did meanwhile (context, not an ask)

Rank retirement replaced `mergeAll` + `coalesce` with a per-selector fold: one `StyleRule` per selector, anchored at first appearance over the ordered groups, members appended in group order. It emits the byte-identical sheet — so the cascade still rests on the mirror's lockstep property — but that property is now _constructional_ in the resolver's gate algebra: declarations attach to the logical gate and all projections share the one array, so an emitter physically cannot populate the halves asymmetrically. The unverifiable claim moved from a repair operation's precondition into the producer's structure, which is the only place it can be enforced. Residual exposure, recorded for honesty: a future non-mirror gate targeting a selector that ties the mirror halves would reopen the question — §2's checker is also the right answer to that day.

## 4. The deeper alternative, parked: a projection rule

The root cause, read structurally: the resolver has a _logical_ rule that CSS forces into N physical spellings — one body, N `(selector, query?)` preludes. Fashionable could model that directly: a projection rule whose shared block renders as N style rules. Lockstep would be a fact of the model (one block, by type), strict coalesce would be trivially safe within a projection group, adjacency survives merging, and a future flat renderer keeps projections together for free. It is also a new node kind threading through containers, merge, refs, and render — real weight, with exactly one known consumer shape. Lean: park it. Revisit if a second mirror-shaped consumer appears, or if the §2 checker's implementation finds itself reconstructing "these rules are one rule" badly enough that modeling it would be simpler.

## 5. A cheap doc steer, independent of the above

`coalesce` reads today like an assembly step; it's really a _repair_ operation for sheets whose construction you don't control. One sentence in its docs would have saved this consumer a detour: **"If strict coalesce refuses a sheet you built yourself, don't weaken the check — assemble in the target shape instead; refusal usually means the operation is reconstructing an intent you could express directly."**
