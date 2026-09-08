import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  configure,
  fix,
  fixture,
  formatIn,
  lintIn,
  oxlint,
  withProject,
} from "./helpers.js";

const trailing =
  'const foo = "a"; // A long explanation that exceeds the configured width.\n';

test.each([
  ["eight nine;", "// seven eight nine; ten eleven"],
  ["<b> eight nine", "// seven <b> eight nine ten\n// eleven"],
])("reflows prose containing %s through Oxlint", (middle, expected) => {
  const input = [
    "// one two three four five six seven",
    "// " + middle,
    "// ten eleven",
    "const value = 1;",
    "",
  ].join("\n");
  expect(fix(input, { printWidth: 33 })).toBe(
    ["// one two three four five six", expected, "const value = 1;", ""].join(
      "\n",
    ),
  );
});

test.each(["line", "block", "jsdoc"])(
  "preserves URL-only lines in %s comments",
  (kind) => {
    const lines = [
      "These short",
      "lines join.",
      "https://github.com/ariakit/ariakit/issues/7093",
      "More short",
      "lines join.",
    ];
    const expected = [
      "These short lines join.",
      lines[2]!,
      "More short lines join.",
    ];
    const comment = (contents: string[]) =>
      kind === "line"
        ? contents.map((line) => `// ${line}\n`).join("")
        : `${kind === "jsdoc" ? "/**" : "/*"}\n${contents.map((line) => ` * ${line}\n`).join("")} */\n`;
    expect(fix(comment(lines) + "const a = 1;\n", { printWidth: 80 })).toBe(
      comment(expected) + "const a = 1;\n",
    );
  },
);

test.each(["js", "jsx", "ts", "tsx"])(
  "loads and fixes a .%s file",
  (extension) => {
    withProject((directory) => {
      configure(directory, { trailingComments: "always" });
      const path = join(directory, `language.${extension}`);
      const code = extension.endsWith("x")
        ? "export const view = <div />;"
        : extension === "ts"
          ? "export const value: number = 1;"
          : "export const value = 1;";
      writeFileSync(path, code + " // An explanation\n");
      execFileSync(
        oxlint,
        [
          "--threads",
          "1",
          "-c",
          join(directory, ".oxlintrc.json"),
          "--fix",
          path,
        ],
        { cwd: directory, stdio: "pipe" },
      );
      expect(readFileSync(path, "utf8")).toBe(
        "// An explanation\n" + code + "\n",
      );
    });
  },
);

test("reflows plain multiline block comments", () => {
  const input =
    "/*\n  These short\n  lines form a paragraph with useful text.\n\n      foo()\n      bar()\n */\nconst a = 1;\n";
  const result = fix(input, { printWidth: 30 });
  expect(result).toBe(
    "/*\n  These short lines form a\n  paragraph with useful text.\n\n      foo()\n      bar()\n */\nconst a = 1;\n",
  );
});

test("preserves whole line-comment license groups", () => {
  const input =
    "// Copyright 2026 Diego Haz\n// These short\n// license lines must remain unchanged.\nconst a = 1;\n";
  expect(fix(input, { printWidth: 10 })).toBe(input);
});

test("keeps separate source paragraphs and different indentation", () => {
  const input =
    "// One paragraph.\n\n// Another paragraph.\nfunction foo() {\n  // A nested paragraph.\n    // A different indentation.\n}\n";
  expect(fix(input)).toBe(input);
});

test.each([
  "// @ts-expect-error Expected mismatch\n\nconst a: string = 1; // A long explanation here\n",
  "const a = 1; // #region A folding directive with a long explanation\n",
  "const a = 1; /*: SomeLongTypeAnnotation */\n",
  "// deno-lint-ignore no-unused-vars -- Keep this explanation with the directive.\nconst a = 1;\n",
])("preserves additional pragmas and directive gaps: %s", (input) => {
  expect(fix(input, { printWidth: 20, trailingComments: "always" })).toBe(
    input,
  );
});

test("uses the complete line width including indentation for overflow", () => {
  const input = "function foo() {\n\tconst x = 1; // Note\n}\n";
  expect(fix(input, { printWidth: 24 })).toBe(input);
  expect(fix(input, { printWidth: 23 })).toBe(
    "function foo() {\n\t// Note\n\tconst x = 1;\n}\n",
  );
});

