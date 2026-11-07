# Chess Academy Live Coach — Implementation and Progress Plan

Last updated: 2026-11-07
Starting commit: `7ba3379` (`main`)
Plan owner: Project maintainer + Antigravity / Codex

## Status snapshot

- Overall status: **Unified Live Engine & AI Coach (`/coach`) implemented, deployed to Supabase Edge Functions, and verified**
- Current release slice: **R7 — Unified Real-Time Coach, Fixed-Geometry Tabbed UI, Local Ollama & Supabase Cloud Proxy**
- Current task: **Complete — ready to commit/push or switch projects**
- Next validation gate: **Optional public GitHub Pages deploy check (`VITE_COACH_EDGE_FUNCTION=true`)**
- Blocking issues: **None**

This file is the durable handoff point for work that spans multiple sessions. Update the snapshot,
checkboxes, decision log, validation record, and session log before ending every implementation
session.

## Product outcome

Replace the standalone *My System* chapter tutorials and static Engine X-Ray drill with a unified,
calm, board-centric **Live Engine & AI Coach** (`/coach`):

1. **Always-Visible Central Chessboard (`30rem × 30rem` on desktop)** with permanent, fixed-height
   status, variation/control, and last-move feedback bars so the board never shifts or resizes.
2. **Real-Time Stockfish + Tactical/Positional Fact Extractor** (`src/coach/positionAnalyzer.js`)
   that runs `MultiPV=3` search alongside a **null-move opponent threat search**, loose/hanging
   piece detection, king-safety checks, opening/phase recognition, and Stockfish 10 classical
   evaluation breakdown.
3. **Fixed-Geometry 4-Tab Coaching Panel (`h-[39.25rem]`)** that organizes guidance into four calm,
   internally scrollable tabs without layout jitter or text clipping:
   - **Main Idea:** What to think about right now (opponent threats to neutralize, loose pieces,
     positional focus, and a recommended plan).
   - **Key Best Moves:** Top 3 Stockfish candidate moves translated into natural-language *why*
     explanations (`neutralizes threat`, `captures material`, `develops piece`, `castles to safety`,
     etc.) with interactive board arrows and PV preview.
   - **State of the Board:** Evaluation strip, classical evaluation factor grid (with Middlegame `MG`
     and Endgame `EG` tapered scores), hanging/undefended piece radar, clickable move history, and
     FEN loader.
   - **Ask Coach:** Grounded conversational Q&A backed by `strategyLibrary.js` (Nimzowitsch's *My
     System*, Capablanca's *Chess Fundamentals*, opening principles, tactical motifs, and endgame
     technique), exact piece-square maps, takeback memory (`lastTakenBackReview`), real-time
     simulation of hypothetical candidate moves (`analyzeHypotheticalMoves`), and multi-turn Q&A
     history, plus a pluggable LLM companion (**Supabase Edge Function (`coach-chat` → Claude Sonnet
     4.5 / 5.5 with Haiku 5.5 fallback)**, **Built-in Offline Synthesizer**, **Local Ollama
     (`llama3.2`)**, or direct BYOK for Anthropic/OpenAI/Gemini).

```mermaid
flowchart LR
  B["Interactive Chessboard (/coach)"] --> E["Stockfish 10 WASM (MultiPV=3 + Classical Eval)"]
  B --> T["Null-Move Opponent Threat Search"]
  E --> A["Position Analyzer (src/coach/positionAnalyzer.js)"]
  T --> A
  K["Strategy Library (src/coach/strategyLibrary.js)"] --> A
  A --> T1["Tab 1: Main Idea"]
  A --> T2["Tab 2: Key Best Moves"]
  A --> T3["Tab 3: State of the Board"]
  A --> LLM["LLM Coach Client (src/coach/llmCoachClient.js)"]
  K --> LLM
  LLM --> T4["Tab 4: Ask Coach (Built-in / Ollama / Supabase Claude)"]
```

## Constraints and guardrails

- Preserve the React 18 / Vite / Tailwind architecture and static GitHub Pages compatibility.
- Keep the chessboard central and locked in geometry (`lg:grid-cols-[30rem_minmax(0,1fr)]`, fixed
  `h-[39.25rem]` right column, `grid-cols-[minmax(0,1fr)]` + `min-w-0` + `break-words` inside tabs)
  so streaming engine depths or long text never cause box resizing, layout bounce, or right-edge
  clipping.
