// Linter du frontend : `npm run lint`
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off", // pas de PropTypes dans ce projet
      "react/no-unescaped-entities": "off", // apostrophes du texte français
      // `import React` est inutile avec le runtime JSX automatique, mais sans danger
      "no-unused-vars": ["error", { args: "none", varsIgnorePattern: "^React$" }],
    },
  },
  {
    files: ["*.config.js", "**/*.test.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
