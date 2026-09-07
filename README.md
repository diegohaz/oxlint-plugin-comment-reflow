# oxlint-plugin-comment-reflow

Wrap comment prose and move eligible trailing comments above their target.
The plugin uses Oxlint's parser for JavaScript, JSX, TypeScript, and TSX.
Rolldown bundles both public entry points as ESM JavaScript and TypeScript
declarations. `tsc --noEmit` checks the source, tests, and configuration files.

## Install and configure

Use Node 24.18 or later in the Node 24 line, or Node 26 or later.
The tested Oxlint version is 1.81.0. Oxlint's JavaScript plugin API is still
in alpha. ESLint support is not claimed.

```sh
pnpm add -D oxlint@1.81.0 oxlint-plugin-comment-reflow
```

Add this configuration to `.oxlintrc.json`:

```json
{
  "jsPlugins": [
    {
      "name": "comment-reflow",
      "specifier": "oxlint-plugin-comment-reflow"
    }
  ],
  "rules": {
    "comment-reflow/reflow": [
      "warn",
      { "printWidth": 80, "trailingComments": "overflow" }
    ]
  }
}
```

For `oxlint.config.ts`, use the recommended configuration:

```ts
import { defineConfig } from "oxlint";
import { recommended } from "oxlint-plugin-comment-reflow";

export default defineConfig(recommended);
```

The recommended configuration enables the rule as a warning with its defaults.
The default export also provides `plugin.configs.recommended` and
`plugin.rules.reflow`. Merge `jsPlugins` and `rules` when you combine this
configuration with other plugins.

