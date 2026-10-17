import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

const sourceMapJsonPlugin = {
  name: "source-map-json-extension",
  apply: "build",
  enforce: "post",
  generateBundle(_options, bundle) {
    const renamedMaps = new Map();

    for (const [fileName, output] of Object.entries(bundle)) {
      if (!fileName.endsWith(".map")) continue;

      const jsonFileName = `${fileName}.json`;
      this.emitFile({
        type: "asset",
        fileName: jsonFileName,
        source: output.source,
      });
      delete bundle[fileName];
      renamedMaps.set(fileName.split("/").pop(), jsonFileName.split("/").pop());
    }

    const updateSourceMapUrl = (content) => content.replace(
      /sourceMappingURL=([^\s*]+)/g,
      (match, url) => {
        const renamedFile = renamedMaps.get(url.split("/").pop());
        return renamedFile ? `sourceMappingURL=${url}.json` : match;
      }
    );

    for (const output of Object.values(bundle)) {
      if (output.type === "chunk") {
        output.code = updateSourceMapUrl(output.code);
      } else if (typeof output.source === "string" && output.fileName.endsWith(".css")) {
        output.source = updateSourceMapUrl(output.source);
      }
    }
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), sourceMapJsonPlugin],

  build: {
    sourcemap: true,
  },

  define: {
    __APP_NAME__: JSON.stringify(pkg.name),
    __SHORT_NAME__: JSON.stringify(pkg.short_name),
    __WEBSITE_VERSION__: JSON.stringify(pkg.version),
  },
});