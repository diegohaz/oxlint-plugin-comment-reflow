import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { root, withProject } from "../tests/helpers.js";

test.each([
  ["major", "2.0.0", "Major"],
  ["minor", "1.1.0", "Minor"],
  ["patch", "1.0.1", "Patch"],
])(
  "installed Changesets generates a %s release with its standard changelog",
  (type, version, heading) => {
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
      copyFileSync(
        join(root, ".changeset/config.json"),
        join(directory, ".changeset/config.json"),
      );
      symlinkSync(
        join(root, "node_modules"),
        join(directory, "node_modules"),
        "dir",
      );
      const previousChangelog =
        "# release-fixture\n\n## 1.0.0\n\n- Initial release.\n";
      writeFileSync(join(directory, "CHANGELOG.md"), previousChangelog);
      writeFileSync(
        join(directory, ".changeset", "feature.md"),
        `---\n"release-fixture": ${type}\n---\n\nFeature\n\nFeature details.\n`,
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
        JSON.parse(readFileSync(join(directory, "package.json"), "utf8"))
          .version,
      ).toBe(version);
      const changelog = readFileSync(join(directory, "CHANGELOG.md"), "utf8");
      expect(changelog).toContain(`## ${version}\n\n### ${heading} Changes\n`);
      expect(changelog).toContain("- Feature\n\n  Feature details.");
      expect(changelog).toContain("### Patch Changes\n");
      expect(changelog).toContain("- Fixed a bug.");
      expect(changelog).toContain(
        previousChangelog.replace("# release-fixture\n\n", ""),
      );
      for (const name of ["feature.md", "fix.md"])
        expect(existsSync(join(directory, ".changeset", name))).toBe(false);
    });
  },
);
