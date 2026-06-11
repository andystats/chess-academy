module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', 'stuff', 'public/engine', 'materials'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: '18.3' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'react/prop-types': 'off',
  },
  overrides: [
    {
      // These modules intentionally export helpers/constants alongside components (shared game-panel
      // parts; the profile context's provider + hook). Fast Refresh just falls back to a full reload.
      files: ['src/components/gamePanelParts.jsx', 'src/profile/ProfileContext.jsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
    {
      // Vitest globals are enabled via `test.globals` in vite.config.js; declare them for lint.
      files: ['**/*.test.{js,jsx}', 'src/test/**'],
      globals: {
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  ],
}
