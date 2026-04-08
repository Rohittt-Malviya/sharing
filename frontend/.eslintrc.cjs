module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off',

    // ── Code quality ──────────────────────────────────────────────────────────
    'no-debugger': 'error',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always', { null: 'ignore' }],

    // ── Security-relevant rules ───────────────────────────────────────────────
    // Disallow eval() and its equivalents
    'no-eval': 'error',
    'no-implied-eval': 'error',
    // Disallow inline event handlers that accept arbitrary strings (script injection risk)
    'no-script-url': 'error',
    // Require error objects in catch clauses
    'no-throw-literal': 'error',
  },
}