test.each(["ignore", "always", "overflow"] as const)(
  "trailing mode: %s",
  (trailingComments) => {
    const result = fix(trailing, { printWidth: 50, trailingComments });
    expect(result).toBe(
      trailingComments === "ignore"
        ? trailing
        : '// A long explanation that exceeds the configured\n// width.\nconst foo = "a";\n',
    );
  },
);

test("overflow is the default; fitting comments stay in place", () => {
  expect(fix(trailing, { printWidth: 50 })).not.toBe(trailing);
  expect(fix("const a = 1; // Short\n")).toBe("const a = 1; // Short\n");
  expect(fix("const a = 1; // Short\n", { trailingComments: "always" })).toBe(
    "// Short\nconst a = 1;\n",
  );
});

test.each(["\n", "\r\n"])(
  "paragraphs, nested tabs, Unicode, and line ending %j",
  (eol) => {
    const input = [
      "function foo() {",
      "\t// These short",
      "\t// lines form one paragraph with 🙂 Unicode text.",
      "\t//",
      "\t// Another paragraph.",
      "\treturn 1;",
      "}",
      "",
    ].join(eol);
    const result = fix(input, { printWidth: 35 });
    expect(result).toBe(
      [
        "function foo() {",
        "\t// These short lines form one",
        "\t// paragraph with 🙂 Unicode",
        "\t// text.",
        "\t//",
        "\t// Another paragraph.",
        "\treturn 1;",
        "}",
        "",
      ].join(eol),
    );
  },
);

test("ordinary blocks, JSDoc, lists, links, and inline code", () => {
  const input =
    "/**\n * These short\n * lines are joined together.\n *\n * - A list with a [useful link](https://example.com) and `inline code`.\n * @param {string} name The name used to describe this useful example.\n */\nfunction foo(name: string) {}\n/* A long description of the next variable that needs wrapping. */\nconst a = 1;\n";
  const result = fix(input, { printWidth: 45 });
  expect(result).toContain(" * These short lines are joined together.");
  expect(result).toContain("[useful link](https://example.com)");
  expect(result).toContain("`inline code`");
  expect(result).toContain(" * @param {string} name The name used to");
  expect(result).toContain("/*\n * A long description of the next variable");
});

test("separates a standalone deprecated tag from its description", () => {
  const input =
    "/**\n * @deprecated\n * Use the replacement instead.\n */\nexport function oldFunction() {}\n";
  const options = { printWidth: 80, trailingComments: "always" } as const;
  const result = fix(input, options);
  expect(result).toBe(
    "/**\n * @deprecated Use the replacement instead.\n */\nexport function oldFunction() {}\n",
  );
});

describe("safe placement", () => {
  test.each([
    "const a = 1; const b = 2; // A long explanation here\n",
    "const a = { x: 1, y: 2 }; // @type {SomeType}\n",
    "const a = { x: 1, y: 2, // A long explanation here\n};\n",
    "foo(a, // A long explanation here\nb);\n",
    "const a = 1 + // A long explanation here\n2;\n",
    "const a = foo(\n  // These short\n  // lines should stay unchanged.\n  1\n);\n",
    "if (a) foo(); // A long explanation here\n",
    "const a = 1; /* A long explanation */ foo();\n",
    "const a = 1; /** A long type annotation */\n",
    "// @ts-expect-error Expected mismatch\nconst a: string = 1; // A long explanation here\n",
    "// eslint-disable-next-line no-unused-vars\nconst a = 1; // A long explanation here\n",
  ])("preserves ambiguous or directive-bound input: %s", (input) => {
    expect(fix(input, { trailingComments: "always", printWidth: 20 })).toBe(
      input,
    );
  });
  test("moves object, class, and interface members", () => {
    const input =
      "const object = {\n  x: 1, // Useful property\n};\nclass Foo {\n  x = 1; // Useful field\n}\ninterface Bar {\n  x: number; // Useful signature\n}\n";
    expect(fix(input, { trailingComments: "always" })).toBe(
      "const object = {\n  // Useful property\n  x: 1,\n};\nclass Foo {\n  // Useful field\n  x = 1;\n}\ninterface Bar {\n  // Useful signature\n  x: number;\n}\n",
    );
  });
  test("moves ordinary trailing blocks", () => {
    expect(
      fix("const a = 1; /* Useful explanation */\n", {
        trailingComments: "always",
      }),
    ).toBe("/* Useful explanation */\nconst a = 1;\n");
  });
});

