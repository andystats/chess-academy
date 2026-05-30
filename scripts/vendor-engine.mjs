#!/usr/bin/env node
// Copies the Stockfish WASM engine from the stockfish.js package into public/engine/ so Vite
// serves it as a static Web Worker. The binaries are GPL-3.0 and deliberately kept OUT of git
// (see .gitignore + THIRD_PARTY.md): they're vendored here at install/build time instead. Idempotent
// — skips files that already exist, so it's cheap to run from postinstall/predev/prebuild.
//
// Run: node scripts/vendor-engine.mjs

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'node_modules', 'stockfish.js');
const DEST = join(ROOT, 'public', 'engine');

// stockfish.wasm.js + stockfish.wasm are the single-threaded WASM worker (no SharedArrayBuffer, so
// it runs on GitHub Pages without COOP/COEP headers); stockfish.js is the asm.js fallback.
const FILES = ['stockfish.js', 'stockfish.wasm.js', 'stockfish.wasm', 'Copying.txt'];

if (!existsSync(SRC)) {
  console.error('✖ stockfish.js is not installed. Run `npm install` first.');
  process.exit(1);
}

mkdirSync(DEST, { recursive: true });
let copied = 0;
for (const name of FILES) {
  const dest = join(DEST, name);
  if (existsSync(dest)) continue;
  copyFileSync(join(SRC, name), dest);
  copied += 1;
}
console.log(`✓ Engine vendored to public/engine/ (${copied} file${copied === 1 ? '' : 's'} copied, ${FILES.length - copied} already present).`);
