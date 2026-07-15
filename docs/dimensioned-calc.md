# fashionable — dimensioned calc (`<length>` and `<angle>`)

A design proposal for extending the value layer from `<number>` only to
`<number>`, `<length>`, and `<angle>`, tracked through the type system. It is
the successor scope to `design.md`'s two deferred open questions — typed units
(section 9) and the angle escape hatch (section 3.3) — and resolves both by
giving the calc tree a real notion of dimension.

Every type-level construct below is validated by a spike typechecked against
the repo's TypeScript 6.0.3 under `strict` + `exactOptionalPropertyTypes` +
`noUncheckedIndexedAccess`. Where the text says "proven," a green run with a
teeth-verified assertion harness backs the claim.

The solve model in section 6 incorporates dtcg-resolver's consumer feedback
(`feedback-dtcg-resolver.md`, section 1): the fluid consumer needs one tree to
serve verification, runtime evaluation, and serialization at once, so solving a
unit-bearing tree lowers its leaves through a context rather than refusing.

## 1. Goal and scope

- Calc gains `<length>` and `<angle>`, tracked at the type level so illegal
  dimensional states are unrepresentable (design.md principle 1), not merely
  caught at runtime.
- Units in scope, driven by real consumer need: `px`, `rem`, `em`, `vw`, `vh`,
  `vmin`, `vmax` (`<length>`); `rad` (`<angle>`). Percentage is deferred
  (section 11). `deg`/`turn`/`grad` are trivial later additions, unbuilt until
  a consumer needs them.
- A new `fashionable/data` module holds the value vocabulary: `Length`,
  `Angle`, and — folded in from `fashionable/color` — `Color` (section 9).
- The calc core stays **unit-agnostic**: it reasons about dimension and unions
  a leaf-provenance set, but never enumerates units. Data modules own the unit
  vocabulary.

## 2. The core model — CSS calc is dimensional analysis

CSS Values and Units L4 gives every calc sub-expression a *type*: a map from
base kinds (length, angle, time, frequency, resolution, percent, flex) to
integer exponents, plus a percent hint. `+`/`-` require equal types, `*` adds
exponents, `/` subtracts, and each math function has its own rule. The library
today models only the empty-map (dimensionless) corner, with `producesAngle`
and the `1rad` machinery in `calc.internal.ts` bolted on to fake angle-ness at
serialization time.

**Closed-kind model, not the full exponent algebra.** We cap the tracked set at
degree-1 kinds — `number | length | angle`, with room for `time`/`resolution`
later — and make transitions that would leave the set (`length * length`)
compile errors. The payoff is that the type-level algebra is a finite
conditional-type lookup, not integer arithmetic over a record: cheap to
evaluate, fast to check, and legible in error messages. The set is closed under
exactly the operations real CSS authoring uses (section 4).

## 3. The value type — `Calc<Refs, Kind, Leaves>`

Three phantom facets, following Effect Schema's `Schema<A, I, R>` shape and its
`Schema.Top` supertype pattern:

```ts
declare const CalcTypeId: unique symbol
declare const Variance: unique symbol

interface Calc<
  out Refs extends string = string,
  out Kind extends Calc.Kind = Calc.Kind,
  out Leaves = unknown,
> extends Pipeable {
  readonly [CalcTypeId]: typeof CalcTypeId
  readonly [Variance]: { readonly refs: Refs; readonly kind: Kind; readonly leaves: Leaves }
}

namespace Calc {
  export type Kind = 'number' | 'length' | 'angle'
  export type Top = Calc<string, Kind, unknown>
}

// facet extractors — one type var per operand at the call sites
type RefsOf<A> = A extends Calc<infer R, Calc.Kind, unknown> ? R : never
type KindOf<A> = A extends Calc<string, infer K, unknown> ? K : 'number' // bare number -> number
type LeavesOf<A> = A extends Calc<string, Calc.Kind, infer L> ? L : never

type In = Calc.Top | number
```

- **`Refs`** is unchanged in meaning: unbound reference names, the
  custom-property channel (design.md section 4.3).
- **`Kind`** is the CSS dimension of the whole expression — what it can be
  assigned to and combined with. Drives the algebra in section 4.
- **`Leaves`** is an accrued set of unit brands present in the tree. It types
  the unit context that `solve` requires (section 6), and is what makes a new
  data module's units flow through the algebra with no calc-core change.
  Sections 5 and 6 are the substance.

