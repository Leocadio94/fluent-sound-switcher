import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure logic only for now (config validation, accelerator parsing), so the
    // default node environment is enough — no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
