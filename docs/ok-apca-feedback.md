# Consumer feedback: ok-apca — selector nesting (the deferred `&` extension)

Field notes from a second consumer. ok-apca — static CSS for gamut-mapped OKLCH colors with APCA contrast, all math resolved at build time — was ported off its bespoke expression library onto fashionable: `Calc` and `Color` for the value trees, `PropertyRule`/`Declaration`/`RuleSet`/`Stylesheet` for the sheet. The value layer converted essentially 1:1 (signed-pow, lerp desugaring, subtractive negatives, `pi`, five-decimal formatting, `oklch()` channel `calc()`-wrapping all matched byte-for-byte; the generated declaration set and `@property` set are identical to the old output, differing only in intra-block declaration order and blank lines). Browser parity — real computed colors against a reference APCA implementation — is green.

One construct did not model: the per-hue block's nested selector. fashionable v0.2.0 defers it by design — `Selector` "always describes one compound," and every block renderer throws "when the block nests a style rule — selector composition (`&`) is a later extension, not part of v1 rendering." The port shipped anyway by string-assembling that one selector around fashionable-rendered declaration fragments (§Appendix). This document records **why ok-apca needs the shape**, **what modeling it requires**, and **the design considerations** — which cluster, as you suspected, on `&`.

Nothing here blocks ok-apca; it shipped. The question is whether the nesting extension can be specified tightly enough to fold the last string assembly back into the model.

## 1. The shape, and why ok-apca needs it

Each hue emits a block of this shape (hue selector `.red`, active roles `.fill`/`.text`):

```css
.red {
  :is(&, & *):is(.fill, .text) {
    --_color-hue: 30;
    --_color-apexL: 0.654;
    --_color-apexC: 0.29307;
    --_color-tentK: -0.07636;
    --_color-fA: -0.13932;
    --_color-fB: -0.01738;
    --_color-fD: 0.00192;
  }
}
```

**The domain reason.** ok-apca separates its inputs into two axes. The role color expressions (`--color-fill`, `--color-text`, and the contrast targets) are hue-independent — one set of `calc()` trees, authored once, reading the hue's geometry as custom properties. The **geometry** — apex lightness/chroma of the Display-P3 boundary at this hue, the tent-curvature correction, the Y-correction coefficients — is hue-dependent but role-independent. So the split is: build the expression trees once; set the seven geometry constants per hue, on the elements that carry a role, scoped to that hue's subtree. The nested selector is precisely that scoping:

- **`:is(&, & *)`** — "the hue element itself, or any element beneath it." Both arms matter: a consumer may put the hue class and a role class on the same element (`&`) or the hue class on an ancestor and roles below it (`& *`). The `&` is what lets a single block cover both without the hue selector being written twice.
- **`:is(.fill, .text)`** — "…and is a role element." This is the active-role selector list; a role element outside any hue scope keeps the `@property` initial values.

**Two properties of the shape drive everything in §2 and §3:**

1. **The nesting is essential, not cosmetic.** `& *` is a descendant relationship between two compounds. It cannot collapse to a single compound, and it cannot be spelled without a combinator.
2. **The surrounding selectors are arbitrary consumer strings.** The hue selector defaults to `.${name}` but is caller-supplied (`[data-color="primary"]`, `.theme .brand`, anything). The role list is `roles.map(r => r.selector).join(', ')`, equally open. `&` earns its keep by letting the block reference that arbitrary hue selector once instead of textually repeating it inside the `:is()`.

**Why not flatten it away.** The block *could* be written flat as `:is(.red, .red *):is(.fill, .text)`. That repeats the hue selector (fine for `.red`, ugly for a long attribute selector) and, more to the point, throws away the structural nesting the generator naturally produces — the hue block genuinely *is* "a rule with one nested rule." Native CSS nesting is the honest output; `&` keeps the hue selector single-sourced.

## 2. What modeling it requires

fashionable v0.2.0 gives `Selector` as a canonically-ordered compound with computed `Specificity` and structural equality, `not(oneCompound)` as the only functional pseudo, `MediaRule` nesting inside blocks — and a render guard that throws on nested style rules. Closing the gap needs four pieces plus one adjacent escape hatch:

1. **Complex selectors (combinators).** Compounds joined by descendant / child / next-sibling / subsequent-sibling. `& *` needs descendant; the others come with the grammar. Specificity sums across the sequence.

