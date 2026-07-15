# fashionable

Structural stylesheet modeling and calc expression evaluation for TypeScript (npm: `fashionable`).

An Effect-style API for building CSS in code: a faithful structural model of the CSS language — rules, selectors, media queries, at-rules, nesting — unified with a `calc()` value-expression language that can be solved against bindings or serialized to CSS text. Immutable values, structural equality, deterministic output, zero runtime dependencies. No template literals anywhere.

```sh
npm install fashionable
```

## Typed calc

A `Calc` is a CSS math expression you can serialize to CSS or solve to a number — the same tree, two projections, so the thing you verified is the thing you shipped. The type tracks the expression's unbound references, its dimension (`<number>`, `<length>`, `<angle>`, or `<percentage>`), and the units it mentions.

```ts
import { Calc } from 'fashionable/calc'
import { Length } from 'fashionable/data'

const fluid = Calc.clamp(
  Length.rem(1),
  Calc.add(Length.rem(0.75), Length.vw(0.5)),
  Length.rem(1.25),
)

Calc.serialize(fluid) // 'clamp(1rem, 0.75rem + 0.5vw, 1.25rem)'
Calc.solve(fluid, {}, { rem: 16, vw: 1280 / 100 }) // 18.4 — at a 1280px viewport, 16px root
```

`solve` lowers relative units through a context of px ratios, typed by the expression's units so the context can neither miss nor mismatch a key. Absolute lengths and angles solve with no context. `Length`, `Angle`, and `Percentage` in `fashionable/data` supply the unit constructors — `Length.px` through `Length.vmax`, `Angle.rad` and `Angle.deg`, `Percentage.of` — with `Unit` naming the unit types. A percentage serializes but does not solve.

References are CSS custom properties: `Calc.ref('space')` reads `var(--space)`, and `bind` substitutes and partially evaluates.

```ts
const gap = Calc.multiply(Calc.ref('space'), 2)

Calc.serialize(gap) // 'calc(var(--space) * 2)'
Calc.solve(gap.pipe(Calc.bind({ space: 4 }))) // 8
```

The dimensional rules follow CSS and live in the types: `add`, `subtract`, `min`, `max`, and `clamp` require a shared kind, `multiply` scales a dimension by a number, and `divide` of two like dimensions is a number. Illegal combinations fail to typecheck rather than emitting invalid CSS.

```ts
// @ts-expect-error — a <length> plus a <number> has no CSS meaning
Calc.add(Length.px(10), 5)
// @ts-expect-error — two lengths do not multiply
Calc.multiply(Length.px(10), Length.px(10))

const ratio = Calc.divide(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160))

Calc.serialize(ratio) // 'calc((100vw - 320px) / 160px)' — a <length> over a <length> is a <number>
Calc.solve(ratio, {}, { vw: 1280 / 100 }) // 6
```

Firefox does not yet support `<length> / <length>` division in `calc()`; `tan(atan2(y, x))` is the portable spelling of the same ratio.

```ts
const portable = Calc.tan(Calc.atan2(Calc.subtract(Length.vw(100), Length.px(320)), Length.px(160)))

Calc.serialize(portable) // 'tan(atan2(100vw - 320px, 160px))'
```

`mod`, `pow`/`signedPow`, `lerp`, `abs`, and `sin`/`cos`/`acos` round out the combinators. Trig follows CSS's typing: `acos` and `atan2` return an `<angle>`, and `sin`/`cos`/`tan` accept an `<angle>` or a plain number in radians.

Constants format under an explicit precision model: five decimals by default, overridable per serialize call, and per constant with an annotation that carries through constant folding.

```ts
import { Precision } from 'fashionable/calc'

Calc.serialize(Calc.of(0.8377580409572781)) // '0.83776'
Calc.serialize(Calc.of(0.8377580409572781, Precision.significant(10))) // '0.837758041'
```

The full precision model lives in [docs/design.md](https://github.com/tkofh/fashionable/blob/main/docs/design.md).

## Color

A `Color` models a CSS color value structurally. Channels are `Calc` number expressions, so a channel can be a constant, a reference, arithmetic, or CSS's `none` keyword. A `Color` serializes and binds; it does not solve.

```ts
import { Calc } from 'fashionable/calc'
import { Channel, Color, ColorSpace, HueInterpolation, Keyword } from 'fashionable/data'

Color.serialize(Color.oklch(0.7, 0.15, Calc.ref('hue'))) // 'oklch(0.7 0.15 var(--hue))'
Color.serialize(Color.srgb(0.18, 0.34, 0.78)) // 'color(srgb 0.18 0.34 0.78)'
Color.serialize(Color.oklch(0.2, 0, Keyword.none)) // 'oklch(0.2 0 none)'

Color.oklch(Calc.ref('l'), 0.15, 250).pipe(Color.bind({ l: 0.7 })) // serializes 'oklch(0.7 0.15 250)'
```

**Relative color syntax.** `Color.from` derives a color from another — including one the browser resolves from the cascade. The destination space exposes the origin's channels as `Channel` keywords and scopes them: `Channel.L` belongs to `oklch`, `Channel.R` to `srgb`, and a keyword the space does not name is a compile error.

```ts
const hover = Color.from(
  Color.ref('accent'), // reads the whole color from var(--accent)
  ColorSpace.oklch,
  Calc.multiply(Channel.L, 0.8),
  Channel.C,
  Channel.H,
)

Color.serialize(hover) // 'oklch(from var(--accent) calc(l * 0.8) c h)'
```

**Mixing.** `Color.mix` models `color-mix()`. Arms are colors or `[color, weight]` tuples, weights read as percents. A polar space admits a `HueInterpolation` strategy after it; a strategy after a rectangular space is a compile error, matching the grammar.

```ts
const wash = Color.mix(ColorSpace.oklch, [Color.ref('brand'), 60], Color.named('white'))

Color.serialize(wash) // 'color-mix(in oklch, var(--brand) 60%, white)'

const arc = Color.mix(
  ColorSpace.oklch,
  HueInterpolation.longer,
  Color.oklch(0.7, 0.15, 30),
  Color.oklch(0.7, 0.15, 330),
)

Color.serialize(arc) // 'color-mix(in oklch longer hue, oklch(0.7 0.15 30), oklch(0.7 0.15 330))'
```

**Hue interpolation.** `HueInterpolation.interpolate` is the JS side of that hue arc: it builds the hue at `t` along the chosen strategy — the CSS Color 4 hue fixup written branchlessly with `mod` — folding to a constant when every argument is a number and staying symbolic otherwise. Your build and the browser compute the same fixup.

```ts
const hue = HueInterpolation.interpolate(
  HueInterpolation.shorter,
  30,
  Calc.ref('to'),
  Calc.ref('t'),
)

Calc.serialize(hue) // 'calc(30 + (mod(var(--to) - 30 + 180, 360) - 180) * var(--t))'
Calc.serialize(HueInterpolation.interpolate(HueInterpolation.increasing, 20, 350, 0.5)) // '185'
```

**Whole-value colors.** `Color.lightDark` models scheme-conditional `light-dark()` with whole colors in each arm. `Color.ref` reads an entire color from a custom property, `Color.named` renders a named color bare, and `Color.transparent` is the blessed no-color constant. All of them compose anywhere a `Color` goes.

```ts
const scheme = Color.lightDark(Color.oklch(0.98, 0.01, 250), Color.oklch(0.18, 0.02, 250))

Color.serialize(scheme) // 'light-dark(oklch(0.98 0.01 250), oklch(0.18 0.02 250))'
Color.serialize(Color.lightDark(Color.ref('surface'), Color.transparent))
// 'light-dark(var(--surface), transparent)'
```

## Stylesheets

Build a stylesheet from typed parts — selectors, declarations, rules, nested media — then render it to CSS.

```ts
import { Calc } from 'fashionable/calc'
import { Length } from 'fashionable/data'
import { Declaration } from 'fashionable/declaration'
import { MediaQuery } from 'fashionable/query'
import { MediaRule, RuleSet, StyleRule } from 'fashionable/rule'
import { Selector } from 'fashionable/selector'
import { Stylesheet } from 'fashionable/stylesheet'

const card = StyleRule.make(
  Selector.class('card'),
  RuleSet.make(
    Declaration.make('padding', Length.rem(1)),
    Declaration.make('gap', Calc.multiply(Calc.ref('space'), 2)),
    MediaRule.make(
      MediaQuery.minWidth(768),
      RuleSet.make(Declaration.make('gap', Calc.multiply(Calc.ref('space'), 3))),
    ),
  ),
)

const sheet = Stylesheet.make(card) // Stylesheet<'space'>

Stylesheet.render(sheet, { indent: '  ' })
```

Nesting is preserved as authored — `@media` stays inside its rule:

```css
.card {
  padding: 1rem;
  gap: calc(var(--space) * 2);
  @media (min-width: 768px) {
    gap: calc(var(--space) * 3);
  }
}
```

Selectors are compound selectors built from typed parts — `type`, `id`, `class`, `attribute`, `not`, pseudo-classes and pseudo-elements — with computed `Specificity`. Media queries are and-sets of `minWidth` and `prefersColorScheme`. Both canonicalize at construction, so structural equality holds regardless of construction order and rendering is deterministic. Declaration and rule order is never touched: member order is cascade behavior, and the library preserves it.

A block built up through `pipe` caps off as a rule with `forSelector` or `forMediaQuery`:

```ts
RuleSet.make(Declaration.make('--depth', Calc.ref('depth'))).pipe(
  RuleSet.forSelector(Selector.root),
) // StyleRule<'depth'> — renders ':root { --depth: var(--depth); }'
```

## Refs

Every value and container is generic over `Refs`, the CSS custom properties it reads but has not bound. `Calc.ref('space')` is a `Calc<'space'>` and `Color.ref('accent')` is a `Color<'accent'>`. Combining values unions their `Refs`, and `bind` subtracts the names it binds. A closed expression — fully bound or constant — is a `Calc<never>`, which is what `solve` accepts with no bindings.

The parameter threads up through the model, so `Declaration<Refs>`, `RuleSet<Refs>`, `StyleRule<Refs>`, and `Stylesheet<Refs>` carry the union of the refs they contain. The `Stylesheet<'space'>` above is the compiler reporting that the sheet reads `var(--space)` and nothing else. `Stylesheet.refs` returns the same set at runtime. Unbound refs serialize as `var(--name)` — the reference channel is the custom-property channel.

## `@property` and `@font-face`

`PropertyRule` models `@property`. The `PropertySyntax` value in the `syntax` slot types the initial value, and the spec's computational-independence rule rides along: `Length.px(8)` registers under `PropertySyntax.length`, and `Length.vw(8)` is a compile error. Rules register with `inherits: false`; pipe through `PropertyRule.inheritable` to opt in.

```ts
import { PropertyRule, PropertySyntax } from 'fashionable/property'

const depth = PropertyRule.make('--depth', PropertySyntax.number, 0)

PropertyRule.render(depth, { indent: '  ' })
// @property --depth {
//   syntax: '<number>';
//   inherits: false;
//   initial-value: 0;
// }
```

`FontFaceRule` models `@font-face`: multi-source `src`, weight ranges, metric overrides, and `unicode-range`.

```ts
import { FontFaceRule } from 'fashionable/font-face'

const inter = FontFaceRule.make({
  family: 'Inter',
  src: [FontFaceRule.url('/fonts/inter.woff2', 'woff2'), FontFaceRule.local('Inter')],
  weight: [400, 700],
  display: 'swap',
  unicodeRange: [[0x400, 0x4ff]],
})

FontFaceRule.render(inter, { indent: '  ' })
// @font-face {
//   font-family: 'Inter';
//   font-weight: 400 700;
//   font-display: swap;
//   src:
//     url('/fonts/inter.woff2') format('woff2'),
//     local('Inter');
//   unicode-range: U+400-4FF;
// }
```

## Merging and coalescing

`Stylesheet.merge` is a lawful monoid — associative, idempotent, `empty` as identity — that keeps both sides' order and collapses structural duplicates to their first occurrence. That is the multi-emitter fold: emitters that each register the rules they share merge to a sheet carrying one copy.

```ts
import { Stylesheet } from 'fashionable/stylesheet'

const contract = Stylesheet.make(PropertyRule.make('--depth', PropertySyntax.number, 0))

Stylesheet.merge(contract, contract) === contract // true — idempotent, by reference
```

`coalesce` folds style rules that share a selector into the first occurrence:

```ts
const sheet = Stylesheet.make(
  StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--a', 1))),
  StyleRule.make(Selector.root, RuleSet.make(Declaration.make('--b', 2))),
)

Stylesheet.render(Stylesheet.coalesce(sheet), { indent: '  ' })
// :root {
//   --a: 1;
//   --b: 2;
// }
```

Coalescing is order-sensitive: pulling a block backward past a rule whose selector ties on specificity can change the cascade. So it stays an explicit opt-in, and `coalesce(sheet, { strict: true })` throws on any such pull — a build gate proving the normalization is cascade-preserving.

## License

MIT
