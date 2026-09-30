import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { reporters: ["verbose"], maxWorkers: 2, include: ["src/**/*.test.{ts,tsx}", "tools/**/*.test.mjs"] },
});
