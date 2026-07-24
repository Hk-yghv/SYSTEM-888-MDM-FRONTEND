import fs from "fs";
import pkg from "./package.json" with { type: "json" };

const manifest = {
    name: pkg.name,
    short_name: pkg.short_name,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d6efd",
    orientation: "portrait",
    icons: [
        {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png"
        },
        {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png"
        }
    ]
};

fs.writeFileSync(
    "./public/manifest.json",
    JSON.stringify(manifest, null, 2)
);

console.log("File manifest.json created:", pkg.name);