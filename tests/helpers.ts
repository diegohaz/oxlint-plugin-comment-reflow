import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ReflowOptions } from "../src/core.js";

export const root = resolve(import.meta.dirname, "..");
export const oxlint = join(root, "node_modules/.bin/oxlint");
export const oxfmt = join(root, "node_modules/.bin/oxfmt");

export function fixture(name: string) {
  return readFileSync(join(root, "tests/fixtures", name), "utf8");
}

export function withProject<T>(run: (directory: string) => T): T {
  const directory = mkdtempSync(join(tmpdir(), "comment-reflow-"));
  try {
    return run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function lintIn(directory: string, fix = true) {
  return spawnSync(
    oxlint,
    [
      "--threads",
      "1",
      "-c",
      join(directory, ".oxlintrc.json"),
      ...(fix ? ["--fix"] : []),
      join(directory, "input.tsx"),
    ],
    { cwd: directory, encoding: "utf8" },
  );
}

export function configure(
  directory: string,
  options: ReflowOptions = {},
  specifier = join(root, "dist/index.js"),
) {
  writeFileSync(
    join(directory, ".oxlintrc.json"),
    JSON.stringify({
      categories: { correctness: "off" },
      jsPlugins: [{ name: "comment-reflow", specifier }],
      rules: { "comment-reflow/reflow": ["error", options] },
    }),
  );
}

export function fix(code: string, options: ReflowOptions = {}): string {
  return withProject((directory) => {
    configure(directory, options);
    writeFileSync(join(directory, "input.tsx"), code);
    const result = lintIn(directory);
    if (result.status !== 0) throw new Error(result.stdout + result.stderr);
    const output = readFileSync(join(directory, "input.tsx"), "utf8");
    const second = lintIn(directory);
    if (second.status !== 0) throw new Error(second.stdout + second.stderr);
    const repeated = readFileSync(join(directory, "input.tsx"), "utf8");
    if (repeated !== output)
      throw new Error(
        `Non-idempotent fix:\n${output}\nSecond pass:\n${repeated}`,
      );
    return output;
  });
}

export function formatIn(directory: string) {
  execFileSync(
    oxfmt,
    [
      "--config",
      join(directory, ".oxfmtrc.json"),
      join(directory, "input.tsx"),
    ],
    { cwd: directory },
  );
}
