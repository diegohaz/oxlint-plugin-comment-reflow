import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

export default defineConfig({
  input: { index: "src/index.ts", core: "src/core.ts" },
  external: ["@oxlint/plugins"],
  plugins: [dts({ tsconfig: "tsconfig.build.json" })],
  output: {
    dir: "dist",
    format: "esm",
    cleanDir: true,
  },
});
