import { describe, expect, test } from "vitest";
import {
  columns,
  isProtected,
  reflowBlockComment,
  reflowText,
} from "../src/core.js";

describe("prose", () => {
  test.each([18, 77, 120])("preserves URL-only lines at width %s", (width) => {
    const link = "https://github.com/ariakit/ariakit/issues/7093";
    for (const url of [
      link,
      "http://example.com/path?query=value#section",
      "  HTTPS://example.com/path ",
    ]) {
      expect(reflowText([url, "Short prose."], width)).toEqual([
        url,
        "Short prose.",
      ]);
      expect(reflowText(["Short prose.", url], width)).toEqual([
        "Short prose.",
        url,
      ]);
      expect(reflowText(["Before.", url, "After."], width)).toEqual([
        "Before.",
        url,
        "After.",
      ]);
    }
  });
  test("reflows prose on both sides of URL-only lines", () => {
    const link = "https://example.com";
    expect(
      reflowText(
        ["These short", "lines join.", link, "More short", "lines join."],
        24,
      ),
    ).toEqual(["These short lines join.", link, "More short lines join."]);
    expect(reflowText([`Read ${link}`, "for details."], 80)).toEqual([
      `Read ${link} for details.`,
    ]);
    expect(reflowText([`${link} has details.`, "Read them."], 80)).toEqual([
      `${link} has details. Read them.`,
    ]);
  });
  test("joins and wraps paragraphs with blank boundaries", () => {
    expect(
      reflowText(
        [
          "These short",
          "lines form one paragraph.",
          "",
          "Another paragraph here.",
        ],
        24,
      ),
    ).toEqual([
      "These short lines form",
      "one paragraph.",
      "",
      "Another paragraph here.",
    ]);
  });
  test("keeps long tokens, URLs, links, references, and inline code intact", () => {
    const atoms = [
      "https://example.com/a/very/long/url",
      '[a useful link](https://example.com "a title")',
      "`some code here`",
      "``a ` inside``",
      "{@link Example | a useful label}",
    ];
    for (const atom of atoms)
      expect(
        reflowText([`Read ${atom} for details.`], 18).join("\n"),
      ).toContain(atom);
  });
  test("preserves unmatched inline markup", () => {
    expect(reflowText(["Read `an unfinished example here"], 10)).toEqual([
      "Read `an unfinished example here",
    ]);
  });
  test("preserves hard breaks, headings, tables, references, and code", () => {
    const lines = [
      "A hard break.  ",
      "# A heading",
      "| key | description |",
      "[ref]: https://example.com",
      "    const foo = 1",
      "    foo()",
    ];
    expect(reflowText(lines, 10)).toEqual(lines);
  });
  test("keeps lists and their continuation indentation", () => {
    expect(
      reflowText(
        [
          "- First item with several words",
          "  and more words.",
          "- Second item.",
        ],
        24,
      ),
    ).toEqual([
      "- First item with",
      "  several words and more",
      "  words.",
      "- Second item.",
    ]);
    expect(reflowText(["  - A nested item with many words here."], 22)).toEqual(
      ["  - A nested item with", "    many words here."],
    );
  });
  test("counts tabs and Unicode code points", () => {
    expect(columns("\t// 🙂 café")).toBe(13);
    expect(reflowText(["🙂 café αβ 中文 words words"], 12)).toEqual([
      "🙂 café αβ 中文",
      "words words",
    ]);
  });
});

