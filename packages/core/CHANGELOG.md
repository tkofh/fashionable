# fashionable

## 0.3.0

### Minor Changes

- 734b64b: `MediaQuery` now records statically known features as type-level brands (the curvy trait pattern `ColorSpace` already uses for polar-ness), and the feature set gains `max-width`. Each constructor brands its result — `minWidth` returns `MediaQuery<MinWidth>`, the new `maxWidth` returns `MediaQuery<MaxWidth>`, `prefersColorScheme` returns `MediaQuery<PrefersColorScheme>` — and `and` intersects both sides' brands, including through `pipe` composition. New accessors key their return type on the brand: `getMinWidth`, `getMaxWidth`, and `getPrefersColorScheme` return a bare value where the type proves the feature is present and `| undefined` anywhere else, with stacked thresholds reporting the conjunction's effective bound (the largest `min-width`, the smallest `max-width`). The `hasMinWidth`/`hasMaxWidth`/`hasPrefersColorScheme` guards recover a brand from a plain query at runtime. Brands erase at runtime and the `Features` parameter defaults to `unknown`, so existing `MediaQuery` annotations keep working unchanged. In canonical order, `max-width` renders between `min-width` and `prefers-color-scheme`; existing queries render exactly as before.
- 734b64b: Strict `coalesce` is now shadow-aware. A pull across a specificity tie no longer refuses unconditionally: it is allowed when every moved declaration is provably shadowed by the crossed rule — the crossed rule, in its final coalesced form, re-establishes a structurally equal declaration under a media query the moved one's query implies, with no later member under a co-satisfiable query setting a different value. The scheme-mirror shape (one logical dark rule spelled as both `@media (prefers-color-scheme: dark)` under `:root:not([data-scheme='light'])` and the bare `:root[data-scheme='dark']` toggle) now passes the gate built for it, while a producer that emits only one half still refuses. Crossings are verified against the crossed rule's final members, so a re-establishing setter may arrive from a rule later than the moved block. Blocks nesting style rules refuse as before. Refusal messages now name the unshadowed declaration and the crossing rule. The change is strictly more permissive: every sheet that passed `{ strict: true }` before still passes.

## 0.2.0

### Minor Changes

- c666ef9: `Color` moved into the `data` module, joining the dimension constructors as the value-layer data types beyond bare expressions. The `fashionable/color` subpath is gone.

  Migration: `import { Color } from 'fashionable/color'` becomes `import { Color } from 'fashionable/data'`. The API is unchanged.

