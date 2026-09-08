import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { configure, lintIn, oxlint, root, withProject } from "./helpers.js";

test("packed package loads from a consumer and publishes resolvable declarations", () => {
  withProject((directory) => {
    // Packing is offline and does not invoke any publication command.
    const packed = JSON.parse(
      execFileSync(
        "npm",
        [
          "pack",
          "--ignore-scripts",
          "--json",
          "--cache",
          join(directory, "npm-cache"),
          "--pack-destination",
          directory,
        ],
        { cwd: root, encoding: "utf8" },
      ),
    );
    const pack = Object.values(packed)[0] as {
      filename: string;
      files: { path: string }[];
    };
    const files: string[] = pack.files.map(
      (file: { path: string }) => file.path,
    );
    expect(files).toContain("dist/index.js");
    expect(files).toContain("dist/index.d.ts");
    expect(files).toContain("dist/core.d.ts");
    expect(files).not.toContain("dist/rule.js");
    expect(files).not.toContain("dist/rule.d.ts");
    expect(
      files.every(
        (file) =>
          file.startsWith("dist/") ||
          ["package.json", "README.md", "LICENSE"].includes(file),
      ),
    ).toBe(true);
    const consumer = join(directory, "consumer");
    const target = join(consumer, "node_modules/oxlint-plugin-comment-reflow");
    mkdirSync(target, { recursive: true });
    execFileSync("tar", [
      "-xzf",
      join(directory, pack.filename),
      "--strip-components=1",
      "-C",
      target,
    ]);
    mkdirSync(join(consumer, "node_modules/@oxlint"), { recursive: true });
    symlinkSync(
      join(root, "node_modules/@oxlint/plugins"),
      join(consumer, "node_modules/@oxlint/plugins"),
      "dir",
    );
    symlinkSync(
      join(root, "node_modules/oxlint"),
      join(consumer, "node_modules/oxlint"),
      "dir",
    );
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({ name: "consumer", private: true, type: "module" }),
    );
    configure(consumer, { printWidth: 30 }, "oxlint-plugin-comment-reflow");
    writeFileSync(
      join(consumer, "input.tsx"),
      "// These short\n// lines form a paragraph.\nconst a = 1;\n",
    );
    const result = lintIn(consumer);
    expect(result.stderr + result.stdout).not.toContain("Failed");
    expect(result.status).toBe(0);
    expect(readFileSync(join(consumer, "input.tsx"), "utf8")).toBe(
      "// These short lines form a\n// paragraph.\nconst a = 1;\n",
    );
    // Verify the meta.name namespace without a configuration alias as well.
    writeFileSync(
      join(consumer, ".oxlintrc.json"),
      JSON.stringify({
        categories: { correctness: "off" },
        jsPlugins: ["oxlint-plugin-comment-reflow"],
        rules: { "comment-reflow/reflow": "error" },
      }),
    );
    expect(lintIn(consumer).status).toBe(0);
    writeFileSync(
      join(consumer, "oxlint.config.ts"),
      'import { defineConfig } from "oxlint";\nimport { recommended } from "oxlint-plugin-comment-reflow";\nexport default defineConfig({ ...recommended, categories: { correctness: "off" } });\n',
    );
    execFileSync(
      oxlint,
      [
        "--threads",
        "1",
        "-c",
        join(consumer, "oxlint.config.ts"),
        join(consumer, "input.tsx"),
      ],
      { cwd: consumer, stdio: "pipe" },
    );
    writeFileSync(
      join(consumer, "types.ts"),
      'import plugin, { recommended, type ReflowOptions } from "oxlint-plugin-comment-reflow";\nimport { reflowText } from "oxlint-plugin-comment-reflow/core";\nconst options: ReflowOptions = { printWidth: 80, trailingComments: "overflow" };\nconst text: string[] = reflowText(["text"], options.printWidth!);\nplugin.rules.reflow.create;\nplugin.configs.recommended.rules;\nrecommended.jsPlugins;\nvoid text;\n// @ts-expect-error Invalid mode must be rejected by the published declarations.\nconst invalid: ReflowOptions = { trailingComments: "sometimes" };\n',
    );
    execFileSync(
      join(root, "node_modules/.bin/tsc"),
      [
        "--noEmit",
        "--strict",
        "--module",
        "NodeNext",
        "--target",
        "ES2023",
        "types.ts",
        "oxlint.config.ts",
      ],
      { cwd: consumer, stdio: "pipe" },
    );
  });
});
