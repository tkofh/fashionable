# Consumer feedback: dtcg-resolver (toward 0.3.0)

Field notes from fashionable's first consumer, round two. Everything from the 0.2.0 round shipped (typed units + context-lowered solve, `tan`/`atan2`, the color coverage, canonical-order stability, the render/QoL items) and the resolver is bumped and green against the release. Adoption state: migration slices 1–3 are in — modeled preludes and nested output, typed requirement/`@font-face` channels, and rank retirement. This round has one subject: what rank retirement revealed about `coalesce`, and the investigation it motivates. (MediaQuery part inspectability is deliberately not specified here — that work is already in flight; §2 notes where it becomes a dependency.)

Nothing in this document blocks the resolver — it restructured its assembly and shipped. The question is whether `strict` coalesce should be completable into the checkable gate it was built to be.

## 1. The finding: strict coalesce refuses the resolver's real output

The resolver's scheme dimension emits dark values through a **two-rule mirror**: one logical placement, two physical spellings — `@media (prefers-color-scheme: dark)` under `:root:not([data-scheme='light'])`, and the bare manual toggle `:root[data-scheme='dark']`. Both selectors compute to specificity 0-2-0, and every rule behind the gate lands in **both** projections with identical values. When dark values also vary by breakpoint, the pre-coalesce sheet (group-major order) looks like:

```css
:root:not([data-scheme='light']) { @media (prefers-color-scheme: dark) { --w: 375; } }
:root[data-scheme='dark'] { --w: 375; }
:root:not([data-scheme='light']) { @media (min-width: 1280px) and (prefers-color-scheme: dark) { --w: 475; } }
:root[data-scheme='dark'] { @media (min-width: 1280px) { --w: 475; } }
```

`coalesce` anchors each selector at its first occurrence, so the third rule's block moves backward across the second — an intervening rule whose selector **ties** the coalesced selector. That is exactly the move `{ strict: true }` refuses, and the refusal fires on every media×scheme cross the resolver emits.

The refusal is *correct* per the conservative contract. Consider an element that matches both selectors — `data-scheme='dark'` set, OS in dark mode — at ≥1280px. Equal specificity means source order is the whole cascade. Pre-move, the last applicable `--w` is the dark∘1280 value, `475`. Post-move, the `475`-under-`prefers∧1280` block sits *before* the toggle's base `375`, which now beats it. The output stays correct only because the toggle rule re-establishes `475` in its own `@media (min-width: 1280px)` block afterward. A producer that emitted the width-gated value behind the `prefers` half only — no toggle-side twin — would get silently broken CSS from the same coalesce: the co-match state computes `375` instead of `475`. Structurally the safe world and the broken world look identical, so a checker that can't reason about shadowing has to refuse both.

Consequence: **`strict: true` cannot serve as a build gate for mirror-shaped sheets** — the one output shape whose producer most wants a gate is the shape the gate rejects.

## 2. Proposal: shadow-safe strict coalesce

The refusal case is over-broad in a provable way. The move above is safe because the crossed rule *re-establishes* the moved content: it contains a structurally-equal declaration under a query the moved block's query implies. That's a checkable theorem, not a trust-me. The investigation: refine strict mode from "any tie refuses" to "a tie refuses unless every moved declaration is provably shadowed."

**The hazard, precisely.** Moving block `X` — query `Q`, declarations `D`, selector `A` — backward across a tying rule `R` (selector `B`): for every state where `Q` holds and an element matches both `A` and `B`, declarations in `D` that formerly overrode `R`'s same-property members now lose to them.

**The sufficient check, per declaration `(p, v)` in `D`:** among `R`'s members that set `p`,

1. there exists a setter `(Q′, v′)` with `Q ⇒ Q′` and `v′` structurally equal to `v` — it applies whenever `X` does, re-establishing the value; and
2. every setter *after* it whose query is co-satisfiable with `Q` also sets a value structurally equal to `v` — a later divergent setter could win in some co-match state.

