import js from "@eslint/js";
import * as tsParser from "@typescript-eslint/parser";
import solid from "eslint-plugin-solid/configs/typescript";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["**/dist/**", "**/*.d.ts"],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.strictTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    ...solid,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: [
          "./tsconfig.json",
          "./possession/tsconfig.json",
          "./nightmare/tsconfig.json",
        ],
      },
      globals: {
        ...globals.browser,
        browser: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
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
