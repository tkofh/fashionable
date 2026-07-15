# fashionable

Structural CSS stylesheet modeling and calc-expression evaluation for TypeScript.

The published package lives in [`packages/core`](packages/core) (npm: `fashionable`). Its [README](packages/core/README.md) documents the API with runnable examples.

## Repository

- [`packages/core`](packages/core) — the `fashionable` package: source, tests, public API.
- [`docs/design.md`](docs/design.md) — the design contract: module map, canonical-ordering rules, precision model, angle boundary.
- [`RELEASING.md`](RELEASING.md) — how releases are cut (Changesets + npm trusted publishing).

## Development

A pnpm + Turbo monorepo.

```sh
pnpm install
pnpm test        # run the test suite
pnpm typecheck   # type-check
pnpm check       # lint + format check
```

## License

MIT © Tim Morris
