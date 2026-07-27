import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["mapbox-gl"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
