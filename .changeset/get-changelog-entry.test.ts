import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "vitest";
import { root, withProject } from "../tests/helpers.js";
import {
  getChangelogEntry,
  getDependencyReleaseLine,
  getReleaseLine,
} from "./changelog.js";

test("renders overview, headings, and other updates in Ariakit order", async () => {
  const entry = await getChangelogEntry(
    { newVersion: "1.2.0" } as Parameters<typeof getChangelogEntry>[0],
    {
      major: [],
      minor: [
        Promise.resolve("### Feature\n\nFeature details."),
        Promise.resolve("### Overview\n\nOverview text."),
      ],
      patch: [Promise.resolve("- Fixed a bug.")],
    },
  );
  expect(entry).toBe(
    "## 1.2.0\n\nOverview text.\n\n### Feature\n\nFeature details.\n\n### Other updates\n\n- Fixed a bug.",
  );
  expect(
    await getReleaseLine({ summary: "A short update" } as Parameters<
      typeof getReleaseLine
    >[0]),
  ).toBe("- A short update");
  expect(await getDependencyReleaseLine([], [])).toBe("");
  expect(
    await getDependencyReleaseLine([], [
      { name: "dependency", newVersion: "2.0.0" },
    ] as Parameters<typeof getDependencyReleaseLine>[1]),
  ).toBe("- Updated dependencies: `dependency@2.0.0`");
});

test("the installed CLI resolves the patched release plan package", () => {
  const cliRequire = createRequire(import.meta.resolve("@changesets/cli"));
  expect(
    realpathSync(cliRequire.resolve("@changesets/apply-release-plan")),
  ).toBe(
    realpathSync(
      createRequire(import.meta.url).resolve("@changesets/apply-release-plan"),
    ),
  );
  const installed = readFileSync(
    cliRequire.resolve("@changesets/apply-release-plan"),
    "utf8",
  );
  expect(installed).toContain(
    'typeof changelogFuncs.getChangelogEntry === "function"',
  );
});

test("installed Changesets versions a temporary single package through the custom hook", () => {
  withProject((directory) => {
    mkdirSync(join(directory, ".changeset"));
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({
        name: "release-fixture",
        version: "1.0.0",
        type: "module",
      }),
    );
    for (const name of ["config.json", "changelog.ts"])
      copyFileSync(
        join(root, ".changeset", name),
        join(directory, ".changeset", name),
      );
    writeFileSync(
      join(directory, ".changeset", "feature.md"),
      '---\n"release-fixture": minor\n---\n\nFeature\n\nFeature details.\n',
    );
    writeFileSync(
      join(directory, ".changeset", "overview.md"),
      '---\n"release-fixture": minor\n---\n\nOverview\n\nA useful first release.\n',
    );
    writeFileSync(
      join(directory, ".changeset", "fix.md"),
      '---\n"release-fixture": patch\n---\n\nFixed a bug.\n',
    );
    execFileSync(
      process.execPath,
      [join(root, "node_modules/@changesets/cli/bin.js"), "version"],
      {
        cwd: directory,
        env: { ...process.env, CI: "true", LEFTHOOK: "0" },
        stdio: "pipe",
      },
    );
    expect(
      JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).version,
    ).toBe("1.1.0");
    expect(readFileSync(join(directory, "CHANGELOG.md"), "utf8")).toBe(
      "# release-fixture\n\n## 1.1.0\n\nA useful first release.\n\n### Feature\n\nFeature details.\n\n### Other updates\n\n- Fixed a bug.\n",
    );
    expect(existsSync(join(directory, ".changeset/feature.md"))).toBe(false);
  });
});
