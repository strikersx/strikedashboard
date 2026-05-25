import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/yogo-proxy.ts",
        "src/lib/yogo/fetch.ts",
        "src/lib/db.ts",
        "src/lib/auth.ts",
        "src/lib/constants.ts",
        "src/lib/utils.ts",
        "src/lib/wa/raw-body.ts",
        "src/lib/wa/meta.ts",
      ],
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
