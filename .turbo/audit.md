# Audit Report

**Date:** 2026-06-10
**Work tracker:** [`fix-plan.md`](./fix-plan.md) — bite-sized, checkbox-tracked fix plan derived from these findings; it also documents how to update this report and the HTML dashboard as fixes land.
**Scope:** Full project audit of `chess-academy` (all source, config, scripts, CI; vendored `public/engine/` Stockfish and `node_modules` excluded). 39 analysis agents (correctness, security, API usage, peer review, quality × 7 partitions; test coverage, dependencies, tooling, dead code project-wide), findings evaluated with a Devil's-Advocate verification pass. Owner's stated concern: **online join/connect ("login") reliability**, ahead of planned work on a lobby/waiting room, chat improvements, and a "duck chess decay" variant.

## Dashboard

| Category | Health | Findings | Critical |
|---|---|---|---|
| Correctness | Warn — P0 fixed 2026-06-11 | 28 | 0 open (1 fixed) |
| Security | Pass† | 13 | 0 |
| API Usage | Pass† | 8 | 0 |
| Code Quality | Warn | 12 | 0 |
| Test Coverage | Warn — both P0 gaps covered 2026-06-11 | 13 | 0 open (2 covered) |
| Dependencies | Warn | 18 | 0 |
| Tooling | Pass† | 5 | 0 |
| Dead Code | Pass† | 14 | 0 |
| Threat Model | Present (`.turbo/threat-model.md`) | — | — |

† Pass under the P0/P1 threshold, but with actionable P2 findings listed below.

### Health Thresholds

- **Pass** — zero P0/P1 findings in this category
- **Warn** — P1 findings present but no P0
- **Fail** — P0 findings present

### The headline: why joining feels unreliable

The shipped multiplayer is **not** the architecture in `docs/future-multiplayer-and-duck-chess.md` (no Supabase Auth/Postgres/RLS/Edge Functions). It is Supabase Realtime **Broadcast + Presence on public channels**, where the game creator's browser tab is the sole authority and a monotonic `seq` on full-state snapshots is the only reconciliation primitive. Five findings compound into the observed flakiness:

1. **Any state where the joiner's `seq` ≥ the host's is unrecoverable** (CORR-1). Resync responses and corrections never bump `seq`, so they are dropped by the joiner's `seq <=` guard forever. Triggers: host returning on a new device/cleared storage, "New game" after divergence, multi-tab stomping. *(Fixed 2026-06-11 — epoch protocol.)*
2. **Two tabs in the same browser collide** (CORR-4): one global `selfId` plus host-config keyed only by game id means your own invite link opened in a second tab becomes a *second host* with the *same identity* — presence sees one client, and both tabs wait forever. This breaks the most common way to demo/test the app. *(Fixed 2026-06-11 — per-tab identity + presence-following seats + duplicate-host notice.)*
3. **A joiner with a stale persisted snapshot boots "synced"** (CORR-5) and can move with no host present; the move-intent retries into the void. *(Fixed 2026-06-11 — `liveSynced` gate.)*
4. **A mid-turn duck snapshot kills the turn**: the host can commit a half-turn (CORR-2) and a client restoring a duck-phase snapshot crashes on `placeDuck` (CORR-3). *(Both fixed 2026-06-11 — atomic probe-clone apply + guarded annotation.)*
5. **Connection status has no terminal error state** (CORR-8): `'error'` is rendered by the panel but never produced — failures present as an infinite "Reconnecting…". *(Fixed 2026-06-11 — terminal error after 6 attempts + Resync reconnect.)*

## Detailed Findings

Severity: P0 critical · P1 high · P2 medium · P3 low. Confidence/verdict from the evaluation pass; "DA" = Devil's-Advocate verified against external sources.

### Correctness

*(merged from /review-correctness and /peer-review-code; deduplicated)*

