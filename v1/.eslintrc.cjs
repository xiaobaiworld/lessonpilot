module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  ignorePatterns: ["**/dist/**", "**/node_modules/**"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    // 现有 Chrome 边界替身和畸形输入测试需要显式 any；严格类型仍由 tsc 门禁负责。
    "@typescript-eslint/no-explicit-any": "off",
  },
};