The package name is `oxlint-plugin-comment-reflow`. The rule namespace is
`comment-reflow`. The explicit alias above fixes that namespace. Loading the
package by name without an alias also works: its `meta.name` is `comment-reflow`.
Oxlint resolves plugin specifiers relative to the configuration file. See the
[official plugin guide](https://oxc.rs/docs/guide/usage/linter/js-plugins).

```sh
pnpm exec oxlint --fix src
```

## Rule options

| Option             | Default      | Behavior                                                    |
| ------------------ | ------------ | ----------------------------------------------------------- |
| `printWidth`       | `80`         | Positive integer. Includes indentation and comment markers. |
| `trailingComments` | `"overflow"` | One of `"ignore"`, `"always"`, or `"overflow"`.             |

`printWidth` is a prose target. Long URLs, links, inline code, and other
indivisible tokens can exceed it. The width counts Unicode code points.
Tabs advance to the next four-column stop. It does not measure the display
width of grapheme clusters or wide characters.

- `ignore` leaves trailing comments unchanged. Standalone comments still reflow.
- `always` moves eligible trailing comments, even when the source line fits.
- `overflow` moves them only when the complete source line exceeds the target.

For example, at a width of 50:

```ts
const foo = "a"; // A long explanation that exceeds the configured width.
```

Becomes:

```ts
// A long explanation that exceeds the configured
// width.
const foo = "a";
```

Adjacent standalone `//` comments form paragraphs when their source indentation
matches. Empty comment lines and empty source lines separate paragraphs. Lists
keep their markers and continuation indentation. The formatter keeps Markdown
links, JSDoc references, and inline code together.

## Placement and preservation

The adapter uses parser comments and AST nodes. Comment-like strings, template
text, regular expressions, and JSX text are never scanned as comments.

Moving a comment requires an unambiguous statement or member on one source
line. The target must start after indentation only. The comment must be the
last content on the line. Object properties, class fields, and TypeScript
interface members are supported. A source line with multiple statements or
members is left unchanged. Multiline targets, control-flow statements, methods,
and comments inside expressions are left in place.

Directives, type annotations, coverage instructions, compiler pragmas, license
headers, and triple-slash references stay unchanged. A protected line comment
also protects its adjacent line-comment group. A move cannot detach a preceding
`eslint-disable-next-line` or `@ts-expect-error` from its target. When a moved
line comment follows an existing leading paragraph, a blank `//` line separates
the paragraphs. This makes the first fix stable on subsequent runs.

JSDoc prose and supported tag descriptions wrap. Tag names, order, types,
parameter names, default values, and references stay intact. Description tags
include `@param`, `@arg`, `@argument`, `@property`, `@prop`, `@return`, `@returns`,
`@throw`, `@throws`, `@exception`, `@description`, `@desc`, `@summary`, `@remarks`,
and `@deprecated`. Unknown tags and their continuation lines stay unchanged.

Fences keep their language, metadata, indentation, code, and closing delimiter.
Unfenced `@example` bodies stay unchanged until the next tag. No code formatter
runs on examples. Tests cover Ariakit button documentation and the HTML example
from [Oxc issue 21549](https://github.com/oxc-project/oxc/issues/21549).

Ordinary single-line blocks can expand. Conventional starred blocks and plain
multiline blocks can reflow. Nonstandard block layouts, indented code, common
code-like lines, tables, headings, hard breaks, and unmatched inline markup
are preserved. This is a conservative prose formatter, not a full Markdown or
JSDoc parser. Put code in fences or in an `@example` body when its structure
cannot be distinguished from prose.

## Use with Oxfmt and an editor

Set the same width in both tools. Disable Oxfmt's JSDoc formatter explicitly in
`.oxfmtrc.json`:

```json
{
  "printWidth": 80,
  "jsdoc": false
}
```

Oxfmt documents this setting in its
[configuration reference](https://oxc.rs/docs/guide/usage/formatter/config-file-reference).
The plugin does not call Oxfmt's JSDoc formatter.

For a first cleanup, format the source before comment reflow. This lets the
plugin use the final code indentation and line length:

```sh
pnpm exec oxfmt src
pnpm exec oxlint --fix src
```

The integration tests check that another Oxfmt pass and another Oxlint fix
leave the tested output unchanged. Keep indentation and line-ending settings
consistent. Other rules that rewrite comments or move code can need another
cleanup pass.

For VS Code, install the
[Oxc extension](https://oxc.rs/docs/guide/usage/linter/editors) and use:

```json
{
  "[javascript][javascriptreact][typescript][typescriptreact]": {
    "editor.defaultFormatter": "oxc.oxc-vscode",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.oxc": "explicit"
    }
  }
}
```

Keep the package installed in the project that contains the Oxlint configuration.
The repository includes these editor settings. Editor UI behavior is not part
of the automated test suite; the CLI integration is tested.

## Develop

Use the version in `.node-version` (Node 24.20.0 LTS) and the package manager in
`package.json` (pnpm 12.3.4). Development dependencies are exact versions.
The compatibility checks also target Node 24.18.0 and Node 26.8.1.

```sh
pnpm install --frozen-lockfile
pnpm run check
```

| Command                 | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `pnpm run lint`         | Run Oxlint.                                                      |
| `pnpm run lint:fix`     | Apply Oxlint fixes.                                              |
| `pnpm run format`       | Run Oxfmt.                                                       |
| `pnpm run format:check` | Check source formatting.                                         |
| `pnpm run fix`          | Run lint fixes, then formatting.                                 |
| `pnpm run typecheck`    | Check source, test, and configuration types.                     |
| `pnpm test`             | Build and run Vitest tests.                                      |
| `pnpm run build`        | Emit JavaScript and declarations in `dist`.                      |
| `pnpm run changeset`    | Add a release note.                                              |
| `pnpm run version`      | Apply Changesets, update the lockfile, and format release files. |
| `pnpm run release`      | Publish pending releases. Use only after release setup.          |

`src/core.ts` has no Oxlint dependency. The public `./core` export provides
the prose functions for direct use and testing:

```ts
import { reflowText } from "oxlint-plugin-comment-reflow/core";

reflowText(["Two short", "lines form one paragraph."], 80);
// ["Two short lines form one paragraph."]
```

`src/rule.ts` owns AST placement and non-overlapping fixes. Vitest tests run real
Oxlint processes, verify repeat fixes, test the installed Changesets CLI, pack
the package, load the tarball contents from a consumer, and compile consumer
imports against the published declarations. The consumer test resolves external
dependencies from the local installation and requires no registry access.

Lefthook runs staged-file Oxlint fixes, then Oxfmt, in a serial pipeline.
Each successful job stages its fixes. `allowBuilds.lefthook: true` permits
Lefthook's installation script. Run `pnpm exec lefthook install` if a cached
dependency install does not create the hook. CI runs all checks independently.

Files in `tests/fixtures` contain intentional formatting and are excluded from
Oxlint, Oxfmt, and TypeScript project checks. Keep fixture edits deliberate.

## Changesets and release setup

Changesets uses public releases from `main`. The initial changeset releases
version 0.1.0 from the development version 0.0.0.

The changelog and patch come from the requested
[Ariakit snapshot](https://github.com/ariakit/ariakit/tree/4f7a9ef4b23caa3f460e2aeb30deeca9ad8f607d).
The patch makes the installed `@changesets/apply-release-plan@8.1.0` delegate
to `.changeset/changelog.ts`. This hook emits a version heading, overview,
feature headings, and other updates instead of Major/Minor/Patch sections.
The pnpm override keeps every dependency path on the patched version.

When you update that package, regenerate the patch, update the override and
Renovate constraint, and run `.changeset/get-changelog-entry.test.ts` through
Vitest. That test runs the installed Changesets CLI in a temporary single
package. It must pass before a patch version change is accepted.

The private GitHub repository uses its built-in `GITHUB_TOKEN` to create the
`Publish` version PR. No separate GitHub App or long-lived GitHub credential is
needed. The workflow explicitly dispatches Checks for the release branch, so
its checks do not depend on events generated by the automation token.

The repository must allow GitHub Actions to create pull requests under Settings
→ Actions → General → Workflow permissions. GitHub combines this with permission
to approve pull requests. This workflow creates version PRs and does not approve
reviews. Workflow permissions are scoped in `release.yml`; the repository default
can stay read-only.

After this permission is configured, set `RELEASE_ENABLED=true` to enable the
release workflow. This variable can be false during repository setup.

Npm publishing stays disabled until repository variable `NPM_PUBLISH_ENABLED`
is `true`. Version PRs and their checks run while this variable is false.

### First release

The npm package must exist before a trusted publisher can be configured. For
the first release, merge the `Publish` PR for 0.1.0 after its checks pass, then
publish from that exact `main` commit with an authenticated npm account:

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm publish --access public
```

This command publishes to npm. Account two-factor authentication can be required.
The repository remains private. `publishConfig.provenance` is false because
[npm provenance is not supported for private repositories](https://docs.npmjs.com/trusted-publishers/#automatic-provenance-generation).
The npm package itself is public, as required for an unscoped package.

### Subsequent releases

After the first package version exists, configure its npm trusted publisher:

- GitHub owner: `diegohaz`
- Repository: `oxlint-plugin-comment-reflow`
- Workflow filename: `release.yml`
- Allowed action: direct publishing with `npm publish`

Use the package settings on npm. Check the trust configuration, then set
`NPM_PUBLISH_ENABLED=true` in the GitHub repository variables. Future merges of
`Publish` PRs publish through OIDC. No npm token secret is needed. See
[npm's trusted publishing instructions](https://docs.npmjs.com/trusted-publishers/).

CodeRabbit and Renovate need their GitHub Apps installed for this repository.
Their checked-in configurations do not install the Apps. Require Checks before
merging PRs.

GitHub-owned Actions use major tags. Other Actions use full commit hashes,
matching the reference policy. Renovate keeps that policy, waits three days for
new releases, disables semantic commits, deduplicates pnpm, and groups Changesets
and Oxc updates.

No npm publication or account configuration is performed by the test suite.
See `NOTICE` for Ariakit attribution.