- c666ef9: `Color.lightDark(light, dark)` models the scheme-conditional `light-dark()` function: `Color.lightDark(Color.srgb(0.85, 0.3, 0.4), Color.srgb(0.95, 0.5, 0.55))` serializes as `light-dark(color(srgb 0.85 0.3 0.4), color(srgb 0.95 0.5 0.55))`. Arms are whole colors of any form (mixing `oklch` and `srgb` is fine, nesting is legal), their references union into the result, and `bind` reaches through both. Arms are positional — the first slot is the light scheme — so `lightDark(a, b)` never equals `lightDark(b, a)`. The `color-scheme` contract that makes `light-dark()` resolve remains the consumer's to emit.
- c666ef9: `Color.mix(space, color1, color2)` models the `color-mix()` function. The interpolation method is a `ColorSpace` (`Color.mix(ColorSpace.oklch, a, b)` renders `color-mix(in oklch, a, b)`); a polar space takes an optional `HueInterpolation` in a second position (`Color.mix(ColorSpace.oklch, HueInterpolation.longer, a, b)` renders `in oklch longer hue`), and a hue strategy after a rectangular space is a type error, matching the grammar. Each arm is a bare `Color` or a `[color, weight]` tuple — the weight a bare number read as a percent (`20` is `20%`) or a `Percentage` for an annotated or computed one. Weights are optional and preserved verbatim: fashionable emits the authored form and leaves the spec's mixing normalization (omitted weights defaulting to `50%`, off-`100%` sums rescaling) to the browser. Arms and weights union their references, `bind` reaches through both, and — like every `Color` — a mix serializes but does not solve.
- c666ef9: Named colors: `Color.named('rebeccapurple')` renders its name bare, and `Color.transparent` is the blessed constant for the conventional "no color" value. A named color is a whole-value node — no channels, no references, nothing to bind — and composes anywhere a `Color` goes, `light-dark(transparent, …)` included. Names are not checked against the specification's list, with one exception: the CSS-wide keywords (`inherit`, `initial`, …) are whole-declaration values, not colors, and are rejected.
- c666ef9: `Color.ref(name)` reads a whole color from a custom property: `Color.ref('accent')` serializes as `var(--accent)`. The reference is the entire value — so it carries `name` as its one unbound reference, a dependency exactly as `Calc.ref` is, and has no channels. `bind` substitutes channel expressions, not whole colors, so it leaves a color reference in place for the browser to resolve from the cascade.
- c666ef9: `Color.from(origin, space, channel1, channel2, channel3, alpha?)` models relative color syntax: `Color.from(Color.ref('accent'), ColorSpace.oklch, l, c, h)` renders `oklch(from var(--accent) l c h)`, and an `srgb` destination renders the `color(from … srgb r g b)` form. The browser converts `origin` into `space` and exposes its channels as the `Channel` keywords the space names — `Channel.L`/`C`/`H` for `oklch`, `Channel.R`/`G`/`B` for `srgb`, `Channel.Alpha` for both — so passing them straight through reproduces the origin, and arithmetic on them derives a related color.

  The `space` scopes the channel arguments: a keyword the destination space does not name (`Channel.R` in an `oklch` slot) is a compile error. Each slot is a bare number, `Keyword.none`, or a `Calc` number expression, and serializes independently — wrapped in `calc()` when arithmetic, bare when a lone keyword. A supplied `alpha` renders after a slash; omitted, the origin's alpha carries through. The origin's own references union into the result; the channel keywords contribute none, since the browser resolves them from the origin. Like every `Color`, a relative color serializes but does not solve.

  ```ts
  import { Calc } from 'fashionable/calc'
  import { Channel, Color, ColorSpace } from 'fashionable/data'

  const hover = Color.from(
    Color.ref('accent'),
    ColorSpace.oklch,
    Calc.multiply(Channel.L, 0.8),
    Channel.C,
    Channel.H,
  )
  Color.serialize(hover) // 'oklch(from var(--accent) calc(l * 0.8) c h)'

  const faded = Color.from(
    Color.ref('brand'),
    ColorSpace.srgb,
    Channel.R,
    Channel.G,
    Channel.B,
    Calc.multiply(Channel.Alpha, 0.5),
  )
  Color.serialize(faded) // 'color(from var(--brand) srgb r g b / calc(alpha * 0.5))'
  ```

- c666ef9: `Color.srgb(red, green, blue)` models the `color()` function's srgb colorspace: `Color.srgb(0.18, 0.34, 0.78)` serializes as `color(srgb 0.18 0.34 0.78)`. Channels are `Calc` expressions exactly as on `oklch` — references, arithmetic (wrapped in `calc()` per channel), `bind`, and `refs` all behave identically. Different color functions never compare equal, even where they would name the same point in color space.
- c666ef9: `RuleSet.isEmpty` and `Stylesheet.isEmpty` check structural emptiness (no members / no nodes). `Stylesheet.render` now also documents its empty-output guarantee: a sheet whose every node renders empty — `empty` itself, or style rules with empty blocks — renders the empty string, so composing a render into a larger file never needs to reach into `nodes`.
- c666ef9: `Calc` now models `<length>`, `<angle>`, and `<percentage>`, not just `<number>`, and tracks each expression's dimension and units at the type level. A new `fashionable/data` module supplies the constructors — `Length.px`/`rem`/`em`/`vw`/`vh`/`vmin`/`vmax`, `Angle.rad`, and `Percentage.of` — and every math combinator threads the dimension through.

  ```ts
  import { Calc } from 'fashionable/calc'
  import { Length } from 'fashionable/data'

  const ratio = Calc.divide(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160))
  // Calc.Calc<never, 'number', Unit.Vw | Unit.Px> — a <length> over a <length> is a <number>
  Calc.serialize(ratio) // 'calc((100vw - 320px) / 160px)'
  ```

  The dimensional rules follow CSS and are enforced in the types: `add`/`subtract`/`min`/`max`/`clamp` require a shared kind, `multiply` scales a dimension by a number, and `divide` of two like dimensions is a number. Illegal combinations are compile errors — `Calc.add(Length.px(10), 5)` (a length plus a number) and `Calc.multiply(Length.px(10), Length.px(10))` (two lengths) both fail to typecheck, rather than emitting invalid CSS. `<percentage>` is its own kind under these same rules — `Percentage.of(40)` serializes as `40%`, percentages fold and scale together (`Calc.add(Percentage.of(20), Percentage.of(5))` is `25%`), and a percentage over a percentage is a number — but, unlike a length or angle, it serializes and does not `solve`.

  **Solving through a unit context.** A closed number-or-angle tree still solves directly; a tree carrying viewport- or font-relative units lowers them through a context, so one tree serves verification and serialization at once:

  ```ts
  Calc.solve(ratio, {}, { vw: 1280 / 100 }) // 6 — the ratio at a 1280px viewport
  ```

  Absolute lengths (`px`) and angles (radians) solve with no context; a relative unit requires a ratio, typed by the expression's units so the context can neither miss nor mismatch a key.

  **New `tan` and `atan2`.** `atan2(y, x)` returns an `<angle>` from two same-kind operands, and `tan(atan2(a, b))` divides two dimensions to a `<number>` — the portable form of a `<length>` ratio, since Firefox does not yet support `<length> / <length>` in `calc()`. The two forms are interchangeable (same kind, same units, same solved value).

  **Dimensioned values at the seams.** `Declaration.make('--gap', Length.px(8))` now works without string assembly, and a `@property` `<length>`/`<angle>`/`<percentage>` initial value accepts a closed dimensioned `Calc`, restricted to computationally-independent absolute units per the spec (so `Length.px(8)` registers, `Length.vw(8)` is rejected).

  **`add`/`min`/`max` are now single variadic signatures** — reference inference no longer caps at four operands.

  ### Breaking: `acos` returns an `<angle>`, and trig takes angles

  `sin`/`cos`/`tan` accept a plain number (radians) or an `<angle>`, and `acos` returns an `<angle>`. This replaces the previous behavior where a plain number was implicitly given a `rad` unit beside an `acos` result. Supply the angle explicitly:

  ```ts
  import { Angle } from 'fashionable/data'

  // before: Calc.subtract(Calc.divide(Calc.acos(u), 3), 2.0943951)
  // after:
  Calc.subtract(Calc.divide(Calc.acos(u), 3), Angle.rad(2.0943951))
  ```

  The serialized output is unchanged (`… / 3 - 2.0944rad`); only the authoring is now explicit, and `<angle> - <number>` is a type error.

- c666ef9: `FontFaceRule.render` now honors the inherited `precision` render option for its weight and metric-override numbers, completing the render-options family's promise that a key means the same thing wherever it appears. Output without the option is unchanged (the default remains `Precision.decimals(5)`).
- c666ef9: `FontFaceRule` gains the `unicode-range` descriptor. Entries are single codepoints or inclusive `[start, end]` ranges (the `Weight` pattern), validated in `[0x0, 0x10FFFF]`: `FontFaceRule.make({ ..., unicodeRange: [0x400, [0x500, 0x5ff]] })` renders `unicode-range: U+400, U+500-5FF;` after `src`. The descriptor is a set union, so entries canonicalize at construction — sorted by start then end, exact duplicates dropped — and construction order never affects equality. The wildcard spelling (`U+4??`) is range sugar and is not modeled.
- c666ef9: `HueInterpolation` is the hue-traversal argument that follows a polar `ColorSpace` in `Color.mix`: `Color.mix(ColorSpace.oklch, HueInterpolation.longer, a, b)` renders `color-mix(in oklch longer hue, a, b)`. The four strategies mirror CSS — `shorter` and `longer` take the short or long arc between the two hues, `increasing` and `decreasing` force the direction of travel. A polar space may be given without one (the browser defaults to `shorter`), so these are the explicit override, and a strategy after a rectangular space is a type error, matching the grammar.

  `HueInterpolation.interpolate(strategy, from, to, t)` is the JS side of that mix: it builds the hue at `t` (running `0` at `from` to `1` at `to`) along the chosen arc, each argument a number of degrees or a `Calc`. It's the CSS Color 4 hue fixup written branchlessly with `mod`, folding to a constant when every argument is a number and staying fully symbolic otherwise, and drops straight into a hue channel.

  ```ts
  import { Calc } from 'fashionable/calc'
  import { HueInterpolation } from 'fashionable/data'

  const hue = HueInterpolation.interpolate(
    HueInterpolation.shorter,
    30,
    Calc.ref('to'),
    Calc.ref('t'),
  )
  Calc.serialize(hue) // 'calc(30 + (mod(var(--to) - 30 + 180, 360) - 180) * var(--t))'
  Calc.serialize(HueInterpolation.interpolate(HueInterpolation.increasing, 20, 350, 0.5)) // '185'
  ```