| # | Sev | Location | Finding | Confidence / Verdict |
|---|---|---|---|---|
| CORR-1 | **P0** | `src/online/useOnlineGame.js:281-287`, `:134`, `:165` | **Joiner-ahead-of-host deadlock.** `newGame()` never resets `seqRef`; `adoptSnapshot` drops any `seq <=` own; `onRequestSnapshot`/known-player corrections re-broadcast **without bumping seq**. Once the joiner's seq ≥ host's (host on new device/cleared storage, multi-tab stomp, correction race) every snapshot — including Resync — is silently dropped, permanently. Fix class: add an `epoch`/game-instance id beside `seq` (adopt on higher epoch regardless of seq) or always bump on resync/corrections. | High / **Accept** (code-verified twice) → **Fixed 2026-06-11**: epoch protocol — `mintEpoch` on create/`newGame`/fresh-host, epoch-aware adopt guard, 3 regression tests |
| CORR-2 | P1 | `src/online/useOnlineGame.js:104-129` | **Non-atomic intent apply strands a half-turn.** Host applies the joiner's piece move, then if `placeDuck` fails (square now occupied on the host's newer board) it broadcasts a mid-turn duck-phase state. The joiner's retry then carries `pieceMove: null`, which `applyIntent` drops at the `!intent?.pieceMove` guard — the game wedges in duck phase. Fix: snapshot state before applying and restore on partial failure so the host never commits a half-turn. | High / **Accept** → **Fixed 2026-06-11**: probe-clone validation then replay (history-preserving variant of the suggested fix) |
| CORR-3 | P1 | `src/engine/duck/duckChess.js:148-154` | **`placeDuck` crashes on a deserialized mid-turn state.** `createDuckGame(serialized)` rebuilds with `turns: []`, but the wire format legitimately encodes `phase=duck`; `turns[turns.length-1].duck = …` throws TypeError. Reachable by refreshing mid-turn (restore from localStorage) or adopting a mid-turn snapshot (see CORR-2). Empirically verified. Fix: guard the history write or push a synthetic turn entry. | High / **Accept** → **Fixed 2026-06-11**: guarded annotation (synthetic entry rejected — it would break `lastMoveOf`) |
| CORR-4 | P1 | `src/online/localSnapshot.js:14,42-57` | **Same-browser multi-tab identity/storage collision.** `selfId` is one global key; host config + snapshot are keyed by game id only. Opening your own invite link in a second tab loads the *host* config (second host, same id); presence collapses to one entry; snapshots stomp each other. This sabotages the standard two-tabs local test and is a prime suspect for perceived join unreliability. Fix: per-tab identity (sessionStorage) + role-aware storage keys; surface "this game is open in another tab". | High / **Accept** → **Fixed 2026-06-11**: sessionStorage selfId; presence-following seats make the id migration self-healing; `hostPresent` flag renders the duplicate-host notice |
| CORR-5 | P1 | `src/online/useOnlineGame.js:69,180-204` | **Stale-synced joiner with absent host.** `synced` initializes true from any persisted snapshot; `canMovePiece` never consults `peerPresent`/freshness, so a returning joiner can move on a dead board and retry an intent forever with no "waiting for host" signal. Fix: require a live snapshot this session (or host presence) before enabling moves. | High / **Accept** → **Fixed 2026-06-11**: `liveSynced` gate + persistent polling while storage-restored; "Waiting for host…" shown |
| CORR-6 | P2 | `src/online/useOnlineGame.js:113-119,134` | **No-bump corrections are unreceivable.** The host's "catch up" re-publish for a known player keeps the same seq, which the joiner (who already has that seq) drops — a joiner sitting on a wrong optimistic board isn't corrected until an unrelated seq-bumping event. Same root as CORR-1. | High / **Accept** → **Fixed 2026-06-11**: `request-snapshot` carries the requester's (epoch, seq); the host epoch-heals a strictly-ahead requester and answers routine polls without bumping |
| CORR-7 | P2 | `src/online/useOnlineGame.js:112` | **Seat-claim race (trust-on-first-move).** The first id to move on an unclaimed color owns it silently; with double-joins or regenerated ids the true opponent is locked out with no feedback. Acceptable for invite-link trust model, but should surface "seat taken" and ideally bind seats to presence identity. | Medium / **Accept** → **Fixed 2026-06-11**: `seatTaken` spectator mode (self-healing) + seats follow presence (absent claimant may be re-seated; host seat immovable) |
| CORR-8 | P2 | `src/online/useGameChannel.js:82-88` vs `src/components/OnlineGamePanel.jsx:25-26` | **Dead `'error'` status.** The panel renders "Connection lost — try Resync" for status `'error'`, but the channel only ever emits connecting/unconfigured/connected/reconnecting — failures present as an endless "Reconnecting…". Fix: emit a terminal `'error'` after N backoff failures (and share the status union). | High / **Accept** (3 agents) → **Fixed 2026-06-11**: terminal after 6 attempts; Resync → `reconnect()` |
| CORR-9 | P2 | `src/online/useGameChannel.js:85-88` | `peerPresent` hard-resets to false on every transient channel error → presence flapping during blips; treat as unknown/debounce instead. | Medium / **Accept** → **Fixed 2026-06-11**: presence held through transient drops; cleared only on terminal error |
| CORR-10 | P2 | `src/online/useGameChannel.js:44-91` | Reconnect edge: superseded channel's late subscribe-callback can double-schedule reconnects; a pending reconnect timer isn't cancelled on a successful re-subscribe. Currently absorbed by guards in most orderings; make supersession explicit (per-attempt token). | Medium / **Accept** → **Fixed 2026-06-11**: channelRef nulled pre-teardown, subscribe guard ignores replaced channels, pending timer cancelled on SUBSCRIBED |
| CORR-11 | P1 | `src/engine/useStockfish.js:57-76`, `src/engine/stockfishClient.js:109-120` | **Spurious "The chess engine was stopped." banner.** Intentional `interrupt()` (new game/resign/take-back while thinking) rejects the in-flight promise and `requestMove` unconditionally `setError`s it; the false failure banner persists. Fix: sentinel-flag intentional disposal; don't surface it as an error. | High / **Accept** |
| CORR-12 | P2 | `src/engine/useStockfish.js:57-63`, `stockfishClient.js:43-52` | `interrupt()` no-ops during the engine init handshake (`isBusy()` false), so resign/take-back during warm-up can leave a stale think running / status wedged. Dispose unconditionally when an engine exists. | Medium / **Accept** |
| CORR-13 | P2 | `src/engine/stockfishClient.js:54-61,90-101` | `lastScore` is reset only at search start and parsed outside search windows — a stale evaluation can attach to the wrong move in edge orderings. Scope score capture to the pending search. | Medium / **Accept** |
| CORR-14 | P2 | `src/lesson/useChessLesson.js:231` (also `:205`) | **Tap-to-move cannot underpromote** — hardcoded `promotion: 'q'` with no picker on the tap path; an underpromotion solution step soft-locks for tap users. Verified reachable. | High / **Accept** |
| CORR-15 | P2 | `src/lesson/useChessLesson.js:169-175`, `src/lesson/engine.js:68-72` | **Accepted alternative can freeze a line step**: mainline-derived opponent reply may be illegal after an accepted alternative; the throw is swallowed and the step sticks in `playing-opponent` forever. Recompute replies against the live position or recover to complete/awaiting. | High / **Accept** |
| CORR-16 | P2 | `src/routes/OnlinePlayPage.jsx:24`; `src/routes/OnlineLobbyPage.jsx:29` | **Malformed invite link silently defaults host color to white** (both players can end up "black"); links carry no joiner-seat notion for double-join disambiguation. Treat missing/invalid `?host` as a broken-link state; consider encoding the joiner seat. | High / **Accept** |
| CORR-17 | P2 | `src/components/ChatBox.jsx:13-15` | Chat autoscroll uses `scrollIntoView`, which scrolls **all** ancestors including the page — incoming messages can yank the viewport off the board. DA-confirmed (MDN). Fix: scroll the chat container (`scrollTop = scrollHeight`) or `container:'nearest'`. | High / **Accept** (DA: MDN) |
| CORR-18 | P2 | `src/components/StylizedKingScene.jsx:78`; no ErrorBoundary in `src/` | Unguarded `new THREE.WebGLRenderer` with no error boundary anywhere — WebGL-less browsers get a blank landing page instead of a degraded one. Wrap in try/catch + add an app-level ErrorBoundary. | High / **Accept** |
| CORR-19 | P3 | various | Minor accepted items: `mate 0` copy (`EnginePanel.jsx:58-66`); reduced-motion still runs a perpetual RAF render loop (`StylizedKingScene.jsx:128-136`); non-lazy `loadSnapshot` in `useState` (`useOnlineGame.js:69`); chat key collision within 1 ms (`useOnlineGame.js:300`); ChatBox submits empty text (guarded only by consumer); GlossaryLink un-cleared blur timer; FreePlay accepts unplayable-but-parseable FENs; guided take-back double-undo inconsistency (`useEngineGame.js:310-327`); `gameRef` null-guards; promotion-optimism flicker (joiner drag-promote shows queen until snapshot); `request-snapshot` over-firing on dependency changes; unguarded `JSON.stringify` in `saveSnapshot`; `__proto__` key hardening in `storage.js listProgress` (use `Object.create(null)`); untrimmed imported profile names; effectively-dead `next === current` guard in `ProfileContext`; vestigial `hintsUsed` field; `[[term|]]` renders empty glossary link; `registry.js` glossary `body.entries` unguarded; deploy workflow `cancel-in-progress: true` can cancel a mid-publish Pages deploy (DA-confirmed: starter workflow uses `false`) — **fixed 2026-06-11**; `validate-content.mjs` missing scenario `playerSide` side-to-move check; local OCR tool issues (`split_chapters.mjs`: empty-dir `-Infinity`, 3-digit page regex, nominal page ranges) — local-only, gitignored. | Accept (P3) |

