# Consumer feedback: dtcg-resolver (toward 0.2.0)

Field notes from fashionable's first consumer. Context: dtcg-resolver's CSS generator completed its consumer-standpoint review of 0.1.0 and shipped migration slice 1 against it — `Gate` placement projections are `Selector`/`MediaQuery` nodes, rule assembly is `mergeAll` + `coalesce` into per-selector rules, and the generated file adopted the nested output form. Remaining slices: typed requirement/`@font-face` channels, rank retirement (ordering from specificity + per-kind comparisons), stylesheet-valued emitter payloads, and the calc swap for fluid expressions. That last one is what the units work unblocks, so it gets the most space here.

## 1. Units: late binding works — put quantities in the bindings, not in parallel tables

The question on the table: units tracked as a third generic where anything ≠ `never` is unsolvable, versus authoring number-land trees with refs standing where units go — bind numbers to solve, bind pre-built unit-bearing expressions to serialize.

The late-binding shape is right for the fluid consumer, with one correction. What fluid needs per curve segment is **one tree serving three duties**: build-time verification (solve at sample viewport widths, compare against the curve sampler), JS-side runtime evaluation (same solve), and CSS serialization. The position term is `(100vw − 320px) / 448px`; the output rim multiplies unit factors into number-land coefficients (`0.875rem + 0.4375 * (pow(t, 2) * 1rem)`).

The trap in "bind numbers at solve time, unit-expressions at serialize time" is that it creates **two hand-maintained binding tables that must stay numerically in sync** — and in the linear-clamp form the unit-bearing leaves are the coefficients themselves (`clamp(0.875rem, …, 1.125rem)`), so the coefficients migrate out of the tree and into both tables. Nothing checks the tables against each other. That is the numeric-twin drift class again, relocated into the binding layer — the exact thing the solve/serialize duality exists to kill.

The fix is small: **bindings hold quantities, and solve lowers each quantity to a number through a unit context.**

- One table: `{ vp: Qty.vw(100), x0: Qty.px(320), span: Qty.px(448), u: Qty.rem(1) }`.
- `solve(expr, bindings, context)` where the context supplies px-per-unit: `{ vw: sampleWidth / 100, rem: 16, px: 1 }`. Each quantity lowers to a number independently; arithmetic stays numeric. No operator-level dimensional analysis is needed for solving — leaf lowering is mathematically identical to a full unit-aware evaluator whenever the tree's units are coherent.
- `serialize(expr, { bindings })` renders the same quantities as `100vw`, `320px`, `1rem`.

The thing you verified is now the thing you shipped, including the units — the verify gate covers the binding table because there is only one.

Two companion pieces make this safe:

1. **Post-bind typecheck.** An incoherent tree (raw number added to a length) lowers to a number silently where a browser would reject the `calc()`. Once quantities are bound the tree is unit-annotated, so a runtime projection can run the CSS calc type algebra — same types add, multiplication merges types, same-dimension division yields `<number>` (the position term depends on this rule) — and throw on invalid combinations. Consumers run it inside their build gates; it recovers most of the static guarantee dynamically, where the tests already live.
2. **The third generic still earns its keep — as a context requirement, not a solvability gate.** Once solve can lower quantity leaves from bindings, lowering in-tree quantity leaves is the identical code path, so "units ≠ never → unsolvable" becomes an unnecessary restriction. The nicer typing: `Units` tracks which unit kinds appear, and the solve overload for `Calc<Refs, Units ≠ never>` *requires* a `UnitContext<Units>` argument with exactly those keys. Unsolvable-without-context, solvable-with — and authoring style (quantities in the tree vs. late-bound through refs) becomes taste rather than capability.

Whatever lands first, one property is worth protecting: **keep quantities structured data, never pre-rendered text**, so the full unit-aware solve remains a compatible extension instead of a breaking change.

Caveat to design around: under late binding, refs do double duty — the `var(--…)` channel and unit slots. A forgotten serialize binding emits `var(--x0)`: silently wrong CSS that the solve-side verification cannot catch, and `Stylesheet.refs`'s dependency report now lies. A serialize option asserting the residual ref set (`expectRefs: […]` or similar) would close that hole cheaply; consumers can also police `refs(sheet) ⊆ declared-names` themselves once values are expression-shaped.

Trig interplay: with units landing, `cos`/`sin` should keep accepting both plain numbers (radians) and angle-typed subtrees — the closed-form inverse serializes as `cos(acos(…) / 3 − 2.094395102rad)`, and the 0.1.0 serializer's automatic `rad`-typing of acos-carrying subtrees already does the right thing. And the output rim needs number × length products through `pow` factors to be constructible (`0.4375 * (pow(var(--t), 2) * 1rem)`) — though any cascade-equivalent form is fine; byte-stability was relaxed on the consumer side.

### 1b. Addendum: same-dimension division without dividing lengths

