# fashionable — design

An Effect-style API for building CSS stylesheets in TypeScript: a structural model of the CSS language (rules, selectors, media queries, at-rules, nesting) unified with a calc() value-expression language that can be solved against bindings or serialized to CSS — plus structural merging, automatic order management, and zero runtime dependencies.

This document is the repo-resident successor of the design brief that started the project (dtcg-resolver's `docs/ideas/css-library.md`). It records the whole v1 design, now fully shipped (section 8); what remains for v1 is the consumer migrations, in the consumer repos. Satellite documents carry the derivations and the in-flight designs: `docs/result-calc.md` (the `Calc<Vars, Result, Requires>` repartition — folded in, kept as the derivation record), `docs/feedback-dtcg-resolver.md` (consumer-1 field notes; shipped rounds are cleared from it), `docs/ok-apca-feedback.md` (consumer-2 field notes, the nesting motivation), `docs/vars.md` (the `Var` identity channel — folded in, kept as the derivation record), and `docs/selector-nesting.md` (the `&` extension — folded in, kept as the derivation record; only its relative-`:has()` and flattened-rendering tail remains unshipped).

Two consumers drive v1 scope:

1. **dtcg-resolver's CSS generator** — many independent emitters producing `:root`-scoped custom properties across media/scheme/state axes, `@font-face` + metrics-adjusted fallback faces, fluid `calc()` expressions (including `cos`/`acos` from closed-form curve inverses), and a scheme contract deduped across emitters.
2. **ok-apca** — computed `@property`-registered custom properties, oklch color expressions, solve/serialize duality. fashionable absorbs `@ok-apca/calc-tree` entirely (reshaped, not wrapped).

## 1. Principles

1. **Grammar fidelity over coverage.** Model only what a real consumer needs, but model each construct as the specification defines it. Illegal states are unrepresentable in the types: conditional group rules (`@media`) may nest inside style rules; declaration-block at-rules (`@font-face`, `@property`) are top-level only.
2. **Structural everything.** Nodes are immutable data with structural equality (internal Equal/Hash port, no runtime dependency). Commutative constructs carry a canonical ordering enforced at construction, so equality holds regardless of construction order. Canonical orders are stable within a major version: rendering is deterministic, so rendered text is consumers' cache-key and test-pin material, and reordering it is a breaking change.
3. **One model, many projections.** Serialize a stylesheet to CSS; solve value expressions against bindings; compute selector specificity; merge stylesheets. The thing you verified is the thing you shipped.
4. **Capability, not policy.** The library computes, canonicalizes, and merges; it does not decide which rule wins. Cascade-ordering policy belongs to consumers, armed with computed specificity, stable deterministic ordering, and order-preserving containers.
5. **Effect-style API, effect-free implementation.** Namespace modules (`Calc.solve`, `Selector.specificity`), pipeable/dual combinators, branded interfaces — with `pipe`/`dual`/`flow` ported internally (the curvy precedent). Structural brands mean consumers must hold a single copy of the library.

## 2. Module map

One subpath export per module, no root export (the curvy convention). Each module folder is an `index.ts` barrel plus public/internal file pairs; JSDoc lives in the public files, implementations in `*.internal.ts` (stripped from published types).

```
src/utils.ts                -> fashionable/utils        [shipped]  pipe, dual, flow, Pipeable, invariant
src/internal/               (not exported)              [shipped]  equal, format, refs, render
src/var/                    -> fashionable/var          [shipped]  Var<Name, Type, Fallback>
src/calc/                   -> fashionable/calc         [shipped]  Calc<Vars, Result, Requires>, Precision
src/data/                   -> fashionable/data         [shipped]  Color<Vars> (oklch, srgb, light-dark, color-mix, relative color via `from`, named, var); Angle (rad, deg), Length, LengthPercentage, Numeric, Percentage, Unit; Keyword (none); Channel (relative-color keywords); ColorSpace (color-space values for `from` and `mix`, polar-ness a type-level trait); HueInterpolation (mix hue strategies, plus `interpolate` — the branchless-via-`mod` degree-space fixup that builds a hue expression the browser also computes)
src/selector/               -> fashionable/selector     [shipped]  Selector, Specificity
src/query/                  -> fashionable/query        [shipped]  MediaQuery
src/declaration/            -> fashionable/declaration  [shipped]  Declaration<Vars>
src/rule/                   -> fashionable/rule         [shipped]  RuleSet, StyleRule, MediaRule
src/fontFace/               -> fashionable/font-face    [shipped]  FontFaceRule
src/property/               -> fashionable/property     [shipped]  PropertyRule, PropertySyntax
src/stylesheet/             -> fashionable/stylesheet   [shipped]  Stylesheet<Vars>, render
```

Dependency DAG (acyclic, internals at the root):
`utils` <- `internal/*` <- `var` <- `calc` <- `data` <- `declaration` <- `rule` <- `stylesheet`; `selector` and `query` depend only on `utils`/`internal`; `fontFace` and `property` depend on `calc`/`data` (for `@property` initial values). The render-options family (section 7) adds type-only edges (`declaration` -> `query`, `fontFace`/`property` -> `declaration`) that erase at build time.

Placement notes:

- `var/` is the identity layer of the custom-property channel: a `Var` value is one `var()` read (name plus optional fallback), the bare read doubling as the property's canonical handle. It sits below `calc` because every world consumes it — `calc` and `data` lift reads into expressions, `declaration` admits one as a whole value — and its fallback slot is generic, constrained at each admitting context (`docs/vars.md` carries the derivation).
- `calc` names the CSS construct and gives the type its natural name (`Calc<Vars, Result, Requires>`).
- `data/` collects the value-layer data types beyond bare expressions: the dimension constructors (`Angle`, `Length`, `Percentage`, with `Unit` naming their kinds) and `Color`, which is not solvable to a number and grows independently. `color-mix()` is its own node, weighting each arm with a `<percentage>` and interpolating in a `ColorSpace` value; polar-ness is a type-level **trait** on the space, curvy-style, so `Color.mix`'s overload admits a `HueInterpolation` only after a `PolarSpace` while rectangular spaces reject one, and the same `ColorSpace` values serve as `from` destinations. Relative color is another node, built by `Color.from(origin, ColorSpace.oklch, ...)`: its channels read the origin through bare-identifier `Calc` leaves — a new leaf kind that serializes unwrapped, stays out of `Vars`, and carries a `ChannelIdent` brand (refining calc's `Ident`) in `Requires`, so `solve` resolves it from the `idents` section the way it resolves a relative unit from a `units` ratio. The channel keywords surface as the `Channel` module, scoped by the `ColorSpace` argument (whose value carries the space's channel brands). `Color.var` completes the set with a color-valued `var()` read.
- `query/` is the home for the condition grammars: `MediaQuery` today, container and supports queries as sibling types when a consumer arrives. They share the module because they share the "prelude condition" role, not a grammar.
- `declaration` is its own subpath because it is the seam where the two language halves meet.
- The declaration-block at-rules get one module each (`fontFace/`, `property/`) so the at-rule family scales: `@layer` and friends become sibling modules rather than crowding a shared folder, with the shared block-text helpers in `internal/render.ts`.
- There is no separate render module: every renderable type carries its own `render` (section 7), the shared nested-form block renderer lives in `rule.internal.ts`, and the whole-sheet projection lives on `Stylesheet.render` — the one module already downstream of every model module.

## 3. The value layer (shipped)

### 3.1 Reshape from calc-tree

`@ok-apca/calc-tree` 0.2.0 is the donor. The OO interpreter (node classes with `substitute`/`serialize` methods) became an immutable tagged-union ADT (`{ _tag: 'Add', terms }`, ...) with external exhaustive-switch walkers in `calc.internal.ts`. Dropped donor artifacts: the dead `NaryNode.identity`, the vestigial `format`/`formatChildren` methods, the `Properties` namespace (superseded by the rule layer, section 5), string-input constants.

Kept semantics, pinned by the ported donor test suites: eager constant folding at construction and through `bind` (partial evaluation), vars bookkeeping (`Vars` phantom type parameter + runtime `ReadonlySet`), excess-binding tolerance, partial-binding serialization (`var(--name)`), calc-wrap discipline (a `calc()` wrapper only around arithmetic forms, never function forms), parenthesization (add/subtract operands parenthesized under multiply/divide), sign normalization (`a + -k` renders `a - k`, including negative-coefficient products).

API deltas from the donor, deliberate:

- `constant` and `reference` are `Calc.of` and `Calc.var` (a reserved word, so bound as `_var` and re-exported — the `Selector.class` move); `of` takes an optional `Precision` annotation.
- `serialize(expr, bindings?)` became `serialize(expr, { bindings?, precision? })`.
- `solve(expr, bindings?)` became `solve(expr, { bindings?, units?, idents? })` — one options object, each section required exactly when the expression's type demands it (section 4.4). Solve bindings are `Input<never>`: a bound value carrying its own unbound variables can never close under single-pass substitution, so it is a type error.
- The donor's kind strings became the `Result` parameter: `Calc<Vars, Result, Requires>` carries the output's unit composition (`Unit.Px | Unit.Vw` for a mixed sum, `Unit.None` for a number) where the donor tracked nothing and 0.3 tracked the four `Kind` strings. The dimension rules are enforced by comparing `Unit.Family` projections (CSS's own type-checking altitude), and `Kind` survives as the prose and runtime vocabulary. Derivation record: `docs/result-calc.md`.
- `solve`'s no-bindings overload requires `Calc<never>` — closedness is a compile-time obligation, where the donor accepted anything and threw.
- `bind` is dual (`expr.pipe(Calc.bind({ ... }))` works).
- The `pi` special case only fires inside math-function context (`calc()`, `min()`, `sin()`, ...). A bare top-level constant near pi renders numerically — the donor emitted a bare `pi` token that is invalid outside math functions.
- New: `cos`, `acos` (consumer 1's closed-form cardinal-segment inverses), `mod` (CSS `mod()`, floored to the divisor's sign), structural `equals`, `vars`, and `idents`/`units` (the runtime mirrors of the `Requires` brands, per section 4.4).
- The vars channel moved from string names to `Var` identities (0.4, derivation in `docs/vars.md`): `Calc.var`/`Color.var` accept a `Var` read as well as the bare-name sugar, a fallback-carrying read renders `var(--name, fallback)` (fallbacks are world-constrained at each lift), and the read's identity plus its fallback chain's flatten into `Vars`.

### 3.2 Precision

Two channels, both carried as data:

- **Per-constant annotation** (`Calc.of(x, Precision.significant(10))`): the emitter knows at construction whether a number is a solved coefficient (10 significant digits) or a value-level quantity (5 decimals). Annotations override the context unconditionally and participate in structural equality.
- **Per-call context** (`SerializeOptions.precision`, default `Precision.decimals(5)` — the donor's behavior): formats every unannotated constant.

Folding propagates the highest-fidelity operand annotation: any `significant` outranks any `decimals`, more digits outrank fewer, unannotated ranks lowest. The rule is monotone: folding never loses requested fidelity.

Formatting is plain decimal always (CSS rejects exponent notation), trailing zeros trimmed, negative zero normalized.

### 3.3 The angle boundary

Solve-side, trig is numbers-as-radians (`Math.cos`/`Math.acos`). Serialize-side, CSS `acos()` returns an `<angle>`; `sin()`/`cos()` accept an angle or a plain number (radians). The serializer type-tracks angle-ness structurally (`producesAngle`): when a plain-number term is added to or subtracted from an angle-typed term, numeric constants take a `rad` suffix and anything else multiplies by `1rad` — multiplication with one unitful operand is universally valid CSS, unlike typed division (`x / 1rad`), which is recent and never emitted. The consumer-1 shape serializes as today's hand-built output:

```
cos(acos(clamp(-1, <affine in u>, 1)) / 3 - 2.0944rad)
```

Documented v1 constraint: consume acos-carrying subtrees with `sin`/`cos`; an angle-typed expression that escapes to the top level serializes as angle-typed CSS (valid only where an angle is accepted). Type-side, `acos`/`atan2` results are `Unit.Rad`, not a bare angle: solving evaluates radians and folding emits `rad` constants, so the type asserts the solve-side truth.

## 4. Cross-cutting machinery

### 4.1 Structural equality (internal/equal.ts)

A two-symbol protocol (`Symbol.for('fashionable/Equal')`, `.../Hash`), modeled on Effect's Equal/Hash but minimal. Impl classes implement both symbol methods (tag check plus component-wise walk; lazily memoized hash — safe because values are immutable). `equals` fast-path rejects on hash mismatch. Hashing is FNV-1a for strings, float64-bit hashing for numbers (negative zero normalized), order-sensitive boost-style `combine`.

The protocol stays internal; each namespace exports a typed dual `equals`. Merge dedup (section 5.6) uses a hash-bucketed map — expected O(n) for the hundreds-of-nodes sheets v1 targets.

### 4.2 Canonical ordering

- **Compound selector parts**: stable sort by `(kind rank, rendered text)`, ranked type/universal, `&`, id, class, pseudo-class, attribute, functional pseudo-class (`:is`/`:where`/`:has`/`:not`), pseudo-element, enforced in constructors. Any fixed order renders a semantically identical compound; simple pseudo-classes precede attribute qualifiers and functional pseudos so the root-scoped house shapes render in consumer 1's exact current spelling (`:root[data-scheme='dark']`, `:root:not([data-scheme='light'])`), keeping the migration byte-diffable, and the nesting selector sits just after the type slot because the spec keeps a type selector first in its compound (css-nesting-1: `&div` is illegal, `div&` is not). Duplicates are kept (`.a.a` legally has specificity (0,2,0)); the grammar's own constraints are enforced (at most one type/universal part, at most one pseudo-element, no combinator after a pseudo-element, `and` merges compounds only).
- **Functional pseudo-class argument lists**: canonical-sorted by rendered text — `:is()` matching is order-independent and its specificity takes the maximum, so authored order carries nothing. **Combinator sequences are never sorted**: `a b` and `b a` are different selectors; their order is their meaning.
- **MediaQuery and-sets**: sort by `(feature-kind rank, within-kind key)` — `min-width`, then `max-width`, then `prefers-color-scheme`; widths ascending by threshold, scheme values alphabetically; identical features dedup (idempotent conjunction). Shipped kinds never reorder (rendered text is consumers' cache-key material), but a new kind may slot anywhere in the ladder, since no existing query contains it and its insertion reshuffles no existing output (`max-width` took the slot beside `min-width` rather than the end).
- **FontFaceRule unicode-range**: sorted by `(start, end)`, single codepoints before their degenerate ranges, exact duplicates dropped — the descriptor is a set union, so order carries no meaning.
- **Calc trees are NOT canonicalized**: float arithmetic is not associative-commutative under solve, and serialized math should mirror authored math. `add(a, b)` and `add(b, a)` are different values.
- **Declarations, rule-set members, stylesheet nodes are never sorted**: member order is cascade behavior; the library preserves it (capability, not policy).

Constructor-time ordering makes equality/hashing plain component-wise walks and rendering deterministic for free. The concrete orders above are stable public API (principle 2): consumers pin rendered text in tests and cache keys, so reordering any of them is a breaking change.

### 4.3 Vars threading

`Calc<Vars>`/`Color<Vars>` phantom parameters carry the identities of unbound reads, as `Var` values from `fashionable/var` (`Calc<Var<'x'>>`); the runtime set is the source of truth for names. The currency rule that keeps ergonomics: **names are the value-level currency, identities the type-level currency** — binding records stay string-keyed (mapped over `Var.Name<Vars>`, which preserves key checking), and every `vars()` report returns bare names. The containers (`Declaration<Vars>` through `Stylesheet<Vars>`) keep threading the union: an unbound read serializes as `var(--name)`, so `Stylesheet<Vars>` reads as "this sheet reads these custom properties" — a dependency report, not an error state, with `Stylesheet<never>` meaning the sheet stands alone. That report lets consumer 1 turn scheme-contract discovery into an assertion over the merged sheet. The identity carries a covariant `Type` slot, `unknown` while undeclared and a data type (`Length`, `Numeric`, `Color`, ...) under the typed constructors (`Var.length('gap')` and siblings, `docs/vars.md` section 7): a declared read lifts with its family as the expression's Result, its bindings take exactly the declared type (`bind` threads a bound value's requirements; `solve` bindings stay pre-satisfied), and `PropertyRule.make` derives the registration syntax from the handle. Typed handles flow anywhere untyped ones are expected, so the typed layer stays additive — the reverse exclusions (a color-typed read at `Calc.var`) are conditional guards on the lift parameters, since covariance can enforce presence but never absence (section 4.4). Escape hatch: the parameters default to `Var.Any`; if variadic inference over heterogeneous members proves noisy in practice, containers can relax to runtime-only var sets without changing the runtime API.

### 4.4 Dependency channels and the requirements convention

Everything an expression cannot resolve on its own rides one of three channels, and every channel pairs a type-level tracker with a runtime report and a section of `Calc.SolveOptions`:

| channel   | type tracker                 | runtime report | satisfied by                                                                              |
| --------- | ---------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| variables | `Var` identities in `Vars`   | `vars()`       | `bindings` — name -> closed value (also on `serialize`, where partial bindings are legal) |
| units     | `Unit` brands in `Requires`  | `units()`      | `units` — token -> ratio                                                                  |
| idents    | `Ident` brands in `Requires` | `idents()`     | `idents` — token -> value                                                                 |

Litmus tests for routing a new dependency:

- **Substitutable by the author, expression-valued, meaningful to serialization** -> a variable. `bind` substitutes it, `ApplyBindings` subtracts it, an unbound one serializes as `var(--name)` and threads through the containers (section 4.3).
- **Browser-resolved token that lowers to a number** -> a brand in `Requires`, resolved by the matching solve section. A unit lowers by ratio (`value * ratio`: `vw` is `sampleWidth / 100`, `%` is `basis / 100` — per-hundred alike, with `px`/`rad`/`deg` pre-satisfied); an ident lowers by value (the token is the value: `{ l: 0.62 }`). Serialization never consults either — `10vw` serializes as `10vw`, `l` as `l`.
- **Non-numeric resolution** (the scheme of a `light-dark()`, say) -> not solve's concern. It belongs to a future projection's own options; `solve`'s environment stays `bindings + units + idents`.

**The fallback asymmetry.** A read's fallback (`var(--x, f)`) contributes to `Vars` but never to `Requires`: the fallback may render, so its reads stay in the dependency report, but it is unreachable in every projection that consumes requirements — serialization never consults units or idents, and `solve` substitutes the mandatory binding, which discards it. The runtime `units()`/`idents()` reports mirror `Requires`, so they exclude fallback contents too. The visible cost of `Vars`'s dual role: binding `x` in `var(--x, var(--y))` discards the `y` read, yet solve still demands a `y` binding.

**The polarity convention.** The library carries two kinds of type-level brand, and their encodings invert each other. A **capability** (`ColorSpace`'s `Polar`) accumulates by intersection with an `unknown` default, and a position gates on _presence_. A **requirement** (`Calc`'s `Requires`; `Selector`'s `Requires`, per `docs/selector-nesting.md`) accumulates by union with a `never` default, and a position gates on _absence_: a slot typed `X<R>` admits exactly the values whose requirements are a subset of `R`, so requirements restrict placement and discharge composes by `Exclude`. Covariance can enforce presence of a capability and absence of a requirement, and neither converse — the encoding is chosen by which direction needs compile-time teeth.

**Requirements gate different projections per carrier**: for `Calc`, `solve`; for selectors, root placement and `specificity`. Serialization is gated for neither: an `&` renders verbatim in nested output as `l` does in a relative color.

**Pre-satisfied requirements are load-bearing.** The absolute units (`px`, `rad`, `deg`) ride `Requires` with default supplies, and they must: division cancellation (`DivRequires`) may discharge a requirement only when eager folding guarantees the division folds before evaluation needs a ratio, and foldability is a property of every unit in the tree, defaults included — evict them and `divide(add(vw, px), add(vw, px))` cancels its `vw` requirement while the mixed tree stays symbolic. Cancellation never applies to idents, which are not constants and never fold. The counterexamples that pin this are in `docs/result-calc.md`. Related invariant: number-result expressions can carry requirements (a channel ident, or the units of a `vw / px` ratio), so no signature may assume number-result means requirement-free.

**Rejected over-unifications**, so the boundaries read as chosen: there is no cross-module `Requirement` supertype (a `Selector` can never carry `Unit.Vw`; the unity is the convention, the unions stay per-carrier), and `Vars` stays its own parameter (open string names rather than closed brands, expression-valued discharge shared with `serialize`, and container threading as a report rather than a gate).

Binder constructs — CSS syntax that introduces identifiers with a scope, as relative color's `from` introduces the channel keywords — follow a fixed recipe: the generic mechanism lives in calc (`IdentNode`, the `Ident` brand, `idents`), and the construct refines the brand (`ChannelIdent extends Ident`) and scopes its slots on the refinement (a `ColorSpace` names the `ChannelIdent`s it admits). Generic machinery keys on the base and covers every ident source with no new plumbing; scoping keys on the subtype, so a token collision between constructs can never smuggle a foreign ident into a slot.

## 5. The rule layer (shipped)

Signatures are sketches; the shipped modules' conventions (public/internal pairs, brands, dual combinators, JSDoc) apply throughout.

### 5.1 fashionable/selector — Selector, Specificity

A `Selector` is a complex selector: a non-empty sequence of canonically ordered compounds joined by combinators, one compound being the common case. Part constructors return one-part selectors; `and` merges compounds; the combinator constructors join selectors; `is`/`where`/`has`/`not` wrap selector lists, compound or complex arguments alike. The grammar interleaves — a list argument may be complex, and a list is itself a compound part — which is why the nesting extension widened `Selector` rather than layering a separate `Complex` type above the compound (`docs/selector-nesting.md` section 2).

The `Requires` parameter is the selector's requirements channel (section 4.4): `Selector.nest` (the `&` leaf) introduces `Parent`, composition unions it upward, and `Selector.under` — substitution of a parent for each `&`, argument lists included — discharges it. `specificity` takes bare `Selector`, so an unresolved `&` is a compile error rather than a wrong number; a nested rule's resolved specificity is `specificity(under(child, parent))`, spec-exact because fashionable rules carry exactly one selector (`&` scores as `:is(parent)`, and the max-over-parent-list rule collapses to the parent's own specificity).

```ts
Selector.type(name), Selector.universal, Selector.id(name), Selector.class(name)
  // 'class' is reserved in declaration position; the module binds `_class` and re-exports it as `class`
Selector.nest                               // the & leaf: Selector<Parent>
Selector.attribute(name)                    // presence: [name]
Selector.attribute(name, value)             // assumes '=': [name='value']
Selector.attribute(name, operator, value)   // operator: '=' | '~=' | '|=' | '^=' | '$=' | '*='
  // the i/s flags are an optional-trailing-argument extension when a consumer needs them
Selector.pseudoClass(name), Selector.pseudoElement(name)
Selector.is(...list), Selector.where(...list), Selector.has(...list), Selector.not(...list)
  // selector lists, canonical-sorted; specificity = max of arguments (:where = zero);
  // :has() relative arguments (leading combinator) wait for a consumer
Selector.root                       // pseudoClass('root'), consumer-1 sugar
Selector.and(a, b)                  // dual; compound merge + canonical re-sort; compounds only
Selector.descendant(a, b), Selector.child(a, b), Selector.nextSibling(a, b), Selector.subsequentSibling(a, b)
  // dual; complex-selector joins; no combinator may follow a pseudo-element
Selector.under(child, parent)       // dual; substitutes parent for each &, discharging Parent
Selector.specificity(selector): Specificity   // closed selectors only; duplicates count
Selector.render(selector): string
Specificity.make(a, b, c), Specificity.compare, Specificity.equals
```

Consumer-1 shapes: `:root` = `Selector.root`; `:root[data-scheme='dark']` = `Selector.root.pipe(Selector.and(Selector.attribute('data-scheme', 'dark')))`; `:root:not([data-scheme='light'])` via `Selector.not`. The ok-apca hue-block selector, `:is(&, & *):is(.fill, .text)`, is `Selector.and(Selector.is(Selector.nest, Selector.descendant(Selector.nest, Selector.universal)), Selector.is(...roles))`.

### 5.2 fashionable/query — MediaQuery

A canonically ordered, deduplicated and-set of features. `or`/`not` become new node kinds when a consumer arrives.

```ts
MediaQuery.minWidth(px), MediaQuery.maxWidth(px), MediaQuery.prefersColorScheme('dark' | 'light')
MediaQuery.and(a, b)             // dual; union + canonical order + dedup; known-feature brands intersect
MediaQuery.getMinWidth(query)    // number on MediaQuery<MinWidth>, number | undefined otherwise; same shape for
MediaQuery.getMaxWidth(query)    //   MaxWidth and PrefersColorScheme ('dark' | 'light')
MediaQuery.getPrefersColorScheme(query)
MediaQuery.hasMinWidth(query)    // guards: query is MediaQuery<MinWidth>; same for the other two brands
MediaQuery.render(query, options?): string
MediaQuery.equals
```

Statically known features are type-level brands (the curvy trait pattern, as `ColorSpace` carries polar-ness): `MediaQuery<Features = unknown>` accumulates them, each constructor brands its result (`minWidth` returns `MediaQuery<MinWidth>`), `and` intersects both sides' brands, the `has*` guards recover a brand from a plain query at runtime, and the `get*` accessors key their return type on it — a bare value where the type proves the feature, `| undefined` where it doesn't. With stacked thresholds the accessor reports the conjunction's effective bound: the largest `min-width`, the smallest `max-width`. The accessors are single generic signatures with conditional returns, not overload pairs: an overloaded function contributes only its last signature to higher-order inference, so a pipe-tail accessor would lose the guarantee. Brands erase at runtime; the impl omits the optional phantom key, so the erased internals assign to every instantiation, with `MediaQuery<never>` as the internal bottom (the `Color<never>` move).

The model is semantic (a width lower bound); the rendered syntax is a **render option**: `mediaSyntax: 'prefix' | 'range'`, default `'prefix'` (`(min-width: 768px)`) so consumer 1's migration diffs cleanly; `'range'` renders `(width >= 768px)`. The option is named `mediaSyntax` on `MediaQuery.render` itself, matching every container's render options (the shared-vocabulary rule, section 7), and changes text only, never meaning.

### 5.3 fashionable/declaration — Declaration

The seam where the language halves meet.

```ts
interface Declaration<Vars> {
  name: string
  value: string | Calc<Vars> | Color<Vars> | Var // Declaration.Value<Vars>
}
Declaration.make(name, value)  // value also accepts a bare number, coerced to an unannotated
                               // constant per the Input convention; Declaration<never> for
                               // literal text and numbers. A whole-value custom-property read
                               // is a Var value — the honest spelling of
                               // 'font-family: var(--stack, sans-serif)', which as literal
                               // text would drop the read from the dependency report; its
                               // fallback may be any declaration value, nested reads included
Declaration.bind               // dual; binds expression values, identity on literal text
Declaration.render(declaration, { precision? })   // 'name: value;'
// plus vars, equals, isDeclaration
```

Values stay number-land by default, with units applied at the declaration boundary (calc-tree's posture) — but the boundary is now typed on request: `Declaration.make(handle, value)` writes through a `Var` handle (rendering `--name`), and a declared handle types its value (`Var.length('gap')` writes length-family expressions or literal text). A read as the value serves the `--alias: var(--source)` pattern.

### 5.4 fashionable/rule — RuleSet, StyleRule, MediaRule

```ts
type RuleSet.Member<Vars> = Declaration<Vars> | StyleRule<Vars> | MediaRule<Vars>
interface RuleSet<Vars>   { members: ReadonlyArray<Member<Vars>> }   // ordered, never sorted
interface StyleRule<Vars> { selector: Selector; block: RuleSet<Vars> }
interface MediaRule<Vars> { query: MediaQuery; block: RuleSet<Vars> }
RuleSet.empty, RuleSet.make(...members), RuleSet.append, RuleSet.concat   // dual append/concat
RuleSet.append(set, selector, block)   // pair form: appends StyleRule.make(selector, block)
RuleSet.append(set, query, block)      // pair form: appends MediaRule.make(query, block)
RuleSet.forSelector(block, selector)   // dual; lift a block into StyleRule.make(selector, block)
RuleSet.forMediaQuery(block, query)    // dual; lift a block into MediaRule.make(query, block)
RuleSet.MemberVars<M>   // type-level vars extraction over members; threads the unions
RuleSet.render(set, options?)          // the body between the braces, nested form, no braces
StyleRule.render(rule, options?)       // 'selector { body }'; empty block -> ''
MediaRule.render(rule, options?)       // '@media query { body }'; declarations direct (nested form)
// plus vars/equals/is* on all three types; StyleRule.make(selector, block), MediaRule.make(query, block)
```

`RuleSet` is the nesting unit; member order is preserved through rendering (the CSSNestedDeclarations fidelity requirement — declarations trailing a nested rule keep their source position, shipped across engines in late 2024). All three types carry the `Requires` channel beside `Vars` (section 4.4), threaded by `MemberRequires`: a bare declaration contributes `Parent`, a media rule passes its block's through, and `StyleRule` — whose `Requires` is its selector's alone, defaulting `never` — is the binder that discharges its block's. The pair-form `append` overloads are the API's posture: consumers think in rule sets, and `StyleRule`/`MediaRule` stay available as named types without needing to appear at construction sites. `forSelector`/`forMediaQuery` are the standalone-block counterpart — a data-last lift so a block built up through `pipe` caps off as a rule (to hand to `Stylesheet.make`, say) without naming the rule type. They are named for the argument, not the result: the block gains no selector, so `withSelector` would misattribute; the produced rule is the thing keyed on the selector or query. The dual mirror (`Selector.toStyleRule`/`MediaQuery.toMediaRule` on the upstream types) is absent: `selector` and `query` sit above `rule` in the DAG, so lifting a block there needs `StyleRule.make`/`MediaRule.make` as runtime values, which is a cycle (not a type-only edge that erases at build), violating the module map's acyclic-DAG invariant (section 2).

Each type keeps the usual public/internal file pair; the mutual recursion is broken by a shared `rule.internal.ts` holding the cross-type ref plumbing and the nested-form block renderer, so the per-type internals never import each other — with one sanctioned one-directional exception: `ruleSet.internal.ts` imports the StyleRule/MediaRule constructors for the pair-form appends (neither imports it back).

### 5.5 fashionable/font-face and fashionable/property — FontFaceRule, PropertyRule, PropertySyntax

```ts
FontFaceRule.make({ family, src: [FontFaceRule.url(href, format?) | FontFaceRule.local(name)],
  weight?: number | [number, number], style?, display?,
  unicodeRange?: [codepoint | [start, end], ...],                       // set union: canonical order, exact dups drop
  ascentOverride?, descentOverride?, lineGapOverride?, sizeAdjust? })   // percentages as numbers (90 -> '90%')

PropertySyntax.number, .color, .lengthPercentage, ...   // the fifteen registrable data types
PropertySyntax.universal                                // '*'; its own named type (Universal) for overload detection
PropertySyntax.keyword(ident)                           // one custom ident, rendered bare
PropertySyntax.keywords(a, b, ...)                      // sugar: oneOf over keywords (one name = keyword)
PropertySyntax.oneOf(a, b, ...)                         // '|' combination; authored order preserved (parse order); nested combinations flatten
PropertySyntax.listOf(x), PropertySyntax.commaListOf(x) // '+' / '#' multipliers
PropertyRule.make(name, syntax?, initialValue?)         // syntax defaults to universal; any other syntax
                                                        // requires the initial value, typed by the syntax's V
PropertyRule.inheritable(rule)                          // rules register inherits: false; this opts in
FontFaceRule.render(rule, { indent?, precision? }), PropertyRule.render(rule, { indent?, precision? }), PropertySyntax.render(syntax)
// plus equals/is* throughout; the rules self-render complete blocks — they are leaf rules with
// no nesting context, so Stylesheet.render delegates to these shapes for its at-rule nodes
```

The syntax descriptor is a modeled value, not a string. Grammar constraints are construction invariants: the universal syntax stands alone (no combination, no multiplier), a multiplier takes a single unmultiplied component, `<transform-list>` is pre-multiplied, CSS-wide keywords are not custom idents. The phantom `V` on `PropertySyntax<V>` is the initial-value domain, and `PropertyRule.make` types `initialValue` with it (`NoInfer` keeps the syntax argument the sole inference site): `<number>`/`<integer>` take `number | Calc<never>`, `<color>` takes `string | Color<never>`, keyword sets take exactly their literals, everything else takes literal text carrying its own units.

`Calc<never>`/`Color<never>` is the phantom channel doing spec enforcement: `@property` initial values must be computationally independent, so an expression with unbound variables is a type error (backed by a runtime vars check for untyped callers). Presence is enforced at both levels too: the universal-syntax overload (keyed on the branded `Universal` type, so a combination whose `V` happens to cover the full domain cannot slip through) is the only one with an optional initial value, and the runtime invariant backs it. Whether literal-text values parse under the declared syntax is not checked — the library does not parse CSS.

Descriptor order is fixed: `@font-face` renders family, weight, style, display, src, unicode-range (uppercase hex, canonical order), then metric overrides (consumer 1's emission order, byte-exact including the one-source-inline / multi-source-multiline src split); `@property` renders syntax, inherits, initial-value — the spec's conventional order, a delta from the donor's inherits-first emission.

`PropertyRule.make` also takes a `Var` handle in name position (fallback-free, rendering `--name`): a declared handle derives its syntax — `Var.length('gap')` registers `'<length>'` — with the initial value typed exactly as under the derived syntax, and an explicit syntax alongside a declared handle is consistency-checked against the canonical data types (combinations pass unchecked; grammar containment is out of scope). One exported handle per property keys registration, writes, and reads; `Var.lengthPercentage` completes the registrable-dimension set, deriving `'<length-percentage>'`.

`PropertyRule` supersedes calc-tree's `Properties` namespace (a mutable parent-child registry). The donor's `Properties.number(set, 'x', expr)` chain becomes explicit nodes: `Declaration.make('--x', expr)` + `PropertyRule.make('--x', ...)` + `Calc.var('x')` for downstream reads. The donor's hardcoded conventions (underscore prefix implies `inherits: false`; initial values `'0'`/`'transparent'`) become explicit options at the consumer's call site.

### 5.6 fashionable/stylesheet — Stylesheet

```ts
type Stylesheet.Node<Vars> = StyleRule<Vars> | FontFaceRule | PropertyRule
type Stylesheet.NodeVars<N>     // vars extraction, as RuleSet.MemberVars
Stylesheet.empty
Stylesheet.isEmpty(sheet)       // structural: no nodes (RuleSet.isEmpty likewise: no members)
Stylesheet.make(...nodes)       // variadic; NodeVars<Nodes[number]> threading
Stylesheet.append(sheet, node)  // dual; same sheet back when the node is already present
Stylesheet.append(sheet, selector, block)  // pair form: appends StyleRule.make(selector, block)
Stylesheet.render(sheet, options?)         // whole-sheet projection; see section 7
Stylesheet.merge(a, b)          // dual; order-preserving concat + structural dedup (first occurrence wins)
Stylesheet.mergeAll(sheets)
Stylesheet.coalesce(sheet, { strict? })    // separate explicit op; merges same-selector StyleRules into first occurrence
Stylesheet.vars(sheet)
Stylesheet.equals(a, b)         // dual; structural, order-sensitive
Stylesheet.isStylesheet(u)
```

**Sheets are distinct by construction**: `make` drops nodes structurally equal to an earlier one, and `append` returns the same sheet when the node is already present. The invariant is what makes the monoid below lawful on every `Stylesheet`: without it, `merge(a, empty)` would be `distinct(a.nodes)` and the identity law would fail on sheets carrying duplicates. Node order is otherwise preserved exactly as authored (never sorted, per section 4.2); dedup keeps first occurrences in place, hash-bucketed via the internal Equal protocol.

**Merge is a lawful monoid**: `merge(a, b) = a.nodes ++ (b.nodes not already present)` — associative, `empty` identity, idempotent. The identity and idempotence laws hold with instance identity, not just structurally (`merge(a, empty) === a`). That is the multi-emitter requirement: three emitters each producing the scheme-contract rules fold to one copy.

**Coalesce** is not part of merge: coalescing across an intervening same-specificity rule can change the cascade, so it is an opt-in normalization, documented order-sensitive. Each later rule's block concatenates onto the first rule with a structurally equal selector (blocks in sheet order); at-rule nodes pass through in position; a sheet with no repeated selector comes back as the same instance, so coalesce is idempotent. `{ strict: true }` turns the caution into a checked invariant: a pull throws when an intervening style rule ties the coalesced selector on specificity, unless every moved declaration is provably shadowed: the crossed rule, read in its final coalesced form, re-establishes a structurally equal declaration under a query the moved one's query implies, with no later divergent member under a co-satisfiable query. Crossings are collected during the fold and verified after it, because a re-establishing setter can arrive from a node after the moved block (the scheme mirror's toggle half); blocks nesting style rules refuse rather than being reasoned through, and matching semantics stay out of scope — a tying-but-disjoint selector still refuses when unshadowed. Query implication and co-satisfiability are computed part-wise on the canonical and-sets (a larger `min-width` implies a smaller, conflicting schemes or an empty width interval cannot co-hold), so computed specificity plus the canonical query model is what makes the check possible without any model change. The full derivation, including why encounter-time checking refuses the shape the gate exists for, lives with the strict check itself (`requireShadowedPull` in `stylesheet.internal.ts`); the feedback round that produced it has been cleared from `docs/feedback-dtcg-resolver.md` and survives in that file's git history.

There is no `Stylesheet.bind` in v1: binding happens value-side before declarations are built.

## 6. Nesting unrepresentability

Union arms and phantom parameters make the illegal nesting shapes unrepresentable wherever the types can see them; selector nesting adds the two runtime checks for the shapes they cannot:

1. `FontFaceRule`/`PropertyRule` are not `RuleSet.Member` arms — declaration-block at-rules cannot nest, so `RuleSet.append(set, fontFace)` is a compile error.
2. `MediaRule` IS a member arm with a full `RuleSet` block — conditional groups nest in style rules, holding declarations and further nesting (the CSSNestedDeclarations grammar).
3. `Declaration` is not a `Stylesheet.Node` arm — no top-level declarations.
4. `MediaRule` is a `Stylesheet.Node` arm gated on `Requires = never`: one media type serves both grammars, because the requirements channel carries the distinction. A bare declaration contributes `Parent`, so a declaration-bearing media rule types as nested-only, while a block of closed style rules types as the authored top-level `@media { selector { ... } }` grouping — first sketched as a distinct rules-only top-level type, until `docs/selector-nesting.md` section 1 derived the gate instead. Hoisting _nested-authored_ media into that flat shape remains a deferred render transform (section 7).
5. `PropertyRule.initialValue` accepts only `Calc<never>`/`Color<never>` expressions.
6. A value's `&` obligations ride `Requires` (section 4.4), and the containers thread it: a bare declaration contributes `Parent`, a media rule passes its block's requirements through, a style rule contributes its selector's — the binder discharges its block's. `specificity` takes bare `Selector` and the node union's rule arms take `Requires = never`, so an unresolved `&` at either boundary is a compile error. Two mirrors stay runtime — one because covariance cannot enforce presence, one for callers the phantom cannot see: `StyleRule.make` — the binder — requires every style rule reachable in its block through media transparency to reference `&` (CSS would silently prepend a descendant `&`; the model rejects the shape rather than rewriting the authored selector), and `Stylesheet.make`/`append` re-check node closure.

The type-level shapes are pinned by `@ts-expect-error` type tests in `test/types.spec.ts`; item 6's runtime mirrors are pinned both directions in `test/rule.spec.ts` and `test/stylesheet.spec.ts`.

One nesting shape stays representable: a style rule under a style rule, which the nesting extension claims (`docs/selector-nesting.md`). Until that ships, every renderer refuses it (section 7).

## 7. Rendering

Every renderable type carries its own `render`, so fragments and partials emit without ceremony; the whole-sheet projection lives on `Stylesheet.render`. Output mirrors the authored structure — media renders nested inside its rule — and is deterministic: canonical formatting, stable ordering.

```ts
// fragment renderers, per module (with the option subset each needs):
Selector.render(selector)                                  // no options
PropertySyntax.render(syntax)                              // no options
MediaQuery.render(query, { mediaSyntax? })
Declaration.render(declaration, { precision? })
FontFaceRule.render(rule, { indent? })
PropertyRule.render(rule, { indent?, precision? })
RuleSet.render(set, { indent?, precision?, mediaSyntax? })
StyleRule.render(rule, { indent?, precision?, mediaSyntax? })
MediaRule.render(rule, { indent?, precision?, mediaSyntax? })

// the whole-sheet projection; its options are the superset of all of the above:
Stylesheet.RenderOptions = { indent?: string; precision?: Precision; mediaSyntax?: 'prefix' | 'range' }
Stylesheet.render(sheet, options?): string
```

**The render-options family**: the `RenderOptions` interfaces extend one another, rooted at `MediaQuery.RenderOptions` — `Declaration.RenderOptions` adds `precision`, `RuleSet.RenderOptions` adds `indent` (`StyleRule`/`MediaRule` take it unchanged), `FontFaceRule`/`PropertyRule` extend the declaration tier with `indent`, and `Stylesheet.RenderOptions` is `RuleSet.RenderOptions` unchanged (the whole-sheet renderer adds no option of its own). A key means the same thing wherever it appears, renderers ignore inherited keys that don't apply (a declaration has no media text to spell), and an options object built for a bigger renderer is accepted by every smaller one — build one `Stylesheet.RenderOptions` value and pass it to any `render` in the library. This is why `MediaQuery.render`'s option is named `mediaSyntax` rather than a bare `syntax`.

`Stylesheet.render` emits each style rule in nested form, exactly as `StyleRule.render` does — `@media` blocks kept inside their rule, declarations in member order — and each top-level `@media` node as its own `@media { rules }` section. Rewriting _nested-authored_ media into that flat shape is a render-time hoisting transform, one of a family of structural rewrites (hoisting, and its inverse, auto-nesting safe selectors) deferred until a consumer needs one; the option's shape (which constructs to hoist, in what order) is left undesigned. Nested style rules render natively: an `&`-bearing selector emits verbatim as an indented sub-block, the shape `@media` blocks already take (`docs/selector-nesting.md`, driven by ok-apca's hue blocks in `docs/ok-apca-feedback.md`). Flattened output (`&` rewritten to `:is(parent)`, rules de-nested) is deferred with the other structural rewrites; `Selector.under` is its primitive, so it costs no new theory when a consumer arrives.

Emission conventions, pinned by golden fixtures shaped like consumer 1's real output: top-level sections join with one blank line, no trailing newline (consumer 1 adds its own at the file boundary); empty blocks emit nothing — a rule whose block is empty, or holds only empty media rules, is skipped, and the fragment renderers return the empty string for the same shapes; a nested `@media` or style-rule block sits one indent inside its rule, its declarations one further (byte-exact at `indent: '  '`).

Options change text, never meaning: `indent` (default tab), `precision` (the serialization context default), `mediaSyntax` (section 5.2).

## 8. Sequencing (all phases shipped)

Each phase landed with its tests; the consumer smoke fixtures close the in-repo work — what remains for v1 is the consumer migrations, in the consumer repos.

1. **selector + media** — shipped. Canonical-ordering equality, duplicate-part and `:not` specificity, consumer-1's selector shapes byte-exact, media and-composition dedup, `mediaSyntax` both ways. The nesting extension's families landed with it: the canonical `&` slot (`div&`), functional-pseudo lists (argument sorting, max-of-arguments specificity, `:where` zero), combinator sequences and their grammar guards, `under` equivalences (compound merge versus `:is()` wrap, chained binders), and the `Requires` gates as type tests.
2. **declaration + rule** — shipped. Vars threading through variadic `make` (type tests), member-order preservation and order-sensitive equality, non-member rejection; the section-6 type tests that involve at-rules and stylesheets land with phases 3-4.
3. **at-rule** — shipped. Font-face descriptor rendering (weight ranges, multi-src, metric overrides) byte-exact against consumer 1's emission shape, `PropertyRule` with closed initial values; sections 6.1 and 6.5 are now pinned by type tests, 6.3-6.4 land with the stylesheet phase.
4. **stylesheet** — shipped. Merge monoid laws (identity and idempotence hold with instance identity, not just structurally), dedup-across-emitters scenario, coalesce semantics and order documentation, vars aggregation; sections 6.3 and 6.4 are now pinned by type tests. The container channel landed with its own families: requirement extraction through `RuleSet`/`StyleRule`/`MediaRule`, and the top-level `@media` node — rules-only renders as its own section and threads its vars, parent-needing media refuses at compile time and at runtime.
5. **render** — shipped. Nested-form rendering mirroring the authored structure, `@media` kept inside its rule; CSSNestedDeclarations order fidelity (a declaration trailing a nested media rule keeps its cascade position); golden fixtures shaped like consumer 1's real output (`:root` base + nested min-width blocks + dark mirror pair + `@font-face` + `@property`, byte-exact); `mediaSyntax` both ways; nested style rules as indented sub-blocks with `&` verbatim, the binder and root invariants pinned both directions.
6. **consumer smoke + docs** — shipped (`test/consumers.spec.ts`), checked against both consumers' real emitters. The ok-apca fixture: `@property` registrations under its conventions (underscore prefix means non-inheriting, initial values `0`/`transparent`), a `.fill` role block whose gamut-tent chain is authored once over named references and bound per hue (constants fold into the emitted `calc()` exactly as ok-apca's hue blocks do), byte-exact render, solve/serialize duality — the same tree solved in JS matches the closed form on both tent branches — and the nested hue block (`.red { :is(&, & *):is(.fill, .text) { ... } }`) pinned byte-for-byte against the string ok-apca assembled by hand before the nesting extension. The dtcg fixture: three emitters (color, stroke, typography) each leading with the shared scheme contract, folded with `mergeAll` to one contract copy in first-occurrence order; `@font-face` real + metrics-adjusted fallback pair; ascending min-width block; the dark mirror pair in dtcg's order (prefers-color-scheme first); the fluid-curve helper property carrying the `cos(acos(...))` inverse; `vars` reporting the sheet's one unbound variable; and a coalesce pass folding the emitters' `:root` rules into one block. Two findings recorded for the migrations: dtcg emits no `@property` today (its fluid helper is a plain custom property), and ok-apca's calc-tree has no `cos`/`acos` — the trig-inverse shape is dtcg's fluid-curve helper, so the migrations exercise disjoint halves of the value layer. The migrations themselves: ok-apca replaces `Properties` (needs phases 2-4); dtcg-resolver migrates per its `css-rule-model.md` plan.

## 9. Open questions and risks

- **Vars threading through containers** (section 4.3): the type machinery is the heaviest part of the design; relax to runtime-only sets if consumer inference pain shows up. The channel now runs on first-class `Var` identities (`docs/vars.md`, shipped in 0.4) — the escape hatch survives the move.
- **Nested-only MediaRule and rendering** (sections 6.4, 7): v1 renders media nested inside its rule. dtcg's current `renderPhysical` emits the traditional flat shape (`@media conditions { selector { ... } }`), so a migration onto fashionable's nested output changes dtcg's emitted CSS — acceptable on the browsers the consumers target, where native `@media` nesting is baseline. A flat/hoisting render transform is deferred until a consumer needs it.
- **Selector nesting (`&`)**: shipped native-nested (`docs/selector-nesting.md`, driven by ok-apca's hue blocks in `docs/ok-apca-feedback.md`) — the complex-selector grammar, the `Requires` channel on `Selector` and the containers, the binder and root invariants, nested rendering, and `MediaRule` in the node union (authored top-level `@media`). What remains of the design's phase 3 waits on consumer demand: relative `:has()` arguments, and flattened rendering via `under`.
- **Coalesce cascade safety**: shipped in two tiers — the default documents order sensitivity, `strict` refuses unsafe pulls (section 5.6). The strict check is conservative: blocks nesting style rules and tying-but-disjoint selectors refuse rather than being reasoned through; loosen only when a consumer hits a refusal that matters.
- **Typed units**: values stay number-land with units at the declaration boundary; revisit after consumer 1 migrates. The read side shipped: typed `Var` constructors (`docs/vars.md` section 7) put a data type on the handle, so a declared `<length>` var lifts as a length-family read, binds only to length-family values, and registers `'<length>'` — with no new arithmetic machinery.
- **Angle escape hatch**: if a consumer ever needs an acos result as a plain number in CSS (not inside trig), that requires typed division (`/ 1rad`) and a browser-floor decision — out of v1.
