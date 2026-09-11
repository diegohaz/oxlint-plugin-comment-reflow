# oxlint-plugin-comment-reflow

Wrap comment prose and move eligible trailing comments above their target.
The plugin uses Oxlint's parser for JavaScript, JSX, TypeScript, and TSX.

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

The plugin leaves comment-like text in strings, template literals, regular
expressions, and JSX text unchanged.

Standalone `//` and `/* */` comments between JSX props reflow. Block comments
inside empty JSX expressions, such as `{/* Explanation */}`, reflow inside their
braces. Standalone line comments inside these expressions also reflow. Comments
beside an expression value stay unchanged.

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
runs on examples.

Ordinary single-line blocks can expand. Conventional starred blocks and plain
multiline blocks can reflow. Nonstandard block layouts, indented code, common
code-like lines, tables, headings, hard breaks, and unmatched inline markup
are preserved. This is a conservative prose formatter, not a full Markdown or
JSDoc parser. Put code in fences or in an `@example` body when its structure
cannot be distinguished from prose.

If a multiline block starts with a `*` line aligned under the first `*` in its
opening marker, the rule reports later nonblank lines that lack a `*` prefix.
The opening and closing markers must be on separate lines. These reports have
no autofix. Restore the missing prefixes, then run `--fix` to reflow the prose.
Blank lines and prefixes without a following space, such as `*text`, are not
reported. Plain blocks with `*` bullets and unstarred JSDoc blocks stay unchanged.

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

Keep indentation and line-ending settings consistent. Other rules that rewrite
comments or move code can need another cleanup pass.

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

## Use the prose API

Use `reflowText` to wrap comment text directly:

```ts
import { reflowText } from "oxlint-plugin-comment-reflow/core";

reflowText(["Two short", "lines form one paragraph."], 80);
// ["Two short lines form one paragraph."]
```

## Contributing

See [Contributing.md](https://github.com/diegohaz/oxlint-plugin-comment-reflow/blob/main/Contributing.md)
for development setup and checks.