Typed division (`length / length → number`) is still unshipped in Firefox — and it is load-bearing in every fluid declaration, so the resolver's current output is Firefox-broken today. The escape is the type-cast identity **`tan(atan2(A, B)) ≡ A / B`** for same-dimension operands: `atan2()` accepts dimension pairs and returns an angle, `tan()` returns a number. `tan(atan2(100vw − 320px, 448px))` is the position term as a `<number>`, exact in all quadrants (`tan`'s π-periodicity cancels `atan2`'s quadrant shifts; `B = 0` yields an infinity-ish value rather than division's invalid-at-computed-value).

Support makes this strictly better, not a tradeoff: `tan`/`atan2` shipped FF 108 / Chrome 111 / Safari 15.4, *below* the `pow()`/`acos()` floor (FF 118 / Chrome 120) fluid's nonlinear segments already require. Restructuring the math instead doesn't reach: linear segments could use the classic `intercept + slope·100vw` form but that abandons the whole-expression rem-tracking invariant, and nonlinear segments need a unitless `u` no matter what (`pow`/`acos` take numbers; CSS has no squared-length type).

**Decision (Tim): the cast stays consumer-side** — fashionable won't carry a polyfill-adjacent serialize mode; the resolver emits the `tan(atan2())` form itself (shipped in its fluid emission). The library ask this leaves behind: **`tan` and `atan2` constructors in the calc module** (only `sin`/`cos`/`acos` exist in 0.1.0), with `atan2` accepting same-dimension quantity pairs once units land — that's what lets the resolver build the cast explicitly in the calc swap. Solve-side both are plain `Math` calls. For the record, css-values-5's `progress(value, start, end)` computes exactly this normalized position natively (Chrome shipped 2025; other engines converging) — the platform is arriving at the same primitive, and native division-by-length may eventually moot the cast.

## 2. Color coverage: `color(srgb …)` and `light-dark()`

Only `oklch` is modeled. The resolver emits `color(srgb r g b)` for srgb-authored tokens and `light-dark(a, b)` for scheme-varying values — today as literal text, which keeps the entire color channel out of the expression layer: invisible to `refs`, no structural equality, string-assembly sites survive. With `Color.srgb` and `Color.lightDark` the scheme value-level strategy (collapse when schemes agree, else `light-dark`) becomes structural end-to-end.

## 3. Canonical orderings as documented-stable API

Deterministic rendering means rendered text becomes cache-key and test-pin material downstream. The media-query kind order (min-width before prefers-color-scheme) changed the resolver's emitted condition order relative to its old string core — fine as a one-time migration, but reorderings churn every consumer's output. One sentence in the docs — "canonical orders are stable within a major" — makes the contract explicit.

## 4. Smaller consistency and QoL items — ALL SHIPPED (2026-07-15, toward 0.2.0)

- **`FontFaceRule.render` honors the precision context** — weight and metric-override numbers format at the inherited `precision` option (default unchanged, `decimals(5)`), completing the render-options family's "a key means the same thing wherever it appears" promise.
- **`Stylesheet.isEmpty` / `RuleSet.isEmpty`** — structural predicates; `Stylesheet.render` now documents the guarantee that a sheet whose every node renders empty renders the empty string.
- **`coalesce(sheet, { strict: true })`** — throws when a pull would cross an intervening style rule that ties the coalesced selector on specificity (conservative: tying-but-disjoint selectors also refuse). Default behavior unchanged.
- **`unicode-range` on `FontFaceRule`** — `UnicodeRange = codepoint | [start, end]` (the `Weight` pattern), validated in `[0x0, 0x10FFFF]`; the descriptor is a set union so entries canonicalize (sorted, exact duplicates dropped) and construction order never matters; renders uppercase hex after `src`.
- **Canonical-order stability** (§3) — pinned in `design.md` principle 2: canonical orders are stable within a major; reordering rendered text is a breaking change.

## 5. What worked — keep these properties

- **`merge` as a lawful monoid with `coalesce` separate.** The resolver's entire rule-assembly core is ~40 lines of group → sort → `mergeAll` → `coalesce`, and requirement dedup (the scheme contract emitted by many independent emitters) falls out of structural first-wins for free.
- **The render-options family.** One `{ indent }` object at the top-level render call, composing through every renderer beneath.
- **`Calc.ref` serializing bare as `var(--x)`.** Covers alias-chain emission (`--a: var(--b)`) with zero new API, and makes `Stylesheet.refs` a real dependency graph once declaration values go expression-shaped — the resolver plans to assert generated sheets are self-contained (every var read is a defined token) on the back of it.
- **`Precision.decimals(5)` default + per-constant `significant(10)` annotations.** Mapped one-to-one onto the resolver's two formatting regimes (unit-carrying output values vs. unit-free inverse constants amplified through cubics).
- **Namespace-only exports (`Calc.Calc`).** Effect-shaped and fine; the consumer migration is mechanical.
