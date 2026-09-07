import type { Plugin } from "@oxlint/plugins";
import { reflowRule } from "./rule.js";

export type { ReflowOptions } from "./core.js";

/** Recommended Oxlint configuration; module paths resolve from the config file. */
export const recommended = {
  jsPlugins: [
    { name: "comment-reflow", specifier: "oxlint-plugin-comment-reflow" },
  ],
  rules: { "comment-reflow/reflow": "warn" as const },
};

const plugin = {
  meta: { name: "comment-reflow" },
  rules: { reflow: reflowRule },
  configs: { recommended },
} satisfies Plugin & { configs: { recommended: typeof recommended } };

export default plugin;