- Stabilize live engine analysis (`stabilizedAnalysis` in `CoachPage.jsx`) so shallow depths (`1–5`)
  from a new search do not blank out or flicker existing coaching cards while Stockfish calculates.
- Never embed secret LLM API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`) into
  public `VITE_*` GitHub Actions variables; use the deployed Supabase Edge Function
  (`supabase/functions/coach-chat/index.ts`) for public hosted coaching or `.env.local` / Local
  Ollama for local development.
- Do not ship, index, quote from, or import the local Quality Chess translation or its OCR.

## Architecture contracts

### Position coaching brief (`buildPositionBrief` in `src/coach/positionAnalyzer.js`)

```text
fen, turn, turnName, moveNumber
phase: { id: 'opening' | 'middlegame' | 'endgame', label }
opening: { eco, name, family, idea } | null
verdict: { label, tone, summary, totalScore }
whatToThinkAbout: string[]
recommendedPlan: string
candidateMoves[]:
  rank, san, uci, from, to
  score, mate, formattedScore
  pvSan[], pvUci[]
  why: string
  tags: string[]
facts:
  inCheck, checksAvailable[], capturesAvailable[]
  threatenedPieces[], hangingEnemyPieces[]
  undevelopedCount, castlingAvailable, centerControl
  imbalances: { strongestPositive, strongestNegative, ranked[] }
opponentThreat:
  san, uci, from, to, isCheck, capturedPiece, score, summary
```

### Move-played feedback (`evaluatePlayedMove` in `src/coach/positionAnalyzer.js`)

Compares the learner's played move against the pre-move `MultiPV` candidate list and post-move
evaluation drop (`delta`), returning a structured grade (`Optimal Move`, `Solid Choice`,
`Inaccuracy`, `Mistake`, or `Blunder — Tactical Alert`), concrete explanation, better move
recommendation, and refutation reply.

### Pluggable LLM Coach Client (`src/coach/llmCoachClient.js` & `supabase/functions/coach-chat/index.ts`)

Supports six provider modes:
- `builtin`: Deterministic synthesizer combining live Stockfish `MultiPV`, null-move threat facts,
  and retrieved `STRATEGY_CARDS`.
- `ollama`: Local offline LLM at `http://localhost:11434/api/chat` (default model `llama3.2`).
- `supabase`: Server-side Supabase Edge Function (`coach-chat`) on project `xhgthecnlswsvikgokfd`,
  using `ANTHROPIC_API_KEY` (`claude-sonnet-4-5` / `claude-sonnet-5-5` with automatic fallback to
  `claude-haiku-5-5`, and `thinking: { type: 'disabled' }`).
- `anthropic` / `openai` / `gemini`: Direct browser BYOK or `.env.local` fallback.

## Release map

### R0–R6 — Baseline, Engine Core, and Initial Study Lab Pilot (Completed 2026-07-30)

- [x] R0.1–R0.5 Audit repository, verify Stockfish 10 WASM `MultiPV` + classical `eval`, establish baseline.
- [x] R2.1–R2.8 Build pure UCI `info` and classical `eval` parsers, cancellable `MultiPV=3` worker pipeline, SAN conversion, and `useEngineAnalysis` React hook.
- [x] R4.1–R4.9 Build lexical strategy card retriever and copyright/OCR guardrails.
- [x] R6.1–R6.13 Pass unit/integration tests, zero-warning lint, content validation, and clean `dist/` check.

### R7 — Unified Live Engine & AI Coach, Fixed-Geometry UI, Local Ollama & Supabase Cloud Proxy (Completed 2026-11-07)

