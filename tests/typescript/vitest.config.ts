import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: [
      "node_modules/**/*",
      "dist/**/*",
      "build/**/*",
      ".git/**/*"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*"
      ]
    },
    reporters: ["verbose"],
    bail: 0,
    slowTestThreshold: 5000,
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },
    typecheck: {
      enabled: true,
      checker: "tsc",
      include: ["**/*.test.ts"],
      exclude: ["node_modules/**/*"]
    }
  },
  resolve: {
    alias: {
      "@": ".",
      "@mcp-servers": "../../mcp-servers"
    }
  }
});
