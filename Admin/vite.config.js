import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("./package.json");

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    // oxc is Vite 8's default minifier (Rolldown-based, fast)
    minify: "oxc",
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/js/[hash].js",
        chunkFileNames: "assets/chunks/[hash].js",
      },
    },
  },

  define: {
    __APP_NAME__: JSON.stringify(pkg.name || 'SYSTEM MDM'),
    __SHORT_NAME__: JSON.stringify(pkg.short_name || pkg.name || 'MDM'),
    __WEBSITE_VERSION__: JSON.stringify(pkg.version || '1.0.0'),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow Cloudflare tunnel domains + localhost
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'systemmdm.houv.online',
      'systemmdm.hou.online',
      'system-mdm.hou.online',
      'apisystemmdm.houv.online',
      'apisystemmdm.hou.online',
      '.houv.online',
      '.hou.online', // Allow all *.hou.online/*.houv.online subdomains
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