import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@captcha-kit/core": path.resolve(__dirname, "packages/core/src/index.ts"),
    },
  },
});