describe("JSDoc", () => {
  test.each([
    "@deprecated",
    "@returns",
    "@returns {string}",
    "@throws {Error}",
    "@description",
    "@param {string} value",
    '@param {string} [value="default"]',
    "@property {string} value",
  ])("separates %s from a next-line description", (header) => {
    const result = reflowText(
      [header, "Use the replacement instead."],
      80,
      true,
    );
    expect(result).toEqual([`${header} Use the replacement instead.`]);
    expect(reflowText(result, 80, true)).toEqual(result);
    expect(reflowText([header], 80, true)).toEqual([header]);
  });
  test("wraps a next-line tag description with its separator", () => {
    const result = reflowText(
      ["@deprecated", "Use the replacement instead."],
      26,
      true,
    );
    expect(result).toEqual(["@deprecated Use the", "  replacement instead."]);
    expect(reflowText(result, 26, true)).toEqual(result);
  });
  test("preserves tag headers while wrapping descriptions", () => {
    const header =
      '@param {{ nested: { value: string } }} [options={ value: "a b" }] - ';
    const result = reflowText(
      [
        header + "A description with many words that can wrap.",
        "@returns {Promise<string>} The resulting text value.",
      ],
      40,
      true,
    );
    expect(result[0]).toBe(header + "A");
    expect(result.join("\n")).toContain(
      "@returns {Promise<string>} The resulting",
    );
    expect(reflowText(result, 40, true)).toEqual(result);
  });
  test("preserves fences, metadata, contents, and closing delimiters", () => {
    const lines = [
      "A short description.",
      "",
      "@example",
      '```html title="Link" {1}',
      '<a title="a">text</a>',
      "```",
      "",
      "@example",
      "```tsx live",
      "<Button>",
      "  Hello",
      "</Button>",
      "```",
      "@see https://example.com",
    ];
    expect(reflowText(lines, 15, true).slice(3)).toEqual(lines.slice(2));
  });
  test("preserves unfenced example lines until the next tag", () => {
    const lines = [
      "@example <caption>Usage</caption>",
      "const foo = 'a'",
      "",
      "  foo.toUpperCase()",
      "@returns {string} A long description of the returned value.",
    ];
    const result = reflowText(lines, 30, true);
    expect(result.slice(0, 4)).toEqual(lines.slice(0, 4));
    expect(result.slice(4)).toEqual([
      "@returns {string} A long",
      "  description of the returned",
      "  value.",
    ]);
  });
  test("preserves unknown tags, type syntax, and references", () => {
    const lines = [
      "@template {string} T",
      "@type {{ a: string, b: number }}",
      "  continued structured syntax",
      "@see {@link Foo | label}",
    ];
    expect(reflowText(lines, 10, true)).toEqual(lines);
  });
  test("does not promote prose to a tag or list", () => {
    expect(
      reflowText(["Use the @decorator syntax with care."], 8, true).every(
        (line) => !line.startsWith("@"),
      ),
    ).toBe(true);
  });
});

test.each([
  "@ts-expect-error Because the type differs",
  "eslint-disable-next-line no-console",
  "#__PURE__",
  "@jsxImportSource react",
  "SPDX-License-Identifier: MIT",
  "Copyright 2026 Diego Haz",
  "# sourceMappingURL=app.js.map",
  "istanbul ignore next",
])("protects %s", (text) => {
  expect(isProtected(text)).toBe(true);
});

test("wraps ordinary block prose", () => {
  expect(
    reflowBlockComment(
      "/* A long description of this useful variable. */",
      "  ",
      30,
      "\n",
    ),
  ).toBe("/*\n   * A long description of\n   * this useful variable.\n   */");
});

test("preserves default values with quoted brackets", () => {
  const header = '@param {string} [label="a] b"] - ';
  const output = reflowText(
    [header + "A description that can wrap at a narrow width."],
    36,
    true,
  );
  expect(output[0]).toBe(header + "A");
  expect(reflowText(output, 36, true)).toEqual(output);
});

test("wraps prose around a JSDoc reference without treating it as a table", () => {
  expect(
    reflowText(["Read {@link Foo | a label} for more details."], 30, true),
  ).toEqual(["Read {@link Foo | a label} for", "more details."]);
});

test("preserves multiline inline code and Markdown hard breaks", () => {
  const lines = ["Read `a code span", "with line breaks` carefully."];
  expect(reflowText(lines, 15)).toEqual(lines);
});

test("preserves tilde fences, longer closing fences, and nested fence text", () => {
  const lines = [
    "~~~~html title=example",
    "```",
    "@returns This is code inside a fence",
    "~~~",
    "~~~~~",
    "Prose after the fence can wrap.",
  ];
  const output = reflowText(lines, 20, true);
  expect(output.slice(0, 5)).toEqual(lines.slice(0, 5));
  expect(output.slice(5)).toEqual(["Prose after the", "fence can wrap."]);
});

test("preserves code-like ordinary comments and aligned content", () => {
  const lines = [
    "foo()",
    "bar()",
    "value = 1",
    "key | description",
    "--- | ---",
  ];
  expect(reflowText(lines, 8)).toEqual(lines);
});

test("preserves fenced code nested in a list", () => {
  const lines = [
    '- ```text title="Example"',
    "  first example line",
    "  second example line",
    "  ```",
    "Prose after this example can wrap.",
  ];
  expect(reflowText(lines, 20)).toEqual([
    ...lines.slice(0, 4),
    "Prose after this",
    "example can wrap.",
  ]);
});

test.each([
  ["@param {string} value Read `an inline", "  code example` carefully."],
  ["- Read `an inline", "  code example` carefully."],
])("preserves multiline inline markup in tags and lists", (...lines) => {
  expect(reflowText(lines, 20, true)).toEqual(lines);
});