- [x] R7.1 Retire the standalone *My System* chapter tutorials (`/my-system`, `/my-system/coverage`, `/study/engine-xray`) and redirect legacy bookmarks cleanly to `/coach`.
- [x] R7.2 Build `src/coach/strategyLibrary.js` covering classical strategy (*My System*, *Chess Fundamentals*), opening principles, tactical motifs, and endgame technique.
- [x] R7.3 Build `src/coach/positionAnalyzer.js` with null-move threat detection, hanging-piece radar, natural-language `MultiPV` explanations, and `evaluatePlayedMove` grading.
- [x] R7.4 Build `src/coach/llmCoachClient.js` supporting Built-in Offline, Local Ollama (`llama3.2`), Supabase Edge Function (`coach-chat`), Anthropic, OpenAI, and Gemini.
- [x] R7.5 Install and configure local **Ollama** (`v0.40.15`, `llama3.2`, `OLLAMA_ORIGINS="*"`) for 100% free offline coaching.
- [x] R7.6 Restore paused Supabase project `xhgthecnlswsvikgokfd`, configure `ANTHROPIC_API_KEY` in Supabase Secrets, deploy `supabase/functions/coach-chat/index.ts` (`claude-haiku-5-5`), and verify live cloud responses end-to-end.
- [x] R7.7 Redesign `/coach` (`src/routes/CoachPage.jsx` & `src/components/NimzoCoach.jsx`) into a calm, board-centric layout with a permanent central board, depth-stabilized analysis, and a fixed-height (`h-[39.25rem]`) 4-tab panel (`Main Idea`, `Key Best Moves`, `State of the Board`, `Ask Coach`) free of box resizing or right-side text clipping.
- [x] R7.8 Balance Coach search depth (`depth >= 15`, always at least 4 plies deeper than the opponent engine, with `Master 2200+` capped at `depth: 11`) so optimal Coach recommendations (~2800+ Super-GM strength) consistently out-calculate `Master 2200+`.
- [x] R7.9 Enhance `Ask Coach` off-board reasoning with explicit piece-square maps (`pieceLocations`), takeback memory (`takenBackDetail` / `lastTakenBackReview`), real-time `chess.js` simulation of hypothetical moves (`analyzeHypotheticalMoves`), multi-turn Q&A history, and upgraded Claude Sonnet (`claude-sonnet-4-5` / `claude-sonnet-5-5` with `claude-haiku-5-5` fallback).
- [x] R7.10 Add Static Exchange Evaluation (`staticExchangeGain`, `seeRecaptureGain`, `bestLegalRecaptureNet`) to `detectOpponentThreats`, `assessSquareVulnerability`, and `analyzeHypotheticalMoves` so "nonsense checks" (where the checking piece can simply be captured or safely blocked) are filtered out of red threat arrows and discussion.
- [x] R7.11 Compile the 6-page `6in x 9in` LaTeX Player's Welcome Kit PDF (`docs/chess-academy-welcome-kit.tex` → `docs/chess-academy-welcome-kit.pdf`) including full engine rating tiers (`Learner ~600` to `Master 2200+` vs. `AI Coach ~2800+ Depth 15+`) and technical specifications.

## Validation record

| Date | Commit/worktree | Tests | Lint | Content | Build | Browser / Live API | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-30 | `7ba3379` baseline | 223 passed | Pass | 20 files / 50 terms | Pass | Pending | Clean baseline before feature work |
| 2026-07-30 | Visual-polish worktree | 293 passed | Pass | 20 files / 50 terms | Pass | Pass | Initial Study Lab pilot |
| 2026-11-07 | Unified `/coach` + Supabase + Ollama | 33 files / 302 passed | Pass (0 warnings) | 20 files / 50 terms | Pass (`dist/` clean) | Pass | Verified live `/coach` 4-tab fixed layout, local Ollama (`llama3.2`), and live Supabase `coach-chat` Edge Function (`claude-haiku-5-5`) |
| 2026-11-07 | SEE threat filter, Depth 15+ Coach, Takeback & Hypothetical Simulator, Claude Sonnet 4.5 | 33 files / 304 passed | Pass (0 warnings) | 20 files / 50 terms | Pass (`dist/` clean) | Pass | Verified live `coach-chat` on `claude-sonnet-4-5`, SEE threat filtering, Coach vs. Master 2200+ depth advantage, and 6-page LaTeX Welcome Kit PDF |

## Decision log

- **2026-07-30 — Use Stockfish 10 as a teaching asset.** Its classical evaluation trace is more
  interpretable than a modern neural evaluator, even though it is weaker than current Stockfish.
- **2026-07-30 — Keep public content original.** The local Quality Chess OCR remains private and is
  never part of retrieval in the shipped app.
- **2026-11-07 — Replace static chapter tutorials with a unified Live Engine & AI Coach (`/coach`).**
  Interactive play (vs. Stockfish Levels 1–20 or Both Sides Sandbox) with real-time threat detection
  and optimal move explanations is far more engaging and practical than static book-chapter drills.
- **2026-11-07 — Use null-move search for concrete threat detection.** By flipping the side to move
  in the current FEN (clearing en-passant) and running a quick background Stockfish pass, the coach
  can warn the player what the opponent threatens to do *if given a free move* (e.g., `Qe6+` or
  `Qxb7`).
