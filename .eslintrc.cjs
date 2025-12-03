// @ts-check

/** @typedef {import('eslint').ESLint.ConfigData} ConfigData */

/** @type {ConfigData} */
const config = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 'latest',
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/*', '.eslintrc.cjs'],
};

module.exports = config;
