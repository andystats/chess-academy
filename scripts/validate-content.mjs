#!/usr/bin/env node
// Validates every content envelope under src/content/: JSON-schema shape, then chess legality
// (every authored move legal, every line/puzzle solvable), glossary cross-link resolution, and
// id/charset/uniqueness. Emits NO artifact — it only passes (exit 0) or fails (exit 1) with
// human-readable messages, so a contributor's malformed PR fails CI with a friendly pointer.
//
// Run: npm run validate-content

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { Chess } from 'chess.js';
import Ajv from 'ajv';
import { mainlineIndexForPlayerMove, applyMove } from '../src/lesson/moves.js';
import { findTermLinks, indexGlossaryEntries } from '../src/content/glossaryLinks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'src', 'content');
const SCHEMA_PATH = join(CONTENT_DIR, 'schema', 'envelope.schema.json');

const errors = [];
const fail = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);

/** Recursively collect every .json content file, skipping the schema/ directory. */
function collectContentFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'schema') continue;
      out.push(...collectContentFiles(full));
    } else if (name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

function assertFen(file, where, fen) {
  try {
    new Chess(fen);
    return true;
  } catch {
    fail(file, `${where}: invalid FEN "${fen}"`);
    return false;
  }
}

function validateLine(file, where, step) {
  if (!assertFen(file, where, step.fen)) return;
  // Authored lessons have no setup ply: mainline starts with the player's move.
  const game = new Chess(step.fen);
  for (let i = 0; i < step.mainline.length; i++) {
    try {
      applyMove(game, step.mainline[i]);
    } catch {
      fail(file, `${where}: mainline move #${i + 1} "${step.mainline[i]}" is illegal`);
      return;
    }
  }
  // Each acceptable alternative must be legal at its ordinal AND let the rest of the line
  // continue legally (i.e. it transposes back into the mainline).
  for (const [key, alts] of Object.entries(step.acceptableAt ?? {})) {
    const mi = mainlineIndexForPlayerMove(Number(key), false);
    if (mi >= step.mainline.length) {
      fail(file, `${where}: acceptableAt["${key}"] points past the end of the line`);
      continue;
    }
    for (const alt of alts) {
      const probe = new Chess(step.fen);
      for (let i = 0; i < mi; i++) applyMove(probe, step.mainline[i]);
      try {
        applyMove(probe, alt);
      } catch {
        fail(file, `${where}: acceptableAt["${key}"] move "${alt}" is illegal here`);
        continue;
      }
      for (let i = mi + 1; i < step.mainline.length; i++) {
        try {
          applyMove(probe, step.mainline[i]);
        } catch {
          fail(file, `${where}: acceptableAt["${key}"] move "${alt}" does not rejoin the line (move #${i + 1} "${step.mainline[i]}" becomes illegal)`);
          break;
        }
      }
    }
  }
}

function validateLessonSteps(file, env, allStepIds) {
  const steps = env.body?.steps ?? [];
  const seen = new Set();
  steps.forEach((step, idx) => {
    const where = `step #${idx + 1} (${step.id})`;
    if (seen.has(step.id)) fail(file, `${where}: duplicate step id "${step.id}"`);
    seen.add(step.id);

    if (step.type === 'single-move') {
      if (!assertFen(file, where, step.fen)) return;
      for (const san of step.solution.san) {
        try {
          applyMove(new Chess(step.fen), san);
        } catch {
          fail(file, `${where}: solution move "${san}" is illegal`);
        }
      }
    } else if (step.type === 'line') {
      validateLine(file, where, step);
    } else if (step.type === 'choose') {
      if (!step.options.some((o) => o.correct)) fail(file, `${where}: no option is marked correct`);
    } else if (step.fen) {
      assertFen(file, where, step.fen);
    }
  });
  allStepIds.set(env.id, steps.map((s) => s.id));
}

function validatePuzzles(file, env) {
  for (const p of env.body.puzzles) {
    if (!assertFen(file, `puzzle ${p.id}`, p.fen)) continue;
    const game = new Chess(p.fen);
    try {
      applyMove(game, p.moves[0]); // opponent's setup move
    } catch {
      fail(file, `puzzle ${p.id}: setup move "${p.moves[0]}" is illegal`);
      continue;
    }
    const turn = game.turn() === 'w' ? 'white' : 'black';
    if (turn !== p.playerColor) {
      fail(file, `puzzle ${p.id}: playerColor "${p.playerColor}" disagrees with side to move "${turn}" after the setup move`);
    }
    for (let i = 1; i < p.moves.length; i++) {
      try {
        applyMove(game, p.moves[i]);
      } catch {
        fail(file, `puzzle ${p.id}: solution move #${i} "${p.moves[i]}" is illegal`);
        break;
      }
    }
  }
}

function validateScenario(file, env, idToFile) {
  const { fen, relatedLesson } = env.body;
  if (!assertFen(file, 'scenario', fen)) return;
  // A scenario you "play out" must start from a live position, not a finished game.
  if (new Chess(fen).isGameOver()) fail(file, 'scenario: starting FEN is already game-over');
  // A linked lesson must point at a real lesson envelope (resolved in pass 2 against all ids).
  if (relatedLesson && !idToFile.has(relatedLesson)) {
    fail(file, `scenario: relatedLesson "${relatedLesson}" does not resolve to any content id`);
  }
}

// --- Load schema + validator -------------------------------------------------
const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')));

// --- Pass 1: load, schema-validate, collect ids + glossary terms -------------
const files = collectContentFiles(CONTENT_DIR);
const envelopes = [];
const idToFile = new Map();
const glossaryTerms = new Set();

for (const file of files) {
  let env;
  try {
    env = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    fail(file, `invalid JSON: ${e.message}`);
    continue;
  }
  if (!validateSchema(env)) {
    for (const err of validateSchema.errors) fail(file, `schema ${err.instancePath || '/'} ${err.message}`);
    continue;
  }
  if (idToFile.has(env.id)) fail(file, `duplicate id "${env.id}" (also in ${relative(ROOT, idToFile.get(env.id))})`);
  idToFile.set(env.id, file);
  if (env.kind === 'glossary') {
    for (const term of indexGlossaryEntries(env.body.entries).keys()) glossaryTerms.add(term);
  }
  envelopes.push({ file, env });
}

// --- Pass 2: legality + glossary cross-links ---------------------------------
const allStepIds = new Map();
for (const { file, env } of envelopes) {
  if (env.kind === 'lesson') validateLessonSteps(file, env, allStepIds);
  if (env.kind === 'puzzleSet') validatePuzzles(file, env);
  if (env.kind === 'scenario') validateScenario(file, env, idToFile);

  // Every [[term]] in any prose must resolve to a known glossary term/alias.
  const proseBlocks = [];
  if (env.kind === 'lesson') for (const s of env.body.steps) proseBlocks.push(s.markdown);
  if (env.kind === 'glossary') for (const e of env.body.entries) proseBlocks.push(e.markdown ?? '', e.short);
  for (const md of proseBlocks) {
    for (const { slug } of findTermLinks(md)) {
      if (!glossaryTerms.has(slug)) fail(file, `glossary link [[${slug}]] does not resolve to any glossary term`);
    }
  }
}

// --- Report ------------------------------------------------------------------
if (errors.length) {
  console.error(`\n✖ Content validation failed (${errors.length} problem${errors.length > 1 ? 's' : ''}):\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error('');
  process.exit(1);
}
console.log(`✓ Content valid: ${envelopes.length} file${envelopes.length === 1 ? '' : 's'} checked, ${glossaryTerms.size} glossary terms.`);
