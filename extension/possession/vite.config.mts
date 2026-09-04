import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";
import type { Package } from "../vite.ts";

export default defineConfig({
  build: {
    modulePreload: false,
  },
  resolve: {
    alias: {
      urls: "src/urls.ts",
    },
  },
  plugins: [
    solid(),
    tailwindcss(),
    webExtension({
      browser: "firefox",
      skipManifestValidation: true,
      manifest: () => {
        const pkg = readJsonFile("package.json") as Package;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return {
          ...readJsonFile("src/manifest.json"),
          name: pkg.name,
          description: pkg.description,
          version: pkg.version,
        };
      },
      watchFilePaths: ["package.json", "src/manifest.json"],
    }),
  ],
});
