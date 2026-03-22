// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import perfectionist from "eslint-plugin-perfectionist";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config({ ignores: ["dist", "../public"] }, {
  files: ["**/*.{ts,tsx}"],
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  plugins: {
    "react-hooks": reactHooks,
    perfectionist,
  },
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    "perfectionist/sort-imports": [
      "error",
      {
        type: "natural",
        groups: [
          "builtin",
          "external",
          "internal",
          ["parent", "sibling", "index"],
          "type",
        ],
      },
    ],
    "perfectionist/sort-exports": ["error", { type: "natural" }],
  },
}, eslintConfigPrettier, storybook.configs["flat/recommended"]);