2. **The `&` token.** A simple selector — not a rule-level flag — that composes in a compound (`&.foo`), under a combinator (`& > .foo`), and inside a functional pseudo (`:is(&, …)`). §3 is mostly about this.

3. **Functional pseudo-classes over selector *lists*.** `:is()`, `:where()`, `:has()`, each taking a `<complex-selector-list>` (and `:has()` taking *relative* selectors, `:has(> .x)`). Today only `not()` exists, and it takes a single compound. ok-apca uses `:is()` twice per block.

4. **Nested `StyleRule` rendering.** Lift the guard so a `StyleRule` that is a member of a `RuleSet` renders as an indented nested block — the shape `MediaRule` already renders in. The nested rule's selector may contain `&`.

Adjacent, and independently useful:

5. **A raw-string escape hatch — `Selector.raw(string)`.** The hue and role selectors are arbitrary consumer input; even with the full complex-selector grammar modeled, fashionable does not parse selector text, so ok-apca needs a way to carry an opaque selector whose specificity and identity are string-only. This is the piece that would also let the generator stop hand-wrapping its *role*-block selectors, not just the hue block.

## 3. Considerations — where `&` goes

`&` is the whole difficulty, and the difficulty is not syntactic. `&` breaks three properties `Selector` holds at construction: it is no longer *one compound*, its specificity is no longer *computable from the selector alone*, and — because its meaning depends on the parent — its canonical identity needs care. The decisions below are roughly independent, but 3.5 is the one that reshapes the type.

### 3.1 `&` is a simple selector, not a rule-level flag

The tempting model is "nested rule + implicit parent prefix," where `&` is machinery the renderer supplies. ok-apca breaks that: `&` appears *inside* `:is()`, and *twice*, in two different positions (bare, and as the left side of a descendant). So `&` has to be a first-class simple-selector leaf — the same kind of thing as `universal` — usable anywhere a simple selector is, including as an argument deep inside a functional pseudo. Model it as a leaf; let compounds, combinators, and `is`/`where`/`has` compose it.

### 3.2 Explicit `&`, with one sugar

CSS auto-prepends `&` (as a descendant) to any nested selector that does not mention it: `.bar { .foo {} }` means `.bar .foo`. That implicit rewrite is exactly the construct-time magic fashionable avoids elsewhere — canonical order, structural equality, and computed specificity all prefer "what you wrote is what it is." Recommendation: **require `&` in a nested selector** (reject a nested `StyleRule` whose selector does not reference `&`), and offer a single convenience for the common case so the ergonomics don't suffer:

```ts
RuleSet.nest(sel, block)   // sugar for the descendant "& sel" — the implicit-descendant case, made explicit
```

The payoff is that "where the parent lands" lives in the data, so canonicalization and rendering never have to reconstruct it.

### 3.3 Canonical slot within a compound

`.a.b` equals `.b.a` today because compound parts sort into a canonical order (type, id, class, pseudo-class, attribute, negation, pseudo-element). `&` needs a slot in that order for `equals` to hold. It is not a type selector, but it reads as the anchor of the compound and can legally coexist with a type (`&div`). Recommendation: sort `&` first, ahead of the type slot. Small decision, load-bearing for structural equality.

### 3.4 Selector-list order inside `:is()`/`:where()`/`:has()`

`:is(a, b)` matches order-independently, so `:is(&, & *)` and `:is(& *, &)` are the same selector and should compare equal — i.e. the argument list canonicalizes (sorts), the same move you already make one level down for compound parts. Specificity of the functional pseudos follows the spec: `:is()` and `:has()` take the specificity of their *most specific* argument; `:where()` contributes zero. `:has()` additionally must accept a leading combinator (relative selectors). None of this is exotic — it is the compound-canonicalization discipline lifted to the list level.

### 3.5 The hard one: `&`'s specificity is contextual

Per the nesting spec, `&` carries **the maximum specificity among the parent rule's selector list** — `.a, #b { & {} }` gives `&` a specificity of `(1,0,0)`, borrowed from `#b`. So `Selector.specificity(sel)` cannot return a `Specificity` for an `&`-bearing selector without knowing the parent it is nested under. This is the invariant that actually bends, and it matters beyond hovering: it is the input to the strict-`coalesce` cascade-tie gate. Two honest resolutions:

