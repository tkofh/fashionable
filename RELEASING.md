# Releasing

Releases are automated with [Changesets](https://github.com/changesets/changesets) and published to npm via [trusted publishing](https://docs.npmjs.com/trusted-publishers) (GitHub Actions OIDC). No npm token exists anywhere — not in repo secrets, not on a maintainer's machine.

## One-time setup (not yet done)

The workflows in `.github/workflows/` are ready, but publishing needs two pieces of external configuration before the first release:

1. **npm trusted publisher**: on npmjs.com, configure the `fashionable` package (created on first publish) with a trusted publisher pointing at this repository's `release.yml` workflow and the `release` environment. The very first publish of a brand-new package may need to be done manually (`npm publish --access public` from a built `packages/core`) before the trusted publisher can be attached.
2. **GitHub `release` environment**: create an environment named `release` in the repository settings with a required reviewer, so publishes wait for explicit approval.

## Day-to-day flow

1. Land PRs with changeset files as usual (`pnpm changeset`).
2. On every push to `main`, the release workflow updates the **Version Packages** PR, which accumulates pending changesets into a version bump and changelog.
3. Merging that PR puts an unpublished version on `main`. The workflow detects this and queues the `publish` job against the `release` environment, which waits for reviewer approval.
4. Approve the deployment. The job re-runs lint, build, tests, and typecheck on the exact tree being published, then `changeset publish` publishes with provenance, pushes the `fashionable@x.y.z` git tag, and creates the GitHub Release.

Pushes to `main` that leave nothing to publish (the current version is already on npm, or changesets are still pending) never request approval.