- c666ef9: `Keyword.none` (in `fashionable/data`) models CSS's missing-component keyword as a branded value, and color channels now accept it: `Color.oklch(0, 0, Keyword.none)` serializes as `oklch(0 0 none)` — the conventional achromatic hue. Positions that take the keyword declare it in their signatures (`Input<R> | Keyword.None`), so acceptance is explicit per slot; a `none` channel contributes no references and passes through `bind` untouched.
- c666ef9: Barrel modules now expose each type through its namespace instead of as a bare re-export. `Calc`, `MediaQuery`, `Stylesheet`, and the rest are namespaces only — reach their types as `Calc.Calc<Refs>`, `MediaQuery.MediaQuery`, `Stylesheet.Stylesheet<Refs>`, and so on.

  Migration: qualify explicit type annotations — `const x: Calc<'a'>` becomes `const x: Calc.Calc<'a'>`. Value calls (`Calc.of`, `MediaQuery.minWidth`), inferred types, and IDE hovers are unaffected; a hover still shows the short `Calc<'a'>` form.

  Declaration files now ship as `.d.mts`, bundled by tsdown; the separate `tsc` declaration build is gone.

- c666ef9: `RuleSet` gains `forSelector` and `forMediaQuery`: dual combinators that lift a block into a `StyleRule` or nested `@media` `MediaRule` — sugar for `StyleRule.make(selector, block)` / `MediaRule.make(query, block)` with the arguments flipped, so a block built up through `pipe` caps off as a rule without naming `StyleRule`/`MediaRule` at the call site. Both thread the block's reference names through unchanged.

  ```ts
  RuleSet.make(Declaration.make('--depth', Calc.ref('depth'))).pipe(
    RuleSet.forSelector(Selector.root),
  ) // StyleRule<'depth'>
  ```

- c666ef9: `Stylesheet.coalesce` accepts `{ strict: true }`: a pull throws when the coalesced rule's block would move backward across an intervening style rule whose selector ties the coalesced selector on specificity — the case where coalescing can change the cascade. The check is conservative: it cannot know whether tying selectors match the same element, so any tie refuses. Strict mode turns the operation's documented order-sensitivity into a checkable build gate. Default behavior is unchanged.

## 0.1.0

### Minor Changes

- 4dabd9a: Initial rule model, the structural CSS layer.
  - `fashionable/selector` — compound `Selector` values with canonical part ordering and computed `Specificity`. Typed part constructors including `attribute` and `not`.
  - `fashionable/query` — `MediaQuery`, canonical and-sets of `minWidth` and `prefersColorScheme`, rendered in prefix or range syntax.
  - `fashionable/declaration` — `Declaration<Refs>`, a property name paired with literal text, a `Calc`, or a `Color`.
  - `fashionable/rule` — `RuleSet<Refs>` holding `StyleRule` and nested `MediaRule`. Member order is preserved, never sorted.
  - `fashionable/font-face` — `FontFaceRule` with multi-source `src`, weight ranges, and metric overrides.
  - `fashionable/property` — `PropertyRule` with a modeled `PropertySyntax` that types the initial value.

- 4dabd9a: Initial stylesheet and rendering layer.
  - `fashionable/stylesheet` — `Stylesheet<Refs>`, the top-level container. `merge` is an order-preserving, structurally deduped monoid, `mergeAll` folds many sheets, and `coalesce` is an opt-in same-selector merge. `refs` reports the custom properties the sheet reads.
  - Rendering — every renderable type carries its own `render`, and `Stylesheet.render` projects the whole sheet as nested CSS, `@media` kept inside its rule. Output is deterministic.

- 4dabd9a: Initial value layer.
  - `fashionable/calc` — `Calc<Refs>`, an immutable CSS `calc()` expression tree with phantom-typed unbound references. Construct with `of`/`ref` and the math combinators: arithmetic, `pow`/`signedPow`, `min`/`max`/`clamp`, `lerp`, and trig (`sin`/`cos`/`acos`). `bind` partially evaluates, `solve` reduces a closed tree to a number, and `serialize` renders `calc()` text. Constants fold at construction, and `Precision` sets per-constant and per-call formatting.
  - `fashionable/color` — `Color<Refs>`, `oklch()` over calc-expression channels. Bindable and serializable, not solvable.
  - `fashionable/utils` — the `pipe`, `flow`, `dual`, `Pipeable`, and `invariant` combinators the API is built on.
