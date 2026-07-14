# fashionable

A structural CSS stylesheet modeling and calc-expression library for
TypeScript (npm: `fashionable`), Effect-style: data-first/data-last dual
signatures, branded types, immutable values. The public surface is
`packages/core/src` minus `*.internal.ts` and `src/internal/`;
implementations live in the internal modules and the public files are
type-annotated re-exports where the JSDoc lives. `docs/design.md` is the
library's design contract — module map, canonical-ordering rules, the
precision model, and the angle boundary all live there.

## Documentation

Doc comments calibrate to this section. The general rules live in the
comment-doctor skill (user-level); the content here stands on its own.

### Declared reader

Public doc comments address a developer using the library from npm:

- Fluent in TypeScript — branded types, conditional types, dual
  signatures, phantom type parameters. Never gloss TS.
- Fluent in CSS: knows `calc()`, custom properties, `@property`, media
  queries, and the cascade by feel. Gloss spec fine print (angle typing
  in math functions, CSSNestedDeclarations ordering) in a clause at
  point of use.
- Not assumed fluent in floating-point numerics or serialization
  subtleties: state precision behavior plainly and point to
  `docs/design.md` rather than re-teaching mechanics.

Contributor topics — module architecture, representation trade-offs,
donor-library history — go in module-level docs, `*.internal.ts`
comments, or `docs/design.md`, linked from consumer docs and never
inlined into them.

### Conventions

- Dual signatures: the data-first overload carries the full contract,
  wherever it sits — reordering overloads is a code change (it can
  affect overload resolution), not a docs change. The data-last overload
  keeps a one-line summary, its tags, and its own `@since`; its
  `@returns` may use the formula "A function that takes ... and returns
  ...". The formula is sanctioned ceremony, exempt from template-text
  checks.
- `@param`/`@returns` on every function doc block (convention; nothing
  lint-enforces it). Obvious parameters may keep brief conventional
  text; non-obvious parameters must carry the real content — CSS
  meaning, units, range, default. Placeholder text is banned.
- `@throws` on every function with a verified consumer-reachable throw,
  in the form ``@throws `Error` when ...``. The documented condition
  matches the real guard, not the intended one.
- `@since` on every public doc block, using the behavior clock: the
  earliest release in which a consumer could obtain the behavior from
  the public API, under any name. Renames don't reset it. Behavior
  inherited from `@ok-apca/calc-tree` still dates from its first
  fashionable release.
- Arity-ladder overload sets (`pipe`, `Pipeable.pipe`) take one full doc
  block on the first overload — plus the class doc, for methods — and
  nothing on the remaining arities. The per-overload rule is for dual
  signatures, not ladders.
- Cross-references are backticked prose names, not `{@link}`: qualified
  with the consumer's namespace for cross-module targets
  (`Calc.serialize`), bare for same-module ones (`decimals`). The
  package publishes without declaration maps, so a link at best jumps a
  consumer into a `.d.ts`. Never add an import to feed a link; when you
  touch a cross-reference, verify the claim around it.
- Examples: `@example` with a fenced `ts` code block, call sites written
  in the consumer's namespaced vocabulary, no import boilerplate. Add
  one where the signature alone would let a first-time caller hold the
  API wrong (dual/curried call shapes, options objects) or where a
  concrete input beats a paragraph; skip it where the first guess is
  right. An example ships only verified — run it, or check every name
  against the real API.
- Comments and repo docs stay in the keyboard character set: formulas
  written as code (`t^2`, `<=`, `sqrt(x^2 + y^2)`, `t in [0, 1]`, `pi`),
  never math glyphs — no sub/superscripts, Greek letters, `·`, `∈`,
  `≤`, `√`. Em dashes stay.
- Exemplars of the standard: `of`, `bind`, and `serialize` in
  `packages/core/src/calc/calc.ts`; `significant` in
  `packages/core/src/calc/precision.ts`; `oklch` in
  `packages/core/src/color/color.ts`.
