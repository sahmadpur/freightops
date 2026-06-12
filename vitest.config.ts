import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
  resolve: {
    alias: { "@": path.resolve(path.dirname(import.meta.url.slice(7)), "./src") },
  },
});
