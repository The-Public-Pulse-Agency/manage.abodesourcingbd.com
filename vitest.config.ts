import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    // Integration tests hit a remote Neon DB (high round-trip latency), so allow
    // generous per-test and hook timeouts.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
