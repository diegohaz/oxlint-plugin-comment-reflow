# Contributing

## Set up the project

Use the Node version in `.node-version` and the pnpm version in `package.json`.
Development dependencies use exact versions.

```sh
pnpm install --frozen-lockfile
pnpm run check
```

## Commands

| Command                 | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `pnpm run lint`         | Run Oxlint.                                  |
| `pnpm run lint:fix`     | Apply Oxlint fixes.                          |
| `pnpm run format`       | Run Oxfmt.                                   |
| `pnpm run format:check` | Check source formatting.                     |
| `pnpm run fix`          | Run lint fixes, then formatting.             |
| `pnpm run typecheck`    | Check source, test, and configuration types. |
| `pnpm test`             | Build and run Vitest tests.                  |
| `pnpm run build`        | Emit JavaScript and declarations in `dist`.  |
| `pnpm run changeset`    | Add a release note for a user-facing change. |

## Source and tests

`src/core.ts` contains the prose formatter and has no Oxlint dependency.
`src/rule.ts` handles syntax-aware comment placement and non-overlapping fixes.
`src/index.ts` exports the plugin and recommended configuration.

Rolldown builds the public entry points. The declaration plugin emits TypeScript
declarations. TypeScript checks the source, tests, and tool configuration.

Vitest tests run real Oxlint processes, verify repeat fixes and Oxfmt stability,
test the installed Changesets CLI, and load the packed package from a consumer
project. They also check that consumers can use the published declarations.
The consumer tests use local dependencies and do not need registry access.
The tests do not publish packages.

Changesets uses its built-in changelog generator. Release notes are grouped by
major, minor, and patch changes. Multiline notes remain list items with indented
details. Run `pnpm test .changeset/release.test.ts` to check release generation.

Compatibility fixtures include Ariakit button documentation and the HTML
example from [Oxc issue 21549](https://github.com/oxc-project/oxc/issues/21549).
See `LICENSE` for attribution.

Files in `tests/fixtures` contain intentional formatting and are excluded from
Oxlint, Oxfmt, and TypeScript project checks. Keep fixture edits deliberate.
Keep Oxfmt's JSDoc formatting disabled when you edit comments.

## Commit checks

Lefthook runs staged-file Oxlint fixes, then Oxfmt, in order. Each successful
step stages its fixes. `allowBuilds.lefthook: true` permits the installation
script. If a cached install does not create the hook, run:

```sh
pnpm exec lefthook install
```

CI runs the full checks independently on the supported Node versions. Run
`pnpm run check` before you submit a change. Editor UI behavior is not covered
by the automated test suite.
