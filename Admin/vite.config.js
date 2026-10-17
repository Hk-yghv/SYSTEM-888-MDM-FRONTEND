import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    sourcemap: true,
  },

  define: {
    __APP_NAME__: JSON.stringify(pkg.name),
    __SHORT_NAME__: JSON.stringify(pkg.short_name),
    __WEBSITE_VERSION__: JSON.stringify(pkg.version),
  },
});