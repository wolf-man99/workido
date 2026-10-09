import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const integration = process.env.VITEST_INTEGRATION === "1";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" throws outside a React Server environment; tests run in Node.
      "server-only": fileURLToPath(new URL("./tests/support/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: integration ? ["tests/integration/**/*.test.ts"] : ["tests/unit/**/*.test.ts"],
    // Integration tests share one local database; run files sequentially.
    fileParallelism: !integration,
    testTimeout: integration ? 30_000 : 5_000,
    hookTimeout: integration ? 60_000 : 10_000,
  },
});
