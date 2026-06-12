# Fix Plan — working the 2026-06-10 audit in bites

Companion to [`audit.md`](./audit.md) (findings detail) and [`audit.html`](./audit.html) (dashboard).
This file is the **durable work tracker**: check off items as they land, commit it with the code, and any
future session can resume cold from here.

## How to work this plan

1. Pick the next unchecked bite (they're ordered; A is time-sensitive, B–E fix the join reliability).
2. In a Claude Code session: *"Continue the chess-academy fix plan — do Bite <X> from .turbo/fix-plan.md"*.
   Each bite is self-contained; finding IDs (CORR-1 etc.) refer to `audit.md` for full context.
3. After each bite: run `npm run lint && npm test`, tick the boxes here, update the dashboard
   (see below), and commit code + `.turbo/` together — that keeps plan state and code state in lockstep.

## How to update the audit dashboard

- **`audit.md` is the source of truth.** When a finding is fixed, append to its table row:
  `→ **Fixed** <date> (<commit>)`. If a finding is rejected on closer look, mark `→ **Won't fix** (<reason>)`.
- **`audit.html`** is a static render of audit.md. Easiest: ask Claude
  *"sync .turbo/audit.html with the statuses in audit.md"* (it edits the matching rows / adds a Fixed badge
  and updates the dashboard tile counts). Hand-editing the corresponding `<tr>` works too.
- **Full re-audit** (recommended after Bites B–E land, and again before starting the duck-decay variant):
  run `/audit` in Claude Code from the repo — it regenerates `.turbo/audit.md` + `.turbo/audit.html`
  from scratch (≈30–45 min of agent time). The threat model at `.turbo/threat-model.md` is reused if present.
- This file: tick `- [x]`, add the commit hash on the bite's **Landed:** line.

## Status at a glance

| Bite | Theme | Status |
|---|---|---|
| A | CI quick wins (⏰ before 2026-06-16) | ✅ done 2026-06-11 (`9399a78`) |
| B | Protocol epoch — the P0 join deadlock | ✅ done 2026-06-11 (`e2dab68`) |
| C | Atomic turn apply + mid-turn safety | ✅ done 2026-06-11 (`a9409e3`) |
| D | Wire-input guards (peer payload hardening) | ✅ done 2026-06-11 (`282aa25`) |
| E | Identity & presence (lobby groundwork) | ✅ done 2026-06-11 (`f0f9574`) |
| F | Engine UX (false error banner, interrupt) | ✅ done 2026-06-11 (`312bbd5`, with G) |
| G | Lesson fixes (underpromotion, frozen step) | ✅ done 2026-06-11 (`312bbd5`) |
| H | UX & app hardening (chat, WebGL, CSP, links) | ✅ done 2026-06-11 (`beff9eb`; live CSP check open) |
| I | Dead-code decision (~982 orphaned lines) | ✅ done 2026-06-11 — deleted, −1,056 lines (`c1403e2`) |
| J | Roadmap seams (variant registry, serializer v2, shared hooks) | ✅ done 2026-06-11 (`289fbe4`) — **duck-decay prerequisites landed** |
| J2 | useBoardInput unification (split from J) | ✅ done 2026-06-12 via external Gemini commit `5435ff7`; manual board pass open |
| M | Field reliability (2026-06-11 freeze report) | ✅ done 2026-06-11 (`7348034`); field re-test passed 2026-06-12 |
| F1 | **Feature: database lobby** (external `5435ff7`+`462311b`, fixed here) | ✅ SQL run + probe green 2026-06-12; post-move crash + dead resign + status line fixed same day — commit & field-test |
| K | Test hardening | ☐ not started |
| L | Dependency majors (vitest/vite/React etc.) | ☐ not started |

Suggested order: **A → B → C → D → E** (join reliability fixed end-to-end), then F–H in any order,
I whenever, **J before starting lobby/chat/duck-decay features**, K alongside everything, L last.

---

## Bite A — CI quick wins ⏰ (API-1, SEC-8, TOOL-3, DEP-2, DEP-4, CORR-19g)

Deadline-driven: GitHub runners default to Node 24 on **2026-06-16**; v4 actions run on the deprecated Node 20 runtime.

- [x] Bumped `actions/checkout@v4 → v5` and `actions/setup-node@v4 → v5` in both workflows; `actions/deploy-pages@v4 → v5` in deploy.yml (`upload-pages-artifact@v3` is current — left in place). [API-1]
- [x] Added `permissions: contents: read` to `ci.yml` top level. [SEC-8]
- [x] deploy.yml `cancel-in-progress: true → false` (+ rationale comment, matching GitHub's Pages starter). [CORR-19]
- [x] Lint script → `eslint . --ext .js,.jsx,.mjs,.cjs --max-warnings=0`. Bonus discovery: ESLint 8 also skipped `.jsx` under `eslint .`, so CI now lints the React code for the first time. Fallout fixed: unused param in `useChessLesson.test.jsx`; unescaped apostrophes in `PickProfile.jsx` + `NotFoundPage.jsx`; eslintrc override silencing `react-refresh/only-export-components` for the two intentional mixed-export modules (`gamePanelParts.jsx`, `ProfileContext.jsx`); `materials/` added to ignorePatterns (gitignored local-only content). [TOOL-3]
- [x] `react-router-dom ^6.30.2 → ^6.30.4` (transitive `@remix-run/router` now 1.23.3 — clears both router advisories) + `npm audit fix` (no --force): **13 advisories → 4**; the remaining 4 are the vite/esbuild/vite-node/vitest chain reserved for the Bite L majors. [DEP-2, DEP-4]
- [x] Optional hardening done: all four actions pinned to full commit SHAs with `# vX.Y.Z` comments (checkout v5.0.1, setup-node v5.0.0, upload-pages-artifact v3.0.1, deploy-pages v5.0.0 — resolved via `git ls-remote`, all lightweight tags so the SHAs are commit SHAs) + new `.github/dependabot.yml` (github-actions ecosystem, monthly — keeps the pins fresh). [SEC-9]
- [x] Local verify: `npm run lint` clean · `npm test` 124/124 · `npm run build` ok (pre-existing chunk-size note only).
- [x] Remote verify: CI + Pages deploy green on main for every bite commit (checked 2026-06-11; live site last-modified matches the Bite E deploy). Dependabot already filing action-bump PRs as configured.

**Landed:** 2026-06-11 — commit `9399a78`.

## Bite B — Protocol epoch: fix the P0 join deadlock (CORR-1, CORR-6)

Root cause: `seq` is the only reconciliation primitive; resyncs/corrections don't bump it, so a joiner
whose `seq` ≥ host's drops everything forever. Files: `src/online/useOnlineGame.js`, `src/online/localSnapshot.js`.

- [x] `epoch` added to the snapshot shape (`buildSnapshot`); module-level `mintEpoch(current) = Math.max(Date.now(), current + 1)` — timestamp-based so a fresh host always outranks whatever a joiner holds; monotonic within one ms. `newGame()` mints a fresh epoch and resets `seqRef` to 0 → broadcasts (newEpoch, seq 1).
- [x] Epoch persists automatically inside the snapshot; lazy init restores it. A host resuming a pre-epoch persisted snapshot (or with no persisted state at all) mints fresh — covers cleared-storage / new-device hosts. Joiner starts at epoch 0 until its first adopted snapshot.
- [x] `adoptSnapshot`: adopt when `epoch > mine` OR (`epoch === mine` AND `seq > mine`); missing epoch normalizes to 0 (mixed-version games degrade to the old seq-only rule). On adopt it now clears `pendingIntentRef` AND `pendingPieceMoveRef` (a half-entered local turn is superseded).
- [x] Corrections receivable — chose the *targeted* option, not blanket-bumping (bump-on-everything would let an idle poll response clear a joiner's in-flight move-intent): `request-snapshot` now carries the requester's `{epoch, seq}` (transport: `useGameChannel.requestSnapshot(position)`), and the host's new `answerSnapshotRequest` mints a fresh epoch + bumps **only when the requester is strictly ahead**; routine polls are answered without bump, exactly as before. Documented in both file headers.
- [x] Fresh-host epoch: handled by the timestamp mint (no random epoch needed; strictly monotonic across devices with sane clocks).
- [x] Regression tests ×3 in `useOnlineGame.test.jsx` (+1 updated in `useGameChannel.test.jsx` for the request payload): (a) `newGame` broadcasts fresh-epoch/seq-1/reset board; (b) joiner adopts higher-epoch-lower-seq and keeps ignoring old-epoch stragglers; (c) host epoch-heals a stuck-ahead requester but answers a routine poll with no epoch churn and no bump. The pre-existing "ignores stale ones" test still passes as the same-epoch case. Suite: 127/127; lint clean.
- [ ] Manual verify (needs the live Supabase project): two browsers, play, host clears site data + reloads + "New game" — joiner must follow. Unit tests cover the protocol logic; this confirms it over real Realtime.

**Landed:** 2026-06-11 — commit `e2dab68`.

## Bite C — Atomic turn apply + mid-turn safety (CORR-2, CORR-3)

Files: `src/online/useOnlineGame.js` (`applyIntent`), `src/engine/duck/duckChess.js` (`placeDuck`).

- [x] `applyIntent` is now atomic — implemented as **validate-on-a-throwaway-clone, then replay** (mirrors the lesson engine's classify-on-a-clone pattern) rather than the suggested serialize-and-rebuild: the probe applies the piece move and the required duck placement first, and only if the whole turn passes is it replayed on the real instance. Same atomicity, but the host's move-list history survives a rejected intent (a rebuild would have blanked it). Rejections broadcast a bumped corrective snapshot exactly as before; this also kills the seq-inflating retry loop on an unfinishable intent. [CORR-2]
- [x] Kept Bite B's bump discipline: rejections bump (the sender's optimistic board must roll back); nothing else changed.
- [x] `placeDuck` guards the history annotation (`if (turns.length) …`) — chose skip-the-log over the push-a-synthetic-entry alternative because a synthetic `pieceMove: null` entry would crash `lastMoveOf` and history is already empty after any resume (serialize drops it); the duck still places and the turn flips. [CORR-3]
- [x] Tests: (a) occupied-duck-square intent → fen unchanged, phase stays 'piece', history survives, corrective broadcast sent, and the retried turn with a legal square completes (not wedged); (b) `createDuckGame(midTurnWire).placeDuck('e3')` succeeds, flips the turn, history stays empty. Suite: 129/129; lint clean.

**Landed:** 2026-06-11 — commit `a9409e3`.

## Bite D — Wire-input guards (SEC-1, SEC-2, SEC-3, SEC-4, SEC-5, SEC-7)

Anyone with the game id can broadcast; one malformed payload must never crash a client.
Files: `src/online/useOnlineGame.js`, `src/online/rules.js`, `src/engine/duck/board.js`, `src/engine/duck/duckChess.js`.

- [x] Every `createVariantGame(...)` from wire/storage data is guarded: `adoptSnapshot` validates **before committing** ((epoch, seq) advance only on adoption — a rejected snapshot can never block a later real one), and the lazy init falls back to a fresh game on a corrupt persisted snapshot instead of crashing on mount. Bonus: `synced` now reflects whether a snapshot actually restored (new `restoredRef`), not merely whether storage holds one — this also removed the per-render `loadSnapshot` read flagged in CORR-19. [SEC-1]
- [x] `applyIntent` shape-checks the payload before the seat-claim and the engine: `from`/`to` must be real squares, `promotion` ∈ {q,r,b,n,null}, `duckSquare` absent or a real square; garbage is dropped silently (and can no longer claim a seat). New shared `isSquare` exported from board.js. [SEC-2]
- [x] `deserialize` validates everything: string input, exactly 8 fields, turn ∈ {w,b}, phase ∈ {piece,duck}, duck/ep squares, castling `[KQkq]{1,4}` or `-`, digit-only clocks — throws on violation (callers catch). [SEC-3]
- [x] `parsePlacement` validates: only real piece letters/digits, rank boundaries on `/`, overflow >64 throws, total must be exactly 64. [SEC-4]
- [x] `squareToIndex` returns -1 for any non-square (incl. non-strings; verified all other callers pass generator-produced squares); `placeDuck` now checks membership in `legalDuckTargets(state)` — one check rejects occupied squares, the current duck, "z9"-style aliases, and non-strings. [SEC-5]
- [x] `adoptSnapshot` rejects wrong-variant snapshots, rejects non-string/empty `state` (an **empty string would otherwise silently reset a standard game** — chess.js treats `''` as "no FEN"; found while implementing), normalizes `players` to `{white, black}` from object payloads only, and coerces epoch/seq via `Number()`. King count: `parsePlacement` enforces at most one per side (zero stays valid — a captured king is the variant's terminal state). [SEC-7]
- [x] Tests (5 new): deserialize garbage table (15 cases incl. 65-square, overfull-rank, two-kings, NaN clocks), squareToIndex non-square table, placeDuck malformed-square table, host intent-garbage table (silent — no broadcast, board unchanged), joiner snapshot-garbage table (drops all, then a real snapshot still adopts). Suite: 134/134; lint clean.

**Landed:** 2026-06-11 — commit `282aa25`.

## Bite E — Identity & presence: lobby groundwork (CORR-4, CORR-5, CORR-7, CORR-8, CORR-9, CORR-10/API-4)

Files: `src/online/localSnapshot.js`, `src/online/useGameChannel.js`, `src/online/useOnlineGame.js`, `src/components/OnlineGamePanel.jsx`.

- [x] Per-tab identity: `selfId()` now lives in **sessionStorage** (in-memory fallback when storage is blocked) — each tab is a distinct player; an id survives reloads of its own tab. Deliberately did NOT adopt the legacy localStorage id (two tabs would both inherit it, recreating the collision); instead, **seats follow presence** (below) so a player whose id changed is re-seated automatically — which also makes the identity migration self-healing for in-flight games. [CORR-4]
- [x] Second-tab host detection: presence sync now derives `hostPresent` (any non-self presence tracking `isHost`) — a host seeing it renders "Game already open in another tab"; a joiner reads the same flag as "the host is here". [CORR-4]
- [x] Joiner playability gate: new `liveSynced` (a snapshot adopted **this session**) — a storage-restored board renders immediately but stays read-only with "Waiting for host…" until the host speaks; the resync poll keeps pulling while `!liveSynced` even when the stale board claims it's your turn. [CORR-5]
- [x] Terminal error state: after 6 consecutive failed attempts the channel status becomes `'error'` (no more auto-retries) — OnlineGamePanel's "Connection lost — try Resync" branch is finally reachable; `resync()` routes to the channel's new `reconnect()` (attempt counter reset, fresh channel), and `onSubscribed` re-syncs state as usual. [CORR-8]
- [x] Presence flap fix: a transient drop no longer resets `peerPresent` — the indicator holds its last-known value until the next presence sync; a terminal error clears it (genuinely down). [CORR-9]
- [x] Channel supersession: `teardownAndConnect` nulls `channelRef` before removing the old channel, and the subscribe callback ignores events from any channel the hook has replaced; a pending reconnect timer is cancelled on successful SUBSCRIBED. [CORR-10, API-4]
- [x] Seat feedback: snapshots already carry the seat map, so the joiner derives `seatTaken` (their color claimed by another id) → spectator mode ("Seat taken — watching as spectator", moves gated); self-heals when the seat re-binds to them. Host-side reseat rule in `applyIntent`: unclaimed → first mover (unchanged trust-on-first-move); claimed-but-absent claimant → live sender may take over (same invite-link trust); the host's own seat never moves. [CORR-7]
- [x] Tests — the two P0 coverage gaps closed: TEST-1 reconnect machine (backoff + reattempt, counter reset on success, terminal error after cap + recovery via reconnect(), presence retention vs terminal clear, no-reconnect-after-unmount) and TEST-2 seat authority (stray-third-party ignored silently, reseat-on-absence, host seat untouchable, seatTaken spectator + self-heal, storage-restored read-only gate). 9 new tests; suite 143/143; lint clean.
- [ ] Manual verify: two tabs of one browser on the same game — second tab should show "Game already open in another tab" instead of wedging both; and a joiner reopening from the invite link in a fresh tab should get their seat back on their first move.

**Landed:** 2026-06-11 — commit `f0f9574`.

## Bite F — Engine UX (CORR-11, CORR-12, CORR-13, API-5/6 quick wins)

- [x] `dispose()` settles with `err.isInterrupt = true`; `requestMove`'s catch skips `setError` for interrupts AND gates it on `mountedRef.current` (also closes the post-unmount setState noted in peer review). No more false "engine was stopped" banner after New game / resign / take-back. [CORR-11]
- [x] Interrupt-during-init fixed via a different (better) route than the plan's "dispose unconditionally": the real gap was that `engineRef` was only assigned *after* `init()` resolved, so `interrupt()` couldn't reach a warming engine at all. The engine now goes into the ref *before* the handshake (with the failure path nulling it), so `interrupt()` stops a mid-handshake engine — while the documented idle-engine-survives-reset optimization is preserved. The interrupted handshake rejects with the isInterrupt sentinel → no banner. [CORR-12]
- [x] `lastScore` scoped to the active search: a module-level `searching` flag set around the bestmove wait (try/finally); stray info lines outside a search are no longer captured. [CORR-13]
- [x] New shared `src/lib/ids.js` `randomId()` (guarded `crypto.randomUUID` + fallback) — now the single source used by both `localSnapshot.js` (which previously had its own copy) and `ProfileContext` (which previously called `crypto.randomUUID()` unguarded, ×2). ProfileContext's three raw `localStorage` calls wrapped in `readActiveId`/`writeActiveId` (degrade-don't-crash, mirroring storage.js). [API-5, API-6]
- [x] Verify: 143/143 tests, lint clean. (Dedicated stockfishClient/useStockfish unit tests remain a Bite K item as planned.)

**Landed:** 2026-06-11 — commit `312bbd5` (combined with Bite G).

## Bite G — Lesson fixes (CORR-14, CORR-15)

- [x] Tap-path promotion in **all three** controller hooks (lesson, engine, online): a tap onto a legal last-rank pawn target stashes the move (`pendingPromotion`) and opens react-chessboard's manual promotion dialog (`showPromotionDialog`/`promotionToSquare`, wired through BoardPanel + EngineGameView as `promotionTarget`). `onPromotionPieceSelect` falls back to the stashed move when the manual dialog omits from/to, and a dismissed dialog closes without moving. New shared `isPromotion(fen, from, to)` in `lesson/moves.js` — pure FEN inspection, so the same helper serves chess.js and the duck engine. (Bite J's `useBoardInput` extraction will collapse the three copies.) [CORR-14]
- [x] Frozen-step recovery: when the scripted opponent reply is illegal in the position reached via an accepted alternative, `scheduleOpponent` now credits the step as `complete` instead of silently returning and freezing in `playing-opponent`. (Deriving a fresh reply automatically was rejected — there's no scripted continuation to derive from; crediting the demonstrated idea is the authorable behavior.) [CORR-15]
- [x] Tests (8 new): isPromotion table ×2; lesson tap-promotion (picker opens / chosen piece classified / wrong promotion gets feedback / dismissal); alternative-with-unplayable-reply recovers + mainline path still plays the reply; online tap-promotion sends the chosen piece. Suite 151/151; lint clean — the strict gate even caught 3 real missing hook deps in this change.

**Landed:** 2026-06-11 — commit `312bbd5`.

## Bite H — UX & app hardening (CORR-16, CORR-17, CORR-18, SEC-6, SEC-10, CORR-19 picks)

- [x] Invite link: a joiner whose link is missing/invalid `?v` OR `?host` now gets a "This invite link looks broken" screen (both params are load-bearing for seat/variant); host path unaffected. [CORR-16]
- [x] Chat autoscroll scrolls the chat container itself (`scrollTop = scrollHeight`) — no more page yank; empty/whitespace sends blocked locally + Send button disabled when blank. [CORR-17 + CORR-19]
- [x] Chat receive guards in `handleChat`: string-typed text only, truncated to 2000 chars, last 200 messages kept (own sends under the same cap); chat ids now `randomId()` (no same-millisecond key collisions). [SEC-6 + CORR-19]
- [x] New `src/components/ErrorBoundary.jsx` (reload prompt) wrapping the app shell; `StylizedKingScene` guards `new WebGLRenderer` (no WebGL → empty hero, no crash) and renders a single static frame under reduced motion (re-drawn on resize) instead of a perpetual identical-frame RAF loop. [CORR-18 + CORR-19]
- [x] CSP shipped as a **build-time vite plugin** rather than a static meta in index.html — dev needs inline scripts for React Fast Refresh, and the plugin hashes the inline 404-restore snippet from the FINAL built HTML so editing it can't silently break the policy. Directives: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' + hashes (wasm for the Stockfish worker under header-sending hosts); style 'unsafe-inline' + fonts.googleapis.com; font gstatic; img 'self' data: (duck glyph); connect Supabase https+wss; worker 'self'; object/base-uri locked. frame-ancestors is meta-ignored per spec → covered on Vercel via new `headers` in vercel.json (X-Frame-Options DENY, nosniff, Referrer-Policy). Verified in dist/index.html. [SEC-10]
- [x] CORR-19 sweep: `Object.create(null)` in both `listProgress` impls; imported profile names trimmed before defaulting; `body?.entries ?? []` in registry ×2; dead `eventsPerSecond` removed [API-2]; inert `broadcast.ack` dropped [API-3]. (Lazy loadSnapshot landed back in Bite D.)
- [x] Verify: lint clean · 152/152 tests (new chat-cap test) · build green with the CSP meta present and correctly hashed.
- [ ] Manual verify on the live site after deploy: online game still connects under the CSP (watch the console for CSP violations during a real game + an engine game).

**Landed:** 2026-06-11 — commit `beff9eb`.

## Bite I — Dead-code decision (DEAD-1, DEAD-2)

**Decided 2026-06-11: DELETE** (owner's call — keeps the Arena-first focus; git history preserves everything for a future revival).

- [x] All 11 orphan files deleted (**−1,056 lines**): `HomePage`, `GlossaryPage`, `LessonPage`, `MySystemPage`, `TrainingPage`, `PickProfile`, `LessonView`, `StepPanel`, `GlossaryLink`, `ui/SectionHeader`, `content/mySystem.js`. Every file's import graph was re-verified fresh before deletion — zero live importers (only intra-cluster references).
- [x] Newly-orphaned exports cleaned: `getGlossaryIndex`/`listGlossaryEntries`/`listTracks` removed from registry (+ their tests); `AVATARS` un-exported (still the internal import allow-list); `flattenMySystemChapters` died with its file; the `/glossary → /#make-your-own` redirect retargeted to `/` (the anchor never existed).
- [x] **Deliberately KEPT** (scoping decision — "study pages" ≠ "lesson engine"): `useChessLesson` + `lesson/engine.js` + their tests + the content JSONs + CI validator. The lesson engine is tested, roadmap-critical (puzzle trainer), and only its UI died. Also kept: `withStepComplete` (progress schema API), `listByKind` (content-pipeline tests), `indexToSquare` (board API; Bite J consolidation target).
- [x] **Audit-finding correction discovered during verification**: `findTermLinks` and `indexGlossaryEntries` are NOT test-only — `scripts/validate-content.mjs` imports both in CI (the dead-code agent only grepped `src/`). Kept; deleting them would have broken the content pipeline.
- [x] Unused deps confirmed by grep and uninstalled: `tailwind-merge`, `@testing-library/user-event`.
- [x] Verify: lint clean · 150/150 tests (−2 tests of the deleted registry fns) · `validate-content` still green (20 files, 50 terms) · build green.

**Landed:** 2026-06-11 — commit `c1403e2`.

## Bite J — Roadmap seams: do BEFORE lobby/chat/duck-decay features (QUAL-1, QUAL-2, QUAL-3, QUAL-4, QUAL-5, QUAL-6)

- [x] **Variant registry** in rules.js: `VARIANTS = { standard, duck }` each with `{ label, pickerLabel, sublabel, create }` (key order = lobby display order). The lobby picker options, game-panel label, invite-link parser (`Object.hasOwn` guarded — prototype keys like `constructor` can't sneak through), and `createVariantGame` all derive from it; **unknown variants now throw** instead of silently becoming standard. Adding duck-decay = one registry entry + its engine. [QUAL-1]
- [x] **Serializer extension slot**: optional `name=value` fields after the 8 core wire fields, carried opaquely in `state.ext` (the core engine round-trips without interpreting; `getState` clones it; `boardFen()` never includes it). Validated on parse (lowercase names — `__proto__`-style keys are unrepresentable); plain games emit no extras, so existing persisted snapshots and older clients keep working. Duck-decay's per-square counters/repair clocks ride here, e.g. `decay=e4:2,d5:1`. [QUAL-2]
- [x] Board-diff captured derivation promoted to `gameState.capturedFromBoard` (shared, snapshot-safe, promotion-miscount tradeoff documented); the duck engine consumes it. [QUAL-3]
- [x] QUAL-4 presentational half: `pairMoves` deduped (EnginePanel's local copy removed) + shared `MoveList` in gamePanelParts used by both panels. The `Feedback` duplication resolved itself in Bite I (its twin died with StepPanel). **The `useBoardInput` hook unification is split out to Bite J2** — it rewires three working reducers and deserves its own verification cycle.
- [x] **`useGameChat` extracted** (`src/online/useGameChat.js`): messages state, receive shape-guard + caps, send — the seam the chat features build on; `useOnlineGame` just wires `onChat` and re-exports. [QUAL-6]
- [x] Shared `RealtimeNotConfigured` component replaces the two drifted notices (lobby + play). The SectionHeader/ContentCard halves of QUAL-5 were mooted by Bite I's deletions. [QUAL-5]
- [x] Convention sweep: `COLOR_NAME`/`SIDE_CHAR` exported from `lesson/moves.js` (rules.js, duckChess.js, useEngineGame, OnlinePlayPage all import them); new `fileRankToIndex` in board.js is the single home of the index formula (squareToIndex/pieceAt/duck-moves all route through it; `legalDuckTargets` uses `indexToSquare`); `START_FEN` imported in useChessLesson. Status-contract doc lands with J2's shared hook. [QUAL-6]
- [x] Tests (5 new): unknown-variant throws (incl. prototype-key probes) + registry completeness; ext round-trip (sorted, never in boardFen) + legacy 8-field parse + malformed-ext rejection. Suite 155/155; lint clean; build + validate-content green.

**Landed:** 2026-06-11 — commit `289fbe4`.

## Bite J2 — useBoardInput unification (split from Bite J for risk isolation)

The remaining QUAL-4 half: extract `useBoardInput({ fen, canMove, attemptMove, listTargets })` owning
selection + pendingPromotion state (cleared when `fen` changes, plus an explicit `clearSelection()` for
same-fen resets like restartStep), returning `{ selectedSquare, legalTargets, promotionTarget,
onPieceDrop, onPromotionPieceSelect, onSquareClick }`. The lesson/engine reducers drop their
selection/promotion fields + actions; the online hook drops its selection/pendingPromotion useState;
online wraps the click handler for its duck-phase branch, lesson for its mode/status guards. Document
the shared controller status contract in the hook header. Existing tap/promotion tests cover the
behavior; add an engine-hook tap test if missing.

- [x] Landed externally: a Gemini session (commit `5435ff7`, 2026-06-12) extracted
  `src/components/useBoardInput.js` with exactly this contract and rewired all three controllers;
  reducers slimmed as specced. Verified here 2026-06-12: suite green (169/169) after removing the
  unused `isPromotion`/`legalTargets` imports the refactor left behind (**CI lint was red** from
  `5435ff7` until the Feature-1 fix commit).
- [ ] Verify: a manual tap/drag/promotion pass in the arena and an online game.

**Landed:** 2026-06-12 — external commit `5435ff7` + import cleanup in the Feature-1 fix commit.

## Bite K — Test hardening (TEST-3..7 — TEST-1/2 land inside Bite E)

- [ ] `localSnapshot.test.js`: selfId stability, round-trips, corrupt-JSON → null, storage-throw degradation, gameId shape. [TEST-3]
- [ ] Resync cadence tests (fast→slow polling, no-poll-on-own-turn, host onPeerJoin/onRequestSnapshot re-broadcasts). [TEST-4]
- [ ] Degraded-gate tests (`canMovePiece` false when reconnecting/unsynced; joiner `newGame` no-op; `resync` roles; `flipBoard`). [TEST-5]
- [ ] Duck castling execution + rights (incl. captured corner rook); `deriveCaptured`/`toSan` tables. [TEST-6, TEST-7]
- [ ] ChatBox, ProfileContext import/export, lobby/play config derivation, `statusText` table. [TEST-7]
- [ ] Add `@vitest/coverage-v8` + `test:coverage` script (TOOL-4); optional: Prettier + husky/lint-staged (TOOL-1/2), `engines.node` pin (QUAL-7).

**Landed:** _(commit)_

## Bite L — Dependency majors (DEP-1, DEP-3, DEP-5 — last, it's churny)

- [ ] vitest → ≥3.2.6 (clears the critical advisory; expect config tweaks — `environmentMatchGlobs` is deprecated in 3.x, move to `test.projects`/workspace or per-file `@vitest-environment`).
- [ ] vite 5 → 8 (+ `@vitejs/plugin-react` 6) — also clears esbuild/vite-node advisories.
- [ ] Then, separately and only if wanted: React 19, react-chessboard 5 (breaking rewrite — re-verify BoardPanel props), Tailwind 4, ESLint flat config, jsdom 29, lucide 1.x.
- [ ] After each major: `npm run lint && npm test && npm run build` + a manual online-game smoke test.

**Landed:** _(commit)_

---

## Bite M — Field reliability (from the 2026-06-11 freeze report)

**Field report:** a live duck-chess game froze mid-play; on re-login the other player saw "Waiting
for opponent". Diagnosis: that status means connected + synced but *no other presence* — i.e. the
other side's tab genuinely wasn't on the channel. Two mechanisms fit, both now fixed:

- [x] **Wake-up recovery** (the prime suspect): a suspended tab (phone screen off, closed lid,
  mobile browsers freezing background pages) wakes with a dead socket that doesn't error until the
  next heartbeat (~25s+, sometimes never on iOS). `useGameChannel` now listens for
  `visibilitychange`/`online`: wake while known-down → reconnect immediately (skipping backoff and
  the terminal error); wake after >30s hidden → fresh channel even if it looks healthy (a socket
  rarely survives a real suspension); short blip → cheap state re-sync via the normal onSubscribed
  path. The frozen-tab side now recovers in ~1s instead of "whenever the heartbeat notices".
- [x] **Stuck-intent epoch heal** (the residual protocol wedge): Bite B fixed joiner-*ahead*
  deadlocks, but a joiner whose optimistic board diverged at the SAME seq was numerically invisible
  — its move-intents go nowhere, the host's no-bump corrections get dropped, and both players wait
  forever ("it froze"). Now: after 3 silent retries (~10s) the joiner drops the intent and sends
  `request-snapshot {stuck: true}`; the host answers a stuck requester with a fresh epoch
  (unconditionally adoptable) → the joiner rolls back to the authoritative board and play resumes.
- [x] **Opponent-absent guidance**: "Waiting for opponent…" now carries a hint ("they're not
  connected right now — keep this tab open; the game resumes when they return, or re-send the
  invite link") instead of reading like a dead end.
- [x] Tests (6 new): wake-reconnect when known-broken / after long suspension / short-hide re-sync /
  online-event recovery; joiner stuck-intent escalation (retries → heal request → no more resends →
  epoch heal unfreezes); host heals a same-seq `stuck` requester. Plus a test-isolation fix the new
  document-level listeners exposed (explicit RTL cleanup in the channel suite). 161/161; lint+build green.
- [x] **Field re-test**: owner replayed post-deploy and reported "it seems more stable" (2026-06-12).
  If a freeze ever recurs, the next step is still a small connection-event breadcrumb log to capture
  exactly what each side saw.

**Landed:** 2026-06-11 — commit `7348034`.

---

## Feature 1 — Database lobby (landed externally, fixed here)

**What landed externally (Gemini session, 2026-06-12, commits `5435ff7` + `462311b`):** the lobby is
now database-backed instead of invite-link-only. `supabase/schema.sql` defines `profiles` (FK to
auth.users) and `games` (status waiting/active/completed, host/joiner FKs into profiles,
state/seq/epoch persistence). OnlineLobbyPage signs in anonymously (Supabase Auth), lists open games
live via postgres_changes, and creates/joins rows; OnlinePlayPage resolves its config from the DB row
(URL params and localStorage are now fallbacks) and auto-joins waiting games. `useOnlineGame`
persists each authoritative snapshot to the games row (host only) and gained a resign-over-channel
flow (`resign-intent`). Bonus: the Bite J2 `useBoardInput` extraction. Invite links still work; live
moves still ride Realtime Broadcast — the DB is lobby + recovery, not the move path.

**2026-06-12 field report:** "Create match flashes 'Preparing Board…' then nothing happens."
Diagnosed with **`.turbo/probe-lobby-db.mjs`** (replays the lobby's exact API calls against the live
project — run `node .turbo/probe-lobby-db.mjs` whenever the lobby misbehaves). Root causes, all
confirmed against production:

1. **No table-level grants** — every REST call returned 42501 `permission denied for table …`
   before RLS was even consulted (anonymous sign-in itself worked fine).
2. **No INSERT policy on `profiles`** — the lobby's profile upsert could never create the row that
   `games.host_id`/`joiner_id` reference (an FK failure waiting behind #1).
3. **`username` was UNIQUE** — the second anonymous "Player" would have been rejected.
4. **`games.players` column missing** — the host's per-move persistence writes it; every move would
   have logged a silent 400.
5. **The UI swallowed every error** (`if (error) setCreating(false)` and nothing else) — hence
   "flashes then nothing".

**Fixed in code (2026-06-12):**
- [x] New `src/online/lobbyApi.js` — `ensureSessionAndProfile()`: one place that signs in
  (anonymous, session reused across reloads) AND upserts the profiles row; returns
  `{ user, error: { message, hint } }`. Used by the lobby (host path) and the play page (joiner
  path — auto-join writes `joiner_id`, also an FK). 6 unit tests in `lobbyApi.test.js`.
- [x] OnlineLobbyPage: every failure (sign-in, profile, list, create, join) renders a red error
  panel with the Supabase message + actionable hint; Create disabled until a session exists; join
  is a compare-and-swap (`.eq(status,'waiting').select()`) with a "seat just taken" message.
- [x] OnlinePlayPage: same helper for joiners; auto-join/lookup errors logged (channel play still
  works without the row claim); dead `user` state removed.
- [x] Lint debris from the external refactor removed (unused `isPromotion`/`legalTargets` imports,
  3 files) — **CI lint was red from `5435ff7` until this fix**.
- [x] `supabase/schema.sql` corrected for fresh projects (grants, profiles INSERT policy, username
  not unique, `players jsonb`).
- [x] Verify: lint clean · 169/169 tests · build green.

**2026-06-12 follow-up — owner ran the SQL (probe all-green), then: "crashes after the first move,
says something went wrong, asks to reload."** That's the Bite H ErrorBoundary catching a render
error. Root cause: the external panel rewrite called `pairMoves(game.history)` **without the
`moveLabel` formatter** — online history entries are `{pieceMove, san, duck}` objects, and React
throws on rendering an object child. Fired the moment the move list first rendered (= after move 1,
any variant, both sides). Fixed, plus two more regressions found in the same sweep:
- [x] `moveLabel` restored (with a comment on WHY the formatter is load-bearing); regression test
  `OnlineGamePanel.test.jsx` renders object-shaped history (4 panel tests total — first ever for
  this component).
- [x] The panel's rich `statusText` line restored (the rewrite had reduced it to "<color> to move" —
  losing "Waiting for opponent…", "Place the duck 🦆", the two-tab warning, spectator notice) and
  Bite M's opponent-absent hint re-added.
- [x] **Resign actually works now** — it was a complete no-op on both variants (duck stored a result
  the engine's `result()` never read; standard returned one that was discarded; nothing reached the
  wire). Resignation can't live in engine state (the FEN-superset has no field for it), so the
  controller owns it: `resignedRef` + an optional sanitized `result` field on snapshots/storage;
  adapters' `resign(color)` just computes the outcome (now symmetric across variants, enforced in
  the rules shape-parity test); host-seat resign-by-wire is rejected; resigned games accept no
  further intents; `newGame` clears it. The dead engine hack in duckChess.js was removed (Gemini's
  stalemate detection kept). 5 protocol tests incl. hostile result payloads; the test transport mock
  gained the previously-missing `sendResignIntent`.
- [x] Verify: lint clean · 179/179 tests · build green.

**Action required (owner, once):**
- [x] Supabase dashboard → SQL Editor → paste & run **`supabase/fix-lobby-grants.sql`** — done
  2026-06-12 ("Success. No rows returned"); probe re-run verified 200s end-to-end (sign-in,
  profile upsert, game insert with `players` column, update, FK-embedded list).
- [ ] Field test: create a match in one browser, join it from the lobby list in another; confirm
  the row flips to `active` and the open-matches list updates live (postgres_changes relies on the
  `alter publication supabase_realtime add table games;` line from schema.sql having run).

**Next lobby polish (queue behind the SQL fix):** host-side waiting-room panel on /play (big invite
link + "opponent joined!" off the existing `connection.peerPresent`), joiner usernames from profiles
in the game panel, stale-waiting-game cleanup, then chat upgrades on the `useGameChat` seam.

**Landed:** code 2026-06-12 — _commit pending; stamp the hash here once committed._ SQL fix: _pending owner run._

---

*Generated 2026-06-10 by the audit session. If this plan and audit.md ever disagree, audit.md's finding text wins; this file's checkboxes win for "what's done".*
