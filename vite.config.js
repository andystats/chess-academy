/// <reference types="vitest" />
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// A short commit id for the in-app build stamp (a static package version can't tell you whether a
// deploy actually shipped). Prefer a CI-provided SHA — the build checkout may be shallow or lack git
// — then fall back to local git, then to 'dev'.
function gitShortSha() {
  const fromEnv =
    process.env.VITE_GIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.COMMIT_REF
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

// Build-only Content-Security-Policy, injected as a <meta> tag (GitHub Pages can't set response
// headers; the same built HTML also covers Vercel). Dev is excluded on purpose — the dev server
// needs inline scripts for React Fast Refresh. Hashes for the page's inline scripts (the 404
// redirect-restore snippet) are computed from the FINAL built HTML, so editing the snippet can
// never silently break the policy. frame-ancestors is omitted (ignored in meta CSP); Vercel adds
// X-Frame-Options via vercel.json, and 'wasm-unsafe-eval' keeps the Stockfish worker compiling
// under hosts that do send CSP response headers.
function cspPlugin() {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          ([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
        )
        const csp = [
          "default-src 'self'",
          `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}`.trimEnd(),
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
          "worker-src 'self'",
          "object-src 'none'",
          "base-uri 'none'",
        ].join('; ')
        return {
          html,
          tags: [
            {
              tag: 'meta',
              attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
              injectTo: 'head-prepend',
            },
          ],
        }
      },
    },
  }
}

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
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
      'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitShortSha()),
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
    },
    plugins: [react(), cspPlugin()],
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