describe("JSX comments", () => {
  test.each(["\n", "\r\n"])("reflows comments between props with %j", (eol) => {
    const input = [
      "const view = <Button",
      "  // These short",
      "  // lines form one paragraph with useful text.",
      '  prop="value"',
      "  /* These short lines form one paragraph with useful text. */",
      "  disabled",
      "/>;",
      "",
    ].join(eol);
    expect(fix(input, { printWidth: 40, trailingComments: "ignore" })).toBe(
      [
        "const view = <Button",
        "  // These short lines form one",
        "  // paragraph with useful text.",
        '  prop="value"',
        "  /*",
        "   * These short lines form one",
        "   * paragraph with useful text.",
        "   */",
        "  disabled",
        "/>;",
        "",
      ].join(eol),
    );
  });

  test.each(["<div>", "<>"])("reflows braced blocks inside %s", (opening) => {
    const closing = opening === "<>" ? "</>" : "</div>";
    const input = [
      `const view = ${opening}`,
      "  {/* These short lines form one paragraph with useful text. */}",
      "  {/*",
      "   * These short",
      "   * lines join.",
      "   */}",
      `${closing};`,
      "",
    ].join("\n");
    expect(fix(input, { printWidth: 40, trailingComments: "ignore" })).toBe(
      [
        `const view = ${opening}`,
        "  {/*",
        "   * These short lines form one",
        "   * paragraph with useful text.",
        "   */}",
        "  {/*",
        "   * These short lines join.",
        "   */}",
        `${closing};`,
        "",
      ].join("\n"),
    );
  });

  test("counts JSX braces when deciding whether a block fits", () => {
    const input = "const view = <>\n  {/* Short text */}\n</>;\n";
    expect(fix(input, { printWidth: 20 })).toBe(input);
    expect(fix(input, { printWidth: 19 })).toBe(
      "const view = <>\n  {/*\n   * Short text\n   */}\n</>;\n",
    );
  });

  test("keeps inline blocks inside the expression and preserves adjacent text", () => {
    expect(
      fix(
        "const view = <div>Hello{/* A long comment with useful text. */} world</div>;\n",
        {
          printWidth: 30,
        },
      ),
    ).toBe(
      "const view = <div>Hello{/*\n * A long comment with useful\n * text.\n */} world</div>;\n",
    );
  });

  test("reflows standalone line comments inside empty expressions", () => {
    const input =
      "const view = <>\n  {\n    // These short\n    // lines join.\n  }\n</>;\n";
    expect(fix(input, { trailingComments: "ignore" })).toBe(
      "const view = <>\n  {\n    // These short lines join.\n  }\n</>;\n",
    );
  });

  test.each(["", " "])(
    "keeps multiple blocks in the same JSX expression separate with gap %j",
    (gap) => {
      expect(
        fix(
          `const view = <>{/* First comment */${gap}/* Second comment */}</>;\n`,
          {
            printWidth: 30,
          },
        ),
      ).toBe(
        `const view = <>{/*\n * First comment\n */${gap}/*\n * Second comment\n */}</>;\n`,
      );
    },
  );

  test("keeps indentation stable after another block's closing marker", () => {
    expect(
      fix(
        "const view = <>{/* First comment *//* One two three four five six seven eight nine ten. */}</>;\n",
        {
          printWidth: 16,
        },
      ),
    ).toBe(
      "const view = <>{/*\n * First comment\n *//*\n * One two three\n * four five six\n * seven eight\n * nine ten.\n */}</>;\n",
    );
  });

  test.each([
    "const view = <Button\n  // eslint-disable-next-line some-rule -- A long directive explanation\n  // This adjacent comment is also protected.\n  prop='value'\n/>;\n",
    "const view = <Button\n  /*! A long license header that must stay unchanged. */\n  prop='value'\n/>;\n",
    "const view = <>{/* @ts-expect-error A long directive explanation */}</>;\n",
    "const view = <Button\n  prop={\n    // These short\n    // lines stay beside the value.\n    value\n  }\n/>;\n",
    "const view = <Button\n  {...\n    // These short\n    // lines stay beside the spread value.\n    props\n  }\n/>;\n",
    "const view = <Button\n  prop='value' // A long trailing explanation\n  disabled\n/>;\n",
  ])("preserves protected comments and comments beside code: %s", (input) => {
    expect(fix(input, { printWidth: 30, trailingComments: "always" })).toBe(
      input,
    );
  });
});

