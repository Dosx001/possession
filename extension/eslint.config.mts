import js from "@eslint/js";
import * as tsParser from "@typescript-eslint/parser";
import solid from "eslint-plugin-solid/configs/typescript";
import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["**/dist/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    ...solid,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.browser,
        browser: "readonly",
      },
    },
  },
  {
    files: [
      "eslint.config.mts",
      "nightmare/vite.config.mts",
      "possession/vite.config.mts",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
]);