- **Symbolic specificity.** `Specificity` gains a "parent" term; `specificity()` of an `&`-selector returns `parent ⊕ ownParts`, resolved when the rule is attached under a known parent. Keeps the specificity story total, and generalizes machinery you already need for `:is()` (specificity of the max argument) and `:where()` (zero). More type surface.
- **Resolve at attach time.** `&` is opaque until `RuleSet.append(nestedRule)` binds it to a parent; specificity is computed and cached there, and `Selector.specificity` on a free-floating `&`-selector reports "unknown" rather than a `Specificity`. Simpler model, but a partial `specificity()`.

Recommendation: **symbolic.** The strict-coalesce gate (see the dtcg-resolver notes) exists to prove ties don't reorder the cascade; an `&`-selector whose specificity is "unknown" forces that gate to refuse conservatively wherever nesting appears, which is the same over-broad-refusal failure mode already under investigation there. A symbolic specificity that resolves on attach keeps the gate decidable.

### 3.6 Rendering: keep `&`, don't flatten (yet)

Two output modes, and ok-apca needs only the easy one:

- **Native-nested** — emit `parent { childSelector { … } }` verbatim, `&` intact. This is lifting the render guard and emitting the nested `StyleRule` indented, exactly as `MediaRule` renders. It reproduces ok-apca's current output byte-for-byte and unblocks it fully.
- **Flattened** (`&` → `:is(parentList)`, de-nested) — for targets without native nesting. This is where the specificity-preserving `:is()` wrap and the de-nesting rewrite live, and it is a materially larger lift (and interacts with 3.5). Ship native-nested first; treat flattening as its own later mode.

## 4. The shape in the proposed API

With pieces 1–5, ok-apca's hue block stops being a string:

```ts
StyleRule.make(
  hueSelector,                                   // Selector.class('red') or Selector.raw(userString)
  RuleSet.make(/* no top-level declarations */).pipe(
    RuleSet.nest(
      Selector.and(
        Selector.is(                             // :is(&, & *)
          Selector.nest,
          Selector.descendant(Selector.nest, Selector.universal),
        ),
        Selector.is(...roleSelectors),           // :is(.fill, .text)
      ),
      RuleSet.make(...gamutDeclarations),
    ),
  ),
)
```

Native-nested rendering emits the block above verbatim. Two knock-on wins: the generator collapses from "fashionable fragments + hand-assembled selector strings" into a single `Stylesheet`, and the `refs` union then flows correctly across the nested blocks for free (today the string wrapper severs that thread).

## 5. Scoping

The coherent minimal slice that unblocks ok-apca and keeps the model honest:

> complex selectors (combinators) · `Selector.nest` · `is`/`where`/`has` over selector lists · native-nested `StyleRule` rendering · `Selector.raw`

Each of these two can land as an independent follow-up:

- **Symbolic `&`-specificity (3.5).** Native rendering does not strictly need it — the text is correct without a computed specificity — but the strict-coalesce gate does, so this is the difference between "nesting renders" and "nesting is safe to normalize."
- **Flattened rendering (3.6).** Its own mode, gated on 3.5, for non-nesting targets.

`Selector.raw` is worth pulling forward regardless of nesting: it is what lets a generator with consumer-supplied selectors use `Stylesheet` at all, rather than string-wrapping every rule.

## Appendix: the current workaround, and what it costs

ok-apca ships the nested block by rendering the *body* with fashionable and wrapping the *selector* by hand:

```ts
const body = RuleSet.render(RuleSet.make(...gamutDeclarations))   // fashionable renders the declarations
const nested = `:is(&, & *):is(${roleSelectorList})`
return `${hueEntry.selector} {\n\t${nested} {\n${indent(body)}\n\t}\n}`  // ok-apca owns the selector text
```

The role blocks do the same one level up (`${role.selector} { ${body} }`), because the role selector is also an arbitrary consumer string. So fashionable owns every *value*, *declaration*, and `@property` *rule*; ok-apca owns only the selector *structure* it cannot express — which is precisely pieces 1–5. The cost is that the sheet is a string join rather than a `Stylesheet`, so it forfeits `Stylesheet.merge`/`coalesce`, the top-level dedup, and the `refs` union across nested blocks — all of which the `@property` section (which *is* a `Stylesheet`) already enjoys. The nesting extension is what would make the whole generator one sheet.
