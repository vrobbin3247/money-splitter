import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import Terminal from "vite-plugin-terminal";

export default defineConfig({
  plugins: [tailwindcss(), Terminal()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // <-- THIS LINE
    },
  },
});