test("protects executable comments and licenses", () => {
  const input = fixture("protected.tsx");
  expect(fix(input, { printWidth: 20, trailingComments: "always" })).toBe(
    input,
  );
});

test("uses parser comments, never strings, regexes, templates, or JSX text", () => {
  const input = fixture("syntax.tsx");
  expect(fix(input, { printWidth: 20, trailingComments: "always" })).toBe(
    input,
  );
});

test("preserves the upstream fence regression and Ariakit examples", () => {
  const input = fixture("examples.tsx");
  const result = fix(input, { printWidth: 45 });
  const exampleBodies = (text: string) =>
    [...text.matchAll(/ \* @example[\s\S]*?(?= \* @(?!example)| \*\/)/g)].map(
      (match) => match[0],
    );
  expect(exampleBodies(result)).toEqual(exampleBodies(input));
  expect(result).not.toContain("```;");
  expect(result).not.toContain(";```");
  expect(result).not.toBe(input);
});

test("applies multiple non-overlapping fixes and converges", () => {
  const input =
    "// First short\n// paragraph here.\nconst a = 1; // First explanation\nconst b = 2; // Second explanation\n/**\n * Second short\n * paragraph here.\n */\nconst c = 3;\n";
  expect(fix(input, { trailingComments: "always" })).toBe(
    "// First short paragraph here.\n//\n// First explanation\nconst a = 1;\n// Second explanation\nconst b = 2;\n/**\n * Second short paragraph here.\n */\nconst c = 3;\n",
  );
});

test("reports useful diagnostics and validates options", () => {
  withProject((directory) => {
    writeFileSync(join(directory, "input.tsx"), trailing);
    configure(directory, { printWidth: 50 });
    const report = lintIn(directory, false);
    expect(report.status).toBe(1);
    expect(report.stdout + report.stderr).toContain(
      "Move this trailing comment",
    );
    for (const invalid of [
      { printWidth: 0 },
      { printWidth: 1.5 },
      { trailingComments: "sometimes" },
      { unknown: true },
    ]) {
      configure(directory, invalid as never);
      const result = lintIn(directory);
      expect(result.status).not.toBe(0);
      expect(readFileSync(join(directory, "input.tsx"), "utf8")).toBe(trailing);
    }
  });
});

test("Oxfmt and reflow reach a shared fixed point with JSDoc formatting disabled", () => {
  withProject((directory) => {
    configure(directory, { printWidth: 60, trailingComments: "always" });
    writeFileSync(
      join(directory, ".oxfmtrc.json"),
      JSON.stringify({ printWidth: 60, jsdoc: false }),
    );
    writeFileSync(
      join(directory, "input.tsx"),
      fixture("examples.tsx") +
        fixture("jsx.tsx") +
        trailing +
        "/* Ordinary block prose with several words that should wrap at the chosen width. */\nconst object = {\n  x:1, // A useful member description here.\n};\n",
    );
    for (let i = 0; i < 3; i++) {
      formatIn(directory);
      expect(lintIn(directory).status).toBe(0);
    }
    const stable = readFileSync(join(directory, "input.tsx"), "utf8");
    formatIn(directory);
    expect(readFileSync(join(directory, "input.tsx"), "utf8")).toBe(stable);
    expect(lintIn(directory).status).toBe(0);
    expect(readFileSync(join(directory, "input.tsx"), "utf8")).toBe(stable);
    expect(stable).not.toContain("```;");
  });
});