**Variance encoding — a required struct, not optional fields.** The current
codebase carries `Refs` as an optional phantom (`readonly [CalcRefs]?: Refs`).
Under `exactOptionalPropertyTypes`, an optional phantom appends a confusing
tail to every mismatch diagnostic (`Consider adding 'undefined' to the types of
the target's properties`). A single **required** variance struct removes that
noise — a `length` vs `number` mismatch reads as exactly that:

```
Type 'Calc<never, "length", Unit.Px>' is not assignable to type 'Calc<string, "number", unknown>'.
  Type '"length"' is not assignable to type '"number"'.
```

The implementation class carries the phantom as a type-only `declare` field
(no runtime emit, no construction burden), the way it already casts brands.

## 4. The kind algebra

All rules are non-recursive conditional types over the closed kind set.

- **Add, subtract, min, max, clamp, abs**: operands share a kind, result is
  that kind. A bare number is `number`-kind, so `length + number` is invalid —
  strictly same-kind, no number absorption.
- **Multiply**: `number * K = K`, `K * number = K`; two dimensioned operands
  are invalid.
- **Divide**: `K / number = K`, `K / K = number`; `number / length` and mixed
  dimensions are invalid.
- **Trig and powers**: `pow`, `signedPow`, `sqrt` take `number`, return
  `number`; `sin`/`cos` take `number` or `angle`, return `number`; `acos`
  takes `number`, returns `angle`.

**Invalid combinations are compile errors (proven), not runtime throws.**
Multiply and divide each split into two overloads that require at least one
operand to satisfy the relevant kind, so an invalid call matches neither:

```ts
type NumberIn = number | Calc<string, 'number', unknown>
type SameKindIn<A> =
  | Calc<string, KindOf<A> & Calc.Kind, unknown>
  | (KindOf<A> extends 'number' ? number : never)

declare function multiply<A extends NumberIn, B extends In>(a: A, b: B):
  Calc<RefsOf<A> | RefsOf<B>, KindOf<B> & Calc.Kind, LeavesOf<A> | LeavesOf<B>>
declare function multiply<A extends In, B extends NumberIn>(a: A, b: B):
  Calc<RefsOf<A> | RefsOf<B>, KindOf<A> & Calc.Kind, LeavesOf<A> | LeavesOf<B>>

declare function divide<A extends In, B extends NumberIn>(a: A, b: B):
  Calc<RefsOf<A> | RefsOf<B>, KindOf<A> & Calc.Kind, DivLeaves<A, B>>
declare function divide<A extends In, B extends SameKindIn<A>>(a: A, b: B):
  Calc<RefsOf<A> | RefsOf<B>, 'number', DivLeaves<A, B>>
```

`multiply(Length.px(10), Length.px(10))` and `divide(Length.px(10),
Angle.rad(1))` both fail with `TS2769: No overload matches this call` and the
correctly-reasoned "length is not assignable to number" cause. `length * number`,
`number * length`, `length / number`, and `length / length` all resolve.

## 5. The leaves facet and `data/units.ts`

**Data modules own their leaf brands.** `data/units.ts` declares one
`unique symbol` per dimension family and the named unit types; `length.ts` and
`angle.ts` pull the ones they construct. A concrete expression's third facet
reads as a union of named brands — `Unit.Vw | Unit.Px | Unit.Rad` — not
`LengthUnit<'px'>`:

```ts
// data/units.ts
declare const LengthUnitId: unique symbol
declare const AngleUnitId: unique symbol
namespace Unit {
  export interface Px { readonly [LengthUnitId]: 'px' }
  export interface Vw { readonly [LengthUnitId]: 'vw' }
  // rem, em, vh, vmin, vmax ...
  export interface Rad { readonly [AngleUnitId]: 'rad' }
  export type Length = Px | Rem | Em | Vw | Vh | Vmin | Vmax
  export type Angle = Rad
  // the partition section 6 solves on: absolute (context-free) vs relative
  export type Relative = Rem | Em | Vw | Vh | Vmin | Vmax
  export type AbsoluteLength = Px // (+ cm, in, pt, ... later)
  export type ContextFree = AbsoluteLength | Angle
}

// data/length.ts, data/angle.ts — stamp kind + leaf
declare const Length: {
  px(n: number, precision?: Precision): Calc<never, 'length', Unit.Px>
  vw(n: number, precision?: Precision): Calc<never, 'length', Unit.Vw>
  // ...
}
declare const Angle: { rad(n: number, precision?: Precision): Calc<never, 'angle', Unit.Rad> }
```

Because `LengthUnitId` and `AngleUnitId` are distinct symbols, `Unit.Px` and
`Unit.Rad` are nominally distinct — which section 6 relies on. The `Precision`
annotation rides on dimensioned constructors exactly as on `Calc.of`; units are
orthogonal to formatting (the value formats, then the unit suffixes).

**Accrual is simpler than `Refs`.** Every operator unions its operands' leaves;
`bind` only ever adds leaves (binding a ref to a length introduces a unit),
never removes them. There is no leaf analog of ref subtraction.

**The leaf set is a sound over-approximation.** Folding can cancel a unit that
the type already accrued — `divide(Length.px(320), Length.px(160))` folds to
the constant `2` at runtime, unitless. The type-level leaf set is a union of
*operand* leaves, and folding only ever removes leaves, so the type never
under-reports: `Leaves = never` guarantees a genuinely pure tree. It can
over-report (section 6 shows how the divide overload recovers the common case).

## 6. Solving and the unit context

`solve` returns a JS number. Solving is **leaf lowering plus numeric
evaluation**: each unit leaf lowers to a number through a unit context (the
number-per-unit ratios), then arithmetic proceeds numerically. When the tree is
dimensionally coherent — which the section-4 kind algebra guarantees for any
tree built through the typed constructors — this is mathematically identical to
a full unit-aware evaluator: the units that should cancel do, because the
numeric arithmetic mirrors the dimensional arithmetic. No operator-level
dimensional analysis runs at solve time (this is dtcg-resolver's observation).

This is the one-source-of-truth model (design.md principle 3): one tree serves
build-time verification (solve at sample viewport widths against the curve
sampler), runtime evaluation, and serialization. Two alternatives were rejected
because both split that source and reintroduce the numeric-twin drift the
solve/serialize duality exists to kill — authoring number-land trees with refs
as unit slots (bind numbers to solve, unit-expressions to serialize) maintains
two binding tables that nothing cross-checks; making length trees serialize-only
forces a separate numeric twin for verification. In the linear-clamp fluid form
the unit-bearing leaves are the coefficients themselves, so both alternatives
migrate the coefficients into two places at once.

**The context is typed by `Leaves`.** The partition that governs solving is
absolute vs context-dependent units, not length vs angle: `px` (ratio 1) and
`rad` (radians are the number) lower with no context; `rem`/`em`/`vw`/`vh`/
`vmin`/`vmax` need viewport/font ratios. `solve` splits accordingly:

```ts
type KeyOf<L> =
  L extends { readonly [LengthUnitId]: infer U } ? U
  : L extends { readonly [AngleUnitId]: infer U } ? U
  : never

// relative units are required keys; absolute lengths are optional overrides
// (solve in a non-px base); angle units never appear (rad lowers canonically)
type UnitContext<L> =
  & { readonly [K in KeyOf<Extract<L, Unit.Relative>> & string]: number }
  & { readonly [K in KeyOf<Extract<L, Unit.AbsoluteLength>> & string]?: number }

declare function solve(expr: Calc<never, Calc.Kind, Unit.ContextFree>): number
declare function solve<R extends string, L>(
  expr: Calc<R, Calc.Kind, L>,
  bindings: Record<R, number>,
  context: UnitContext<L>,
): number
```

- A pure, angle-only, or absolute-length tree solves with no context
  (`Unit.ContextFree = Unit.AbsoluteLength | Unit.Angle`). `solve(acos(0.5))`,
  `solve(Length.px(10))`, and `solve(Angle.rad(2))` all compile bare.
- A relative-unit tree requires a `UnitContext<Leaves>` supplying exactly the
  context-dependent keys present. The fluid curve (`Unit.Vw | Unit.Px |
  Unit.Rad`) requires `{ vw: number }` — px defaults, rad is canonical, and a
  wrong key (`rem` on a tree that has none) is rejected. All proven.

**Kind is not the same question as solvability.** The fluid curve is
`number`-kind at the top — `(100vw - 320px) / 160px` is `length / length =
number`, so the units seal themselves off inside the ratio — yet solving it
still needs the `vw` ratio because the ratio is not constant. Kind answers "what
can this combine with and serialize as"; the context answers "what must I supply
to lower it to a number." They are different, and `Leaves` carries the second.

**The leaf set predicts the context exactly.** The conservative-but-sound leaf
tracking (section 5) and the context requirement are two views of one fact:

```ts
type DivLeaves<A, B> =
  KindOf<B> extends 'number' ? LeavesOf<A>                       // length / number -> keep a's leaves
  : SameSingleton<LeavesOf<A>, LeavesOf<B>> extends true ? never // px / px -> provably pure
  : LeavesOf<A> | LeavesOf<B>                                    // (px|vw) / px -> conservative
```

When units cancel (`320px / 160px` -> `Leaves = never`) no context is needed,
and the value (2) is genuinely ratio-independent. When they do not
(`(100vw - 320px) / 448px` -> `Leaves = Unit.Vw | Unit.Px`) the context needs
exactly those ratios. The singleton-cancellation divide overload and the context
typing agree by construction.

**Coherence — compile-time primary, runtime fallback.** Leaf lowering would
solve an incoherent tree (a raw number added to a length) to a meaningless
number silently. Two defenses, in the library's existing phantom-plus-runtime
posture: the section-4 kind algebra makes incoherent trees uncompilable, so any
tree built through the typed API is coherent by construction and leaf lowering
can trust it; and for dynamically assembled (untyped) trees, an optional runtime
projection runs the CSS calc type algebra over the bound tree and throws on
invalid combinations — the same algebra at runtime, where the build gates live.
This is also what dissolves the earlier angle-solvability question: angles are
simply the units whose ratios are constants, not a separate solvability class.

## 7. Combinator surface — retiring the arity ladder

`add`/`min`/`max` are an overload ladder today (2, 3, 4 args, then a variadic
fallback that widens to `Calc<string>`), so ref inference silently degrades past
four operands and every new facet must be re-threaded through each rung. A
single rest-parameter signature with a mapped homogeneity constraint replaces
the ladder and lifts the cap (proven at arity 5):

```ts
type RefsOfAll<T extends readonly unknown[]> = { [K in keyof T]: RefsOf<T[K]> }[number]
type LeavesOfAll<T extends readonly unknown[]> = { [K in keyof T]: LeavesOf<T[K]> }[number]

declare function add<A extends In, B extends SameKindIn<A>, Rest extends readonly SameKindIn<A>[]>(
  a: A, b: B, ...rest: Rest
): Calc<
  RefsOf<A> | RefsOf<B> | RefsOfAll<Rest>,
  KindOf<A> & Calc.Kind,
  LeavesOf<A> | LeavesOf<B> | LeavesOfAll<Rest>
>
```

`add(ra, rb, rc, rd, re)` proves to `Calc<'a' | 'b' | 'c' | 'd' | 'e',
'number', never>` — the old ladder would have collapsed this to `Calc<string>`.
The `Rest extends readonly SameKindIn<A>[]` bound enforces one homogeneous kind
across all operands. `min` and `max` take the identical shape; `clamp` stays a
fixed ternary. This is a net simplification of the existing surface, independent
of dimensions.

## 8. Serialization

- Dimensioned constants serialize value-then-unit (`10px`, `2.094395102rad`);
  the `pi` special case stays number-only; `calc()` wrapping is unchanged.
- **The angle hack collapses into real dimensions.** With `acos` genuinely
  angle-kind and `angle - number` a type error, there is no longer a plain
  number masquerading beside an angle. `producesAngle`, the `asAngle` branches
  in `serializeTerm`/`serializeNegated`, and the `1rad` factor all delete — a
  sum is either all-angle (each term serialized with its own unit) or
  all-number. The negative-coefficient subtractive rendering (`a + (-k)` -> `a -
  k`) is kind-agnostic and stays.
- **Migration.** Today `Calc.subtract(acos(...), 2.0943951)` auto-suffixes to
  `2.0944rad`. Under real typing that operand must be `Angle.rad(2.0943951)`,
  and a bare number is rejected. `trig.spec`'s angle-typed-serialization block
  and the `consumers.spec` fluid-curve golden update accordingly. This is the
  clean-break call from design.md section 8 (consumers have not migrated yet).

## 9. Module reshape — `fashionable/data`

`fashionable/color` folds into `fashionable/data`, which gains `length`,
`angle`, and `units`. The subpath export becomes `./data`; `Length`, `Angle`,
`Color`, and `Unit` are its namespaces.

- DAG stays acyclic: `data -> calc`. The calc core stays unit-agnostic, so it
  does not import `data`; the leaf brands flow in only as type arguments.
- `Color.oklch`'s hue channel becomes a natural `<number> | <angle>` consumer of
  `Angle` (CSS types oklch hue as `<number> | <angle>`), so `Color.oklch(l, c,
  Angle.rad(h))` and a bare-number hue both type.
- A future `Time`/`Resolution` module adds its own `unique symbol` and unit
  types; the generic kind algebra and leaf accrual absorb it with no calc-core
  change. This extensibility is the reason leaves are module-branded rather than
  a calc-core enum.

## 10. Downstream seams

- **`Declaration.Value`** widens to accept any-kind, any-leaf `Calc` — the
  kind-agnostic pass-throughs (`Declaration`, rule members) top out at
  `Calc<Refs, Calc.Kind, unknown>`, since they only serialize. This fulfills
  design.md section 5.3's promise not to foreclose typed units:
  `Declaration.make('--gap', Length.px(8))` works with no string concatenation.
- **`PropertySyntax`** length/angle initial-value domains change from `string`
  to also accept a closed dimensioned expression — `string | Calc<never,
  'length', Unit.Length>` and the angle analog (the exact alias spelling follows
  the `export * as` barrel convention, not a type/namespace merge).
  `types.spec.ts:50`, which currently *asserts* that a `<length>` initial value
  cannot be an expression ("expressions serialize unitless"), inverts to accept
  `Length.px(0)`. This resolves design.md section 9's typed-units question.
- **`solve`** gains the section-6 context parameter (required exactly when the
  tree carries context-dependent units); the optional runtime coherence check
  backs it for dynamically built trees, mirroring the existing unbound-refs
  check (belt and suspenders, per section 4.3).

## 11. Open decisions

- **Percentage.** The genuinely hard corner (context-resolved, percent hint);
  `50%` is length-percentage in one property and number-percentage in oklch.
  Deferred. If a consumer needs it, model `length-percentage` as the single join
  kind consumers target, not full percent-hint resolution.
- **Kinded refs and binding kind-checks.** `Calc.ref('gap')` defaults to
  `number`-kind today; a length-typed `var()` (`calc(var(--gap) + 10px)`) needs
  a kinded ref, and bindings should kind-check against the ref's kind. Neither
  consumer needs it now (the fluid curve has no refs mixed with dimensions), so
  it is the one type-design question left open — resolve before it becomes
  load-bearing.
- **Context defaults policy.** `px = 1` and `rad`/`deg` canonical are the
  built-in ratios that let absolute-unit trees solve context-free (section 6).
  The one call to make: whether an absolute length in the context is an optional
  *override* (solve in a non-px base) or fixed. The spike models it as an
  optional override; that is the recommendation.
- **Residual-ref assertion on serialize.** Orthogonal to units but flagged by
  the consumer: a forgotten `bind` emits `var(--x)` — silently wrong CSS that
  solve-side verification cannot catch, and it makes `Stylesheet.refs` lie. A
  serialize option asserting the residual ref set (`expectRefs: [...]`) closes
  the hole cheaply. Quantities-in-tree (this design) removes the unit half of
  the hazard — units are leaves, not refs — but real custom-property refs keep
  it, so the assertion is worth adding.
- **Resolved by this revision.** Angle solvability (angles are just
  constant-ratio units, section 6); absolute-length solving (falls out of the
  context model); invalid-combo ergonomics (the section-4 two-overload encoding
  makes them compile errors, not `never`-kind poison).

## 12. Sequencing

1. **Runtime dimension layer**, `Calc` arity unchanged: unit on nodes, kind
   derivation, folding with unit-equality and kind validation, unit
   serialization, `data` constructors returning plain `Calc<Refs>`. Delivers the
   serialization capability with near-zero blast radius, validated by throwing.
   Unblocks `Declaration.make('--gap', Length.px(8))` alone.
2. **Phantom facets**: add `Kind` and `Leaves`, the variance-struct encoding,
   the section-4/6/7 signatures, the `Unit` brands, and the `@ts-expect-error`
   type tests. Purely additive over step 1.
3. **Retire the angle hack** (section 8); update `trig.spec` and the
   `consumers.spec` golden.
4. **Seam integration** (section 10) and the `color -> data` move.
5. **Docs**: fold this into `design.md` — module map (section 2), the angle
   boundary (section 3.3 becomes a special case of dimensions), and the section
   9 open questions.

## Appendix — the spike

The type-level model in sections 3-7 was built as a self-contained spike and
typechecked green against TypeScript 6.0.3 with the repo's strict flags, using
an assertion harness verified to fail on both a wrong `Expect<Equal<...>>` and
an unused `@ts-expect-error`. Proven: three-facet inference and `Calc.Top`
extraction; `Unit.*` brands; the variadic `add` at arity 5; compile-time
rejection of `length * length` and `length / angle`; singleton cancellation
honesty; the full fluid curve typing to `Calc<never, 'number', Unit.Vw |
Unit.Px | Unit.Rad>`; and the required-variance-struct diagnostic cleanup.

The section-6 context-lowering solve was proven in a second spike: `UnitContext<
Leaves>` demands exactly the context-dependent keys (`{ vw: number }` for the
fluid curve), absolute lengths are optional overrides, angle units never appear,
pure/angle/absolute-length trees solve context-free, and a wrong context key is
rejected.