If both hold for every declaration in `D`, the move cannot change any computed value: in every `Q`-state the last applicable `p`-setter in `R` equals `v`, and where none applies, the moved `d` still wins with `v`. Both query relations are computable on canonical and-sets of the current features — implication is "every part of `Q′` is implied by some part of `Q`" (`min-width: a ⇒ min-width: b` iff `a ≥ b`; `prefers-color-scheme` by exact match), co-satisfiability is "no conflicting `prefers` values" (min-widths are always jointly satisfiable). **This is where part inspectability becomes a dependency** — the checker needs to read features back out of a `MediaQuery`, which the in-flight work provides.

Worked against §1: the moved block `(prefers∧1280, --w: 475)` finds the toggle rule's `(@1280, 475)` — `prefers∧1280 ⇒ 1280` ✓, values equal ✓, nothing after it ✓ → allowed. The asymmetric producer's crossed rule offers only `(∅, 375)` — no qualifying setter → refused, which is the genuine bug caught.

**Semantics and scope notes:**

- No new option. `strict`'s documented contract is "throws when coalescing can change the cascade"; this refines *can change* from conservative to proved-safe. Strictly more permissive strict mode is a minor bump.
- v1 scope: moved blocks and crossed-rule members that are declarations or `MediaRule`s of declarations (one level — today's real shapes). A crossed rule containing nested style rules refuses as before rather than reasoning through nesting.
- Multiple crossed rules: the check runs per crossing; all must pass. Multiple pulls into the same anchor: process in encounter order, checking each against the rules it actually crosses in the current (partially coalesced) sheet.
- Refusal messages should name the unshadowed declaration and the crossing rule — the failure is now specific enough to be actionable.

**Test matrix for the investigation:**

1. The mirror×media cross (§1) → allowed; output byte-equal to non-strict coalesce.
2. Asymmetric producer (no toggle-side re-establishment) → refused.
3. Partial shadow — moved block sets `--w` and `--x`, crossed rule re-establishes only `--w` → refused.
4. Later divergence — crossed rule re-establishes `v`, then a later co-satisfiable setter gives a different value → refused.
5. Disjoint queries — crossed setter under `prefers: light` against a moved `prefers: dark` block is not co-satisfiable → ignored; move allowed.
6. Ties with no property overlap at all → allowed (already-safe case the current conservative check refuses).
7. Non-tying crossings → unchanged from today.

**How the resolver would consume it.** Production assembly stays the per-selector fold (below) — but the shadow-safe gate gives the resolver an *independent test oracle*: build the group-major sheet, run `coalesce({ strict: true })`, and assert the result equals the fold's output. Two constructions, one checked by the library, agreeing — that's the verification shape the whole adoption has been chasing.

## 3. What the resolver did meanwhile (context, not an ask)

Rank retirement replaced `mergeAll` + `coalesce` with a per-selector fold: one `StyleRule` per selector, anchored at first appearance over the ordered groups, members appended in group order. It emits the byte-identical sheet — so the cascade still rests on the mirror's lockstep property — but that property is now *constructional* in the resolver's gate algebra: declarations attach to the logical gate and all projections share the one array, so an emitter physically cannot populate the halves asymmetrically. The unverifiable claim moved from a repair operation's precondition into the producer's structure, which is the only place it can be enforced. Residual exposure, recorded for honesty: a future non-mirror gate targeting a selector that ties the mirror halves would reopen the question — §2's checker is also the right answer to that day.

## 4. The deeper alternative, parked: a projection rule

The root cause, read structurally: the resolver has a *logical* rule that CSS forces into N physical spellings — one body, N `(selector, query?)` preludes. Fashionable could model that directly: a projection rule whose shared block renders as N style rules. Lockstep would be a fact of the model (one block, by type), strict coalesce would be trivially safe within a projection group, adjacency survives merging, and a future flat renderer keeps projections together for free. It is also a new node kind threading through containers, merge, refs, and render — real weight, with exactly one known consumer shape. Lean: park it. Revisit if a second mirror-shaped consumer appears, or if the §2 checker's implementation finds itself reconstructing "these rules are one rule" badly enough that modeling it would be simpler.

## 5. A cheap doc steer, independent of the above

`coalesce` reads today like an assembly step; it's really a *repair* operation for sheets whose construction you don't control. One sentence in its docs would have saved this consumer a detour: **"If strict coalesce refuses a sheet you built yourself, don't weaken the check — assemble in the target shape instead; refusal usually means the operation is reconstructing an intent you could express directly."**