### Security

*(from /review-security; calibrated to the threat model: no money/PII/credentials; impact ceiling = griefing/DoS of an ephemeral game session. XSS posture verified clean: no `dangerouslySetInnerHTML`/`innerHTML`/`eval` anywhere; all peer data renders through React auto-escaping; profile import properly sanitized.)*

| # | Sev | Location | Finding | Verdict |
|---|---|---|---|---|
| SEC-1 | P2 | `src/online/rules.js:21` via `useOnlineGame.js:138,51-64` | **Unguarded `new Chess(fen)` on adopted snapshots** — chess.js throws on malformed FEN; any peer who knows the game id can crash the joiner with one high-seq garbage snapshot. Wrap variant-game construction in try/catch and drop bad snapshots. | Accept (High) → **Fixed 2026-06-11** (validated-before-commit adoption; guarded lazy init) |
| SEC-2 | P2 | `src/online/useOnlineGame.js:124` → `src/engine/duck/board.js:20-24` | **Non-string `duckSquare` crashes the host** — truthy non-strings (`42`, `{}`) pass the falsy guard and hit `charCodeAt` → TypeError inside the broadcast handler. Type-guard intent fields. | Accept (High) → **Fixed 2026-06-11** (`isSquare` shape gate ahead of seat-claim + engine) |
| SEC-3 | P2 | `src/engine/duck/board.js:122-135` | **`deserialize` trusts the wire completely** — non-string input throws; garbage yields `undefined` turn/phase and NaN clocks that silently corrupt and re-serialize as `"undefined"`. Validate shape/fields; reject malformed snapshots. | Accept (High) → **Fixed 2026-06-11** (full field validation, throws; callers catch) |
| SEC-4 | P2 | `src/engine/duck/board.js:52-64` | `parsePlacement` writes past index 63 on over-full input (65+ cell boards that don't round-trip). Bound the index; require exactly 64 squares. | Accept (High) → **Fixed 2026-06-11** (+ piece-letter allow-list, rank boundaries, ≤1 king/side) |
| SEC-5 | P3 | `src/engine/duck/board.js:20-24`, `duckChess.js:148-151` | Off-board square strings can alias into range (`"z9"` → index 17): duck "teleports" to squares the generator never offered. Validate `[a-h][1-8]` and/or check membership in `legalDuckTargets`. | Accept → **Fixed 2026-06-11** (both: `squareToIndex` → -1 on non-squares; `placeDuck` uses target membership) |
| SEC-6 | P3 | `src/online/useOnlineGame.js:148-150` | Chat accepts unbounded message count/length from the wire (UI `maxLength` only constrains the local input). Cap/truncate on receive. | Accept |
| SEC-7 | P3 | `src/online/useOnlineGame.js:132-144`; `duckChess.js:22-26` | Adopted `players`/`variant` shape unvalidated; result derived from king-glyph presence lets a crafted snapshot flash a bogus "King captured". Defense-in-depth shape checks. | Accept → **Fixed 2026-06-11** (variant match, non-empty string state — `''` would silently reset a standard board, players normalization, ≤1 king/side) |
| SEC-8 | P2 | `.github/workflows/ci.yml` | **No `permissions` block** — CI inherits default token scope while running `npm ci` (lifecycle scripts) on PRs. Add `permissions: { contents: read }` (deploy.yml already does least-privilege). | Accept (High) → **Fixed 2026-06-11** |
| SEC-9 | P2 | both workflows | Actions pinned to **mutable major tags** (`@v4`/`@v3`) not commit SHAs — tag repointing runs attacker code with `id-token: write` + secrets in deploy. Pin SHAs + Dependabot. (Threat model's top-rated surface.) | Accept (Medium) → **Fixed 2026-06-11** (SHA pins + dependabot.yml) |
| SEC-10 | P2 | `index.html`, `vercel.json` | **No CSP or security headers on either deploy target** (no `frame-ancestors`, no `X-Content-Type-Options`). Add a CSP meta (GH Pages) + `headers` in `vercel.json`, allow-listing Supabase WSS + Google Fonts; pairs with the planned richer chat. | Accept (High) |
| SEC-11 | P3 | `deploy.yml:37-41`; repo root | Secrets echoed via `${{ }}` into the script (use `env:` indirection + `printf`); no `.npmrc` registry pinning. Hardening only. | Accept |
| SEC-12 | P3 | `index.html:7-9,14-28` | Google Fonts un-CSP'd (SRI impractical for that endpoint — constrain via CSP or self-host); 404-redirect restore path verified History-API-only (safe), keep it that way under CSP (hash/nonce the inline script). | Accept |
| SEC-13 | — | `src/profile/`, `src/components/`, `src/routes/` | **Explicitly clean**: profile import (fresh UUID, allow-listed avatar, fixed-key sanitize — no prototype pollution), chat/board/markdown rendering (React-escaped throughout), route param handling (allow-list normalized), game-id entropy (122 bits). | No findings |

### API Usage

| # | Sev | Location | Finding | Verdict |
|---|---|---|---|---|
| API-1 | P2 | `.github/workflows/{ci,deploy}.yml` | **v4 actions run on the Node 20 runtime; GitHub flips runners to Node 24 by default on 2026-06-16 (six days from this report) and removes Node 20 on 2026-09-16.** Bump `checkout@v5`, `setup-node@v5`, `deploy-pages@v5` (`upload-pages-artifact@v3` is current). | Accept — **DA-confirmed** (github.blog changelog 2025-09-19) → **Fixed 2026-06-11** (v5 + SHA-pinned) |
| API-2 | P2 | `src/lib/supabase.js:18` | `realtime.params.eventsPerSecond` is dead in realtime-js 2.106 (zero references in the installed package) — there is no client-side rate cap despite the comment. Remove it or configure server-side. | Accept — **DA-confirmed** (grep of installed source) |
| API-3 | P3 | `src/online/useGameChannel.js:62,107-109` | `broadcast.ack: true` is inert — `send()`'s promise is discarded, so the requested server ack round-trip buys nothing. Drop `ack` (seq/resync layer provides reliability) or consume the promise. | Accept |
| API-4 | P3 | `src/online/useGameChannel.js:44-58,85-89` | `removeChannel` fires the old channel's `CLOSED` into the same subscribe callback → benign-but-implicit redundant reconnect path (absorbed by the timer guard). Make teardown ignore superseded channels (same fix as CORR-10). | Accept → **Fixed 2026-06-11** (with CORR-10) |
| API-5 | P2 | `src/profile/ProfileContext.jsx:50,114` | Unguarded `crypto.randomUUID()` — secure-contexts only (undefined on plain-HTTP LAN hosts); `localSnapshot.js:34` already has the guarded pattern. Extract a shared `genId()`. | Accept — **DA-confirmed** (MDN) |
| API-6 | P2 | `src/profile/ProfileContext.jsx:25,41,63` | Raw `localStorage` access (no try/catch) crashes the provider when storage is blocked — defeating the graceful-degradation design `storage.js`/`localSnapshot.js` follow. Use a shared safe-storage helper. | Accept (High) |
| API-7 | P3 | `src/profile/storage.js:49-58`; `ProfileContext.jsx:86` | IDB `listProgress` issues a second request after an `await` on the same transaction (fragile vs auto-commit; queue both first), and fire-and-forget `putProgress` can surface unhandled rejections (attach `.catch`). | Accept |
| API-8 | P3 | `src/routes/OnlinePlayPage.jsx:20-27` | `useMemo` keyed on `searchParams` object identity (not stable in router v6) — harmless recompute; depend on the primitive values. Everything else verified correct: react-chessboard 4.7.3 props, three r184, chess.js v1 semantics (throwing move/constructor handled), classic-worker Stockfish + UCI, Vite 5 glob, jest-dom v6 path, StrictMode safety. | Accept |

### Code Quality

| # | Sev | Location | Finding | Verdict |
|---|---|---|---|---|
| QUAL-1 | P1 | `src/online/rules.js:59`; `OnlinePlayPage.jsx:23`; `OnlineLobbyPage.jsx:13`; `OnlineGamePanel.jsx:11` | **Variant identity is a hardcoded two-way ternary in 4+ sites** (unknown variants silently become standard). A `VARIANTS` registry (`{ id: { label, create } }`) turns "duck chess decay" into one entry + an engine, instead of a shotgun edit. **Do this before the new variant.** | Accept (High) |
| QUAL-2 | P2 | `src/engine/duck/board.js:108-135` | **Positional 8-field serializer has no extension slot** for per-square decay counters/repair clocks. Decide the wire-format evolution now (delimited optional trailing segment, or JSON state object) — retrofitting after variant 3 means migrating persisted snapshots. | Accept (High, planning) |
| QUAL-3 | P2 | `duckChess.js:33-49` vs `gameState.js:20` | Two divergent captured-pieces implementations (board-diff vs history-replay; duck's miscounts after promotion — acknowledged in-code). Promote the snapshot-safe board-diff version to shared; consider history-based capture tracking when adding decay (it needs per-square history anyway). | Accept (Medium) |
| QUAL-4 | P1 | `useChessLesson.js` / `useEngineGame.js` / `useOnlineGame.js` | **Board-input handlers copy-pasted across all three controller hooks** (`onPieceDrop`/`onPromotionPieceSelect`/tap state machine, ~40 lines × 3); plus duplicated `Feedback` (already render-divergent), duplicated `pairMoves`, near-identical move-list `<ol>`. Extract `useBoardInput` + shared panel parts — fixes (e.g. the underpromotion bug) then land everywhere once. | Accept (High) |
| QUAL-5 | P2 | `OnlineLobbyPage.jsx:45-53` vs `OnlinePlayPage.jsx:29-42`; `ui/SectionHeader.jsx`; `ArenaPage.jsx:12-38` vs `TrainingPage.jsx:79-108` | Diverged duplicate "online not configured" notices; `SectionHeader` exists but is unused while ≥5 pages hand-roll the same header (drifted widths); `ScenarioCard`/`LessonCard` are the same card twice. Extract before lobby work multiplies the copies. | Accept (Medium) |
| QUAL-6 | P3 | various | `COLOR_NAME` map ×4 files; index↔square math inlined ×7 (decay's per-square counters will copy it again — centralize first); `START_FEN` re-hardcoded in `useChessLesson`; `DEFAULT_WRONG` strings drifting; controller status enums undocumented/disjoint; stale `SegmentedControl` comment; `getGlossaryIndex`/`listGlossaryEntries` duplicated gather; chat concern inlined in `useOnlineGame` — extract `useGameChat` before chat features (transport/view seams already clean). | Accept |
| QUAL-7 | P2 | workflows, `package.json`, `vercel.json`, `404.html` | CI/deploy bootstrap duplicated; Node version specified three ways (workflows 20, README "18+/dev on 22", no `engines`/`.nvmrc`); dual GH-Pages/Vercel deploy with divergent SPA-routing + undocumented Vercel env/base-path expectations. Pin one Node story; document or drop the second target. | Accept (Medium) |

### Test Coverage

*(gap severities; the suite that exists is green — 124 tests — and the pure logic core is well covered)*

| # | Sev | Gap |
|---|---|---|
| TEST-1 | P0 | `useGameChannel` reconnect/error/backoff machine — the fake channel only ever resolves SUBSCRIBED; the entire failure path (status flips, backoff cap, attempt reset, cancelled guard) is unexercised. The heart of the join-reliability concern. → **Covered 2026-06-11** (4 tests incl. terminal error + recovery) |
| TEST-2 | P0 | `applyIntent` seat-claim + stray-third-party rejection (the access-control logic of the public channel) — including illegal-move → corrective-resync paths. → **Covered 2026-06-11** (5 tests: stray-id, reseat-on-absence, host-seat immovable, spectator, read-only restore; corrective-resync covered by the Bite C test) |
| TEST-3 | P1 | `localSnapshot.js` — zero coverage for the identity/persistence module that backs reload-resume and seat locking (incl. corrupt-JSON and storage-throw branches). |
| TEST-4 | P1 | Joiner resync cadence (fast→slow polling, no-poll-on-own-turn) and host `onPeerJoin`/`onRequestSnapshot` re-broadcasts — the timers that prevent handshake deadlock. |
| TEST-5 | P1 | Connection-degraded gates: `canMovePiece` false when reconnecting/unsynced; host-only `newGame`; `resync` role behavior. The user-facing payoff of the robustness design has no assertion. |
| TEST-6 | P1 | Duck-chess castling execution + castling-rights updates (incl. captured corner rook) — untested ahead of variant work. |
| TEST-7 | P2-P3 | `deriveCaptured`/SAN labels; `ProfileContext` import/export glue; `ChatBox` component; lobby/play config derivation (`isHost`, `selfColor`, invite URL); `statusText` table test; `pairMoves`/`resultText`; plus regression tests encoding CORR-1/2/3 (the protocol bugs above) once fixed. |

### Dependencies

*(npm audit: 13 advisories — 1 critical, 7 high, 5 moderate; npm outdated: 20 direct. Most advisories live in dev/build tooling and are unreachable from the deployed static site.)*

| # | Sev | Package | Finding | Verdict |
|---|---|---|---|---|
| DEP-1 | P1 | `vitest` 1.6.1 | GHSA-5xrq-8626-4rwp (CVSS 9.8, fixed 3.2.6): arbitrary file read/RCE via the UI/API server. **DA correction:** exploitable when `api.host` exposes the server **or on Windows even via localhost** — broader than "must run --ui", though still a dev-workstation risk, not a deployed-site risk (downgraded from registry-critical accordingly). Upgrade vitest (major). | Accept — DA-corrected |
| DEP-2 | P2 | `react-router-dom` 6.30.2 | Two advisories, **DA-corrected mapping**: GHSA-2j2x-hqr9-3h42 (protocol-relative open redirect) affects 6.7.0–<6.30.4, patched **6.30.4**; GHSA-2w69-qvjg-hvjx (XSS via open redirect) lives in transitive `@remix-run/router` ≤1.23.1, patched **1.23.2** — both clear via in-range bumps, no v7 migration needed. Practical exploitability low: routes audit verified no user-derived redirect targets. | Accept — DA-corrected → **Fixed 2026-06-11** (6.30.4; `@remix-run/router` 1.23.3) |
| DEP-3 | P2 | `vite` 5.4.21 / `esbuild` ≤0.24.2 | Dev-server advisories (GHSA-4w7w-66w2-5vf9 path traversal; GHSA-67mh-4wv8-2f99 request leak) — dev-only; audit's offered fix is the major jump to vite 8, which also clears the vitest/vite-node chain. Plan the major. | Accept |
| DEP-4 | P3 | `postcss` 8.5.6→8.5.15; `rollup`; `flatted`; `minimatch`; `picomatch`; `brace-expansion` | Build/lint-chain advisories, all with in-range fixes; not on any runtime path. One `npm audit fix` (no `--force`) sweep. | Accept → **Fixed 2026-06-11** (advisories 13 → 4; remainder = vite/vitest majors, Bite L) |
| DEP-5 | P2 | majors | Staleness: React 18→19, react-chessboard 4→5 (rewrite), Tailwind 3→4, ESLint 8 (EOL)→9/10 flat-config, jsdom 24→29, lucide 0.344→1.x, @vitejs/plugin-react 4→6. None urgent; sequence after the robustness work. `@supabase/supabase-js` minor catch-up is trivial. | Accept (advisory) |

### Tooling

| # | Sev | Finding |
|---|---|---|
| TOOL-1 | P2 | No formatter (Prettier/Biome) and no `.editorconfig` for a contributions-welcoming repo. |
| TOOL-2 | P2 | No pre-commit hooks (husky + lint-staged) — lint/test only run in CI. |
| TOOL-3 | P2 | `eslint .` neither fails on warnings (`--max-warnings=0`) **nor lints `.mjs`/`.cjs` at all** (ESLint 8 default ext) — the CI-executed build scripts and the ESLint config itself are unlinted (verified via `--debug`). Add `--ext .js,.jsx,.mjs,.cjs` or move to flat config. → **Fixed 2026-06-11** (strict script; `.jsx` was also uncovered — CI now lints the React code; 4 latent errors fixed) |
| TOOL-4 | P3 | No coverage reporting (`@vitest/coverage-v8` + thresholds) — pairs with the Test Coverage column above. |
| TOOL-5 | P3 | Optional: `jsconfig.json` + `checkJs` (types stubs already installed) for static safety on the protocol code. |

### Dead Code

*(verified production-wide; suite green at 124 tests. The Arena-first routing pivot orphaned the entire study-content layer.)*

| # | Sev | Finding |
|---|---|---|
| DEAD-1 | P2 | **Orphaned route cluster (~982 lines / 11 files):** `HomePage`, `GlossaryPage`, `LessonPage`, `MySystemPage`, `TrainingPage`, `PickProfile`, `LessonView`, `StepPanel`, `GlossaryLink`, `ui/SectionHeader`, `content/mySystem.js` — all unreachable (App.jsx redirects `/training`, `/lesson/*`, `/my-system`, `/glossary` to `/`). **Decision needed: delete or re-route.** Note `GlossaryPage`/`LessonPage`/`TrainingPage` represent real content features (the lesson engine itself is alive only via `ScenarioPage`); also the `/glossary → /#make-your-own` redirect targets an anchor that doesn't exist in `ArenaPage`. Removal order if deleting: leaves → `StepPanel` → `LessonView` → routes → then newly-orphaned registry/progress/lesson exports (`getGlossaryIndex`, `listGlossaryEntries`, `listTracks`, `withStepComplete`, `useChessLesson`, `AVATARS` export). |
| DEAD-2 | P2/P3 | Test-only exports: `registry.listByKind`, `glossaryLinks.findTermLinks`, `board.indexToSquare`; dead `flattenMySystemChapters`; unused dep flags from knip (`tailwind-merge`, `@testing-library/user-event`) worth confirming. |
| DEAD-3 | P3 | Dead `'error'` status branch (see CORR-8 — fix forward, don't delete); `hintsUsed` vestige (CORR-19). |

### Threat Model

**Present** — generated this audit at `.turbo/threat-model.md`. Top threats: (1) supply-chain/deploy compromise (High) — addressed by SEC-8/9/11; (2) host-authority spoofing on public channels (Medium, accepted-by-design for invite-link trust; hardened by SEC-1/2/3/7); (3) untrusted state deserialization (Low-Med) — addressed by SEC-1–5. Notable: the model documents that the shipped code intentionally diverges from the parked docs spec (no Auth/Postgres/RLS). XSS posture verified clean across all rendering paths.

## Devil's-Advocate disputes (surfaced per evaluation rules)

- **DEP-1 (vitest):** original framing said exploitation "requires running `--ui`"; the advisory actually triggers on network-exposed `api.host` **or Windows localhost**. Verdict kept Accept; precondition corrected; severity calibrated P1 (dev tooling) rather than registry-critical for this static app.
- **DEP-2 (react-router):** original claim said both advisories are patched by react-router 6.30.4; actually only the open-redirect one is — the XSS advisory is in transitive `@remix-run/router` (patched 1.23.2). Both still resolve with in-range bumps; verdict Accept with corrected remediation.

## Recommended sequence (not applied — audit is analysis-only)

1. **Protocol epoch + wire-input guards** (CORR-1/2/3/6, SEC-1/2/3) — fixes "unreliable joins" at the root; prerequisite for a lobby.
2. **Identity & presence** (CORR-4/5/7/8/9) — per-tab identity, host-presence gating, terminal error state. This *is* the waiting-room groundwork.
3. **Quick CI/security batch** (API-1 before 2026-06-16; SEC-8/9/10; TOOL-3; DEP-2/4 bumps; deploy `cancel-in-progress: false`).
4. **Dead-code decision** (DEAD-1): delete or revive the study-content routes.
5. **Refactor seams for the roadmap** (QUAL-1/2/4 + extract `useGameChat`) — variant registry and serializer evolution **before** building duck-chess decay; shared board-input before chat/lobby UI work.
6. **Tests that lock it in** (TEST-1/2/3 + regression tests for the protocol fixes).