- **2026-11-07 — Lock container geometry and stabilize shallow engine depths.** Streaming engine
  updates and conditional banners previously caused layout jitter. Every panel in `/coach` now has a
  fixed height, internal scrolling, `grid-cols-[minmax(0,1fr)]` width constraints to prevent text
  clipping, and depth stabilization (`depth >= 6`) so cards gently swap text in place.
- **2026-11-07 — Upgrade from retired `claude-3-5-haiku` IDs to `claude-sonnet-4-5` / `claude-sonnet-5-5` with `claude-haiku-5-5` fallback (`thinking: { type: 'disabled' }`).**
  Anthropic retired legacy 3.5 Haiku model IDs (`claude-3-5-haiku-*`). The Edge Function and client
  now try `claude-sonnet-4-5` / `claude-sonnet-5-5` first and automatically fall back to
  `claude-haiku-5-5` on 404, with extended thinking disabled for fast (~1.5–2.5s), high-IQ tactical
  and strategic coaching.
- **2026-11-07 — Keep Coach search depth 4+ plies deeper than the opponent engine (`depth >= 15` vs. Master `depth: 11`).**
  Previously, `Master (2200+)` searched uncapped during its time budget (Depth 16–20+, ~3100 Elo)
  while the Coach stopped at Depth 11. Capping Level 20 at Depth 11 and raising the Coach to Depth
  15+ guarantees the Coach's top moves reliably beat every opponent level.
- **2026-11-07 — Simulate off-board hypothetical moves and preserve takeback context in `formatStructuredBriefForPrompt`.**
  LLMs struggle when asked about moves that were just undone (`Take Back`) or hypothetical candidate
  moves (`"what if I play..."`). Preserving `takenBackDetail` in `useEngineGame.js` and simulating
  candidate moves via `analyzeHypotheticalMoves` in `positionAnalyzer.js` gives Claude verified
  board facts for off-board variations.

## Session log

### 2026-07-30 — Initial Study Lab & Visual Hierarchy Pass

- Built the initial Engine X-Ray core, UCI/classical `eval` parsers, `useEngineAnalysis` hook, and
  original concept retrieval.
- Verified contrast thresholds and responsive layouts across mobile and desktop.

### 2026-11-07 — Unified Live Engine & AI Coach, Supabase Cloud Proxy & Fixed-Geometry UI

- Retired the standalone *My System* chapter tutorials and unified the study experience into
  `/coach` (`src/routes/CoachPage.jsx`).
- Built `src/coach/positionAnalyzer.js` (null-move opponent threat search, hanging-piece detection,
  `MultiPV=3` natural-language move explanations, and post-move grading) and
  `src/coach/strategyLibrary.js`.
- Built `src/coach/llmCoachClient.js` and `supabase/functions/coach-chat/index.ts`.
- Installed local **Ollama** (`v0.40.15`) on macOS, configured `OLLAMA_ORIGINS="*"`, and pulled
  `llama3.2:latest` for offline LLM coaching.
- Restored paused Supabase project `xhgthecnlswsvikgokfd`, uploaded `ANTHROPIC_API_KEY` to Supabase
  Secrets, deployed the `coach-chat` Edge Function using `claude-haiku-5-5`, and configured local
  `.env.local` (kept strictly git-ignored).
- Redesigned `/coach` into a calm, board-centric two-column layout (`lg:grid-cols-[30rem_minmax(0,1fr)]`)
  with a permanent `LastMoveBanner`, depth-stabilized analysis, and a fixed `h-[39.25rem]` 4-tab
  coaching card (`Main Idea`, `Key Best Moves`, `State of the Board`, `Ask Coach`).
- Fixed right-side text clipping inside CSS grid tab panels by adding explicit
  `grid-cols-[minmax(0,1fr)]`, `min-w-0`, and `break-words`.
- Verified all gates: 33 test files (302 tests) passing, zero-warning ESLint, content validation
  (20 lessons / 50 glossary terms), and clean production build.

## End-of-session handoff checklist

- [x] Update “Status snapshot.”
- [x] Check completed task IDs and leave incomplete work unchecked.
- [x] Add validation results with exact failures or limitations.
- [x] Add decisions that future sessions should not reopen without new evidence.
- [x] Add a dated session-log entry.
- [x] Leave the worktree in a known state and list any unrelated pre-existing changes.
- [x] Name the single best next action.

Known worktree state: all modifications belong to the unified Live Engine & AI Coach (`/coach`),
Supabase `coach-chat` Edge Function, and documentation updates. `.env.local` is git-ignored.
