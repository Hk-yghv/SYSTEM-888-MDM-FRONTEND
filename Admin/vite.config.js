import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    minify: "oxc",
    sourcemap: false,
    rolldownOptions: {
      output: {
        entryFileNames: "assets/js/[hash].js",
        chunkFileNames: "assets/chunks/[hash].js",
      },
    },
  },

  define: {
    __APP_NAME__: JSON.stringify(pkg.name),
    __SHORT_NAME__: JSON.stringify(pkg.short_name),
    __WEBSITE_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow Cloudflare tunnel domains + localhost
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'systemmdm.houv.online',
      'apisystemmdm.houv.online',
      '.houv.online',  // Allow all *.houv.online subdomains
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
    // HMR config for Cloudflare tunnel (prevents WebSocket errors)
    hmr: {
      host: 'systemmdm.houv.online',
      protocol: 'wss',
      clientPort: 443,
    },
  }
});