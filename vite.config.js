/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// `base` controls the public path the app is served from. Locally this is '/'.
// On GitHub Pages project sites the app lives under '/<repo>/', so CI sets
// BASE_PATH=/<repo>/ at build time. The router reads import.meta.env.BASE_URL
// (derived from this) for its basename, so the two stay in sync automatically.
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Inline the Supabase env ourselves. Vite's automatic import.meta.env replacement proved
  // unreliable on the GitHub Actions runner (loadEnv returned the values, yet the build did not
  // inline them — the bundle was byte-identical to a no-credentials build). A `define` is a direct
  // textual substitution, so it works regardless. Source the values from loadEnv, which reads the
  // .env files (CI writes .env.production from repo secrets; local dev uses .env.local).
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: process.env.BASE_PATH || '/',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ''),
    },
    plugins: [react()],
    test: {
      globals: true,
      // Pure logic tests run in the lightweight node env; only the React hook/component tests
      // (*.test.jsx) pay for jsdom. Keeps the suite fast and memory-light.
      environment: 'node',
      environmentMatchGlobs: [['**/*.test.jsx', 'jsdom']],
      setupFiles: './src/test/setup.js',
      css: false,
      // Run all files in one forked process: forks get full process memory (workers have a small
      // heap limit that jsdom blows through here → ERR_WORKER_OUT_OF_MEMORY).
      pool: 'forks',
      poolOptions: { forks: { singleFork: true } },
    },
  }
})
