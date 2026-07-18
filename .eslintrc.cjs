module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    ecmaVersion: 2020,
    sourceType: "module"
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  env: {
    browser: true,
    es2020: true,
    node: true
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
    ],
    "@typescript-eslint/no-non-null-assertion": "off",
    "no-inner-declarations": "off",
    "no-case-declarations": "off"
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "coverage/",
    "sample-vault/",
    "esbuild.config.mjs",
    "main.js"
  ]
};
