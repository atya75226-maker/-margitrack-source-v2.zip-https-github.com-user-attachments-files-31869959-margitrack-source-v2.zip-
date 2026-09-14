import globals from 'globals'

/**
 * Vérification statique légère. L'objectif principal est `no-undef` : après un
 * renommage ou un déplacement, il attrape les imports manquants que le build,
 * lui, laisse passer.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', '.e2e-output/**'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
  {
    // Sans le greffon React, la règle ne voit pas les composants utilisés en JSX.
    files: ['**/*.jsx'],
    rules: { 'no-unused-vars': 'off' },
  },
]
