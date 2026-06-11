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
| A | CI quick wins (⏰ before 2026-06-16) | ☐ not started |
| B | Protocol epoch — the P0 join deadlock | ☐ not started |
| C | Atomic turn apply + mid-turn safety | ☐ not started |
| D | Wire-input guards (peer payload hardening) | ☐ not started |
| E | Identity & presence (lobby groundwork) | ☐ not started |
| F | Engine UX (false error banner, interrupt) | ☐ not started |
| G | Lesson fixes (underpromotion, frozen step) | ☐ not started |
| H | UX & app hardening (chat, WebGL, CSP, links) | ☐ not started |
| I | Dead-code decision (~982 orphaned lines) | ☐ not started |
| J | Roadmap seams (variant registry, serializer v2, shared hooks) | ☐ not started |
| K | Test hardening | ☐ not started |
| L | Dependency majors (vitest/vite/React etc.) | ☐ not started |

Suggested order: **A → B → C → D → E** (join reliability fixed end-to-end), then F–H in any order,
I whenever, **J before starting lobby/chat/duck-decay features**, K alongside everything, L last.

---

## Bite A — CI quick wins ⏰ (API-1, SEC-8, TOOL-3, DEP-2, DEP-4, CORR-19g)

Deadline-driven: GitHub runners default to Node 24 on **2026-06-16**; v4 actions run on the deprecated Node 20 runtime.

- [ ] Bump `actions/checkout@v4 → v5` and `actions/setup-node@v4 → v5` in `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`; bump `actions/deploy-pages@v4 → v5` in deploy.yml (`upload-pages-artifact@v3` is current — leave it). [API-1]
- [ ] Add to `ci.yml` top level: `permissions:\n  contents: read`. [SEC-8]
- [ ] deploy.yml: change `cancel-in-progress: true → false` (matches GitHub's Pages starter; never cancels a mid-publish deploy). [CORR-19]
- [ ] package.json lint script → `eslint . --ext .js,.jsx,.mjs,.cjs --max-warnings=0`; fix whatever it now reports in `scripts/*.mjs` (previously never linted). [TOOL-3]
- [ ] `npm install react-router-dom@^6.30.4` (clears both router advisories via the transitive `@remix-run/router` ≥1.23.2), then `npm audit fix` (NO `--force`) for the in-range transitive sweep (postcss, rollup, minimatch, picomatch, brace-expansion, flatted). Verify `npm audit` afterwards; remaining advisories should be only the vite/vitest majors (Bite L). [DEP-2, DEP-4]
- [ ] Optional hardening while in the files: pin actions to commit SHAs with `# vX.Y.Z` comments + add Dependabot `github-actions` config. [SEC-9]
- [ ] Verify: push a branch, CI green; deploy workflow green on main.

**Landed:** _(commit)_

## Bite B — Protocol epoch: fix the P0 join deadlock (CORR-1, CORR-6)

Root cause: `seq` is the only reconciliation primitive; resyncs/corrections don't bump it, so a joiner
whose `seq` ≥ host's drops everything forever. Files: `src/online/useOnlineGame.js`, `src/online/localSnapshot.js`.

- [ ] Add `epoch` to the snapshot shape (`buildSnapshot`): host mints `epoch: 1` on first creation; **`newGame()` increments `epoch` and resets `seqRef.current = 1`**.
- [ ] Persist epoch with the snapshot (already automatic once it's in the snapshot object) and restore it in the lazy init alongside seq.
- [ ] `adoptSnapshot`: adopt when `snapshot.epoch > epochRef.current`, or `epoch === epochRef.current && seq > seqRef.current`. On epoch adoption, clear `pendingIntentRef` and selection state.
- [ ] Make corrections receivable: in `applyIntent`'s known-player resend path and in `onRequestSnapshot`, call `broadcastAuthoritative(true)` (bump) instead of `(false)` — or keep `(false)` everywhere and rely on epoch + a `force` flag the joiner always adopts. Pick one; document it in the useOnlineGame header comment.
- [ ] Host with no persisted state for an existing gameId (new device / cleared storage) should mint `epoch: Date.now()`-style or `prevEpoch+1` — it can't know prevEpoch, so use a random 32-bit epoch on fresh host init to guarantee joiners adopt (document: epochs compare by inequality, adopt on *different + newer-seq-within*, simplest: joiner adopts any snapshot whose epoch ≠ its own).
- [ ] Regression tests in `useOnlineGame.test.jsx`: (a) after a completed game, host `newGame()` → joiner adopts the fresh board; (b) joiner with seq 40 + host restarting at seq 1 → joiner heals on first snapshot; (c) the existing "ignores stale ones" test updated for epoch semantics (it currently encodes the bug as intended behavior).
- [ ] Verify: two browsers (not two tabs — see Bite E), play, host hard-reloads with DevTools → Application → Clear storage, then "New game" — joiner must follow.

**Landed:** _(commit)_

## Bite C — Atomic turn apply + mid-turn safety (CORR-2, CORR-3)

Files: `src/online/useOnlineGame.js` (`applyIntent`), `src/engine/duck/duckChess.js` (`placeDuck`).

- [ ] `applyIntent`: capture `const before = game.serialize()` before `movePiece`; if the piece move or the required duck placement fails, rebuild from `before` (`gameRef.current = createVariantGame(variant, before)`) and broadcast the *unchanged* state — the host must never commit a half-turn.
- [ ] Don't bump `seq` for that no-op corrective broadcast unless Bite B chose bump-on-everything; stay consistent with B's decision.
- [ ] `placeDuck` in duckChess.js: guard the history write — `if (turns.length) turns[turns.length - 1].duck = square; else turns.push({ san: null, duck: square })` — so a state deserialized mid-turn (refresh between piece move and duck placement) works.
- [ ] Tests: (a) intent whose duck square is occupied on the host board → host state unchanged, broadcast sent, joiner converges; (b) `createDuckGame('<mid-turn duck-phase wire string>').placeDuck('e3')` does not throw and completes the turn.

**Landed:** _(commit)_

## Bite D — Wire-input guards (SEC-1, SEC-2, SEC-3, SEC-4, SEC-5, SEC-7)

Anyone with the game id can broadcast; one malformed payload must never crash a client.
Files: `src/online/useOnlineGame.js`, `src/online/rules.js`, `src/engine/duck/board.js`, `src/engine/duck/duckChess.js`.

- [ ] Wrap every `createVariantGame(...)` from wire/storage data (adoptSnapshot, lazy init) in try/catch → on failure ignore the snapshot (and for storage, fall back to a fresh game). [SEC-1]
- [ ] Top of `applyIntent`: validate shape — `pieceMove.from/to` are strings matching `/^[a-h][1-8]$/`, `promotion` ∈ {q,r,b,n,undefined}, `duckSquare` absent or a valid square string. Reject silently otherwise. [SEC-2]
- [ ] `board.js deserialize`: require string input, exactly 8 fields, `turn` ∈ {w,b}, `phase` ∈ {piece,duck}, finite ints for clocks, placement parses to exactly 64 cells → else `throw` (callers now catch per SEC-1). [SEC-3]
- [ ] `parsePlacement`: stop/throw when index ≥ 64 (or count > 64 squares). [SEC-4]
- [ ] `squareToIndex`: return -1 for non-`[a-h][1-8]` input; `placeDuck` additionally checks the square is in `legalDuckTargets(state)`. [SEC-5]
- [ ] `adoptSnapshot`: sanity-check `snapshot.players` is a plain object and `snapshot.variant` matches the local variant before adopting; validate exactly one king per side or derive result defensively. [SEC-7]
- [ ] Tests: fuzz-ish table test feeding garbage snapshots/intents (numbers, objects, truncated strings, 65-square placements, `"z9"`) — assert no throw and state unchanged.

**Landed:** _(commit)_

## Bite E — Identity & presence: lobby groundwork (CORR-4, CORR-5, CORR-7, CORR-8, CORR-9, CORR-10/API-4)

Files: `src/online/localSnapshot.js`, `src/online/useGameChannel.js`, `src/online/useOnlineGame.js`, `src/components/OnlineGamePanel.jsx`.

- [ ] Per-tab identity: `selfId()` → sessionStorage first (falls back to localStorage value for continuity, then random); two tabs must be two identities. [CORR-4]
- [ ] Second-tab host detection: when `loadHostConfig` matches but another live presence already tracks `isHost`, show "This game is open in another tab" instead of silently dual-hosting. (Simplest: include `isHost` in presence meta — already tracked — and have a host that *joins* and sees an existing host downgrade to spectator/notice.) [CORR-4]
- [ ] Joiner playability gate: require a snapshot received **this session** (not just persisted) OR `peerPresent` before `canMovePiece`; render "Waiting for host…" otherwise. [CORR-5]
- [ ] Terminal error state: in `useGameChannel`, after N (e.g. 6) consecutive failed attempts set status `'error'` (stop reconnecting until Resync) — this makes OnlineGamePanel's existing "Connection lost — try Resync" branch reachable; `resync()` should reset attempts and reconnect. [CORR-8]
- [ ] Debounce `peerPresent` during reconnects (treat as unknown rather than false until the first presence sync after resubscribe). [CORR-9]
- [ ] Per-attempt channel token: ignore subscribe-callback events from superseded channels; cancel any pending reconnect timer on successful SUBSCRIBED. [CORR-10, API-4]
- [ ] Seat feedback: when an intent is ignored because the seat is claimed, host broadcasts a (new) `seat-taken` event or includes claimed seats in snapshots so the UI can say "seat already taken". [CORR-7]
- [ ] Tests: TEST-1 (reconnect machine: error states, backoff cap, attempt reset, cancelled guard) and TEST-2 (seat claim + stray-id rejection) from audit.md — these two P0 coverage gaps live exactly here.

**Landed:** _(commit)_

## Bite F — Engine UX (CORR-11, CORR-12, CORR-13, API-5/6 quick wins)

- [ ] `stockfishClient dispose()`: settle with a sentinel (`err.isInterrupt = true`); `useStockfish.requestMove` catch: don't `setError` for interrupts, and gate `setError` on `mountedRef.current`. [CORR-11]
- [ ] `interrupt()`: dispose whenever an engine exists (not only when `isBusy()`), so resign/take-back during the init handshake actually stops it. [CORR-12]
- [ ] Scope `lastScore` to the pending search (capture only while a bestmove wait is active; reset on dispatch). [CORR-13]
- [ ] Shared `genId()` util (guarded `crypto.randomUUID` — pattern already in `localSnapshot.js:32`) used by `ProfileContext`; wrap ProfileContext's three raw `localStorage` calls in the safe helpers. [API-5, API-6]

**Landed:** _(commit)_

## Bite G — Lesson fixes (CORR-14, CORR-15)

- [ ] Tap-path promotion: in `useChessLesson.onSquareClick` (and the same logic in the other hooks until Bite J unifies them), when the selected piece is a pawn reaching the last rank, open the promotion picker instead of forcing `'q'`. [CORR-14]
- [ ] Opponent reply after accepted alternatives: derive the reply against the live position (or author `opponentReplies` per alternative); when `applyMove` throws in `scheduleOpponent`, recover the step to `complete`/`awaiting` instead of silently freezing in `playing-opponent`. [CORR-15]
- [ ] Tests: drag/tap underpromotion lands the chosen piece; an accepted-alternative line never leaves the step stuck.

**Landed:** _(commit)_

## Bite H — UX & app hardening (CORR-16, CORR-17, CORR-18, SEC-6, SEC-10, CORR-19 picks)

- [ ] Invite link: treat missing/invalid `?host` as a "link looks broken — ask your friend to re-copy it" state instead of defaulting to white. [CORR-16]
- [ ] Chat autoscroll: scroll the chat container (`el.scrollTop = el.scrollHeight`), not `scrollIntoView`. [CORR-17]
- [ ] Chat receive guards: cap stored messages (e.g. last 200) and truncate `text` (e.g. 2000 chars) in `handleChat`; locally trim/disable empty send in ChatBox. [SEC-6 + CORR-19]
- [ ] App-level `ErrorBoundary` in `App.jsx`; try/catch around `new WebGLRenderer` in `StylizedKingScene` with a static fallback; single-frame render under reduced motion. [CORR-18 + CORR-19]
- [ ] CSP: `<meta http-equiv="Content-Security-Policy">` in index.html + `headers` block in vercel.json — `default-src 'self'`; `connect-src 'self' https://*.supabase.co wss://*.supabase.co`; fonts origins; `frame-ancestors 'none'`; hash/nonce the inline 404-restore script. Test online play still connects after adding it. [SEC-10]
- [ ] Small sweep from CORR-19 while nearby: lazy `useState(() => …loadSnapshot…)`; chat id uniqueness; `Object.create(null)` in `listProgress`; trim imported profile names; `body?.entries ?? []` in registry; `eventsPerSecond` removal [API-2]; drop or consume `broadcast.ack` [API-3].

**Landed:** _(commit)_

## Bite I — Dead-code decision (DEAD-1, DEAD-2)

**Decide:** delete the orphaned study-content cluster, or re-route it. (It contains real features —
Glossary, Training, Lessons pages — orphaned by the Arena-first pivot; the lesson *engine* stays alive via ScenarioPage either way.)

- [ ] If deleting — order: `SectionHeader`, `mySystem.js`, `GlossaryLink` → `StepPanel` → `LessonView` → `HomePage`/`GlossaryPage`/`LessonPage`/`MySystemPage`/`TrainingPage`/`PickProfile` → then newly-orphaned exports (`getGlossaryIndex`, `listGlossaryEntries`, `listTracks`, `withStepComplete`, `useChessLesson` hook export, `AVATARS` export, `flattenMySystemChapters`) and the `/glossary → /#make-your-own` redirect (anchor doesn't exist).
- [ ] If reviving — restore real routes in `App.jsx`, fix HomePage's stale links, add the `make-your-own` anchor, and pull these pages through the shared abstractions from Bite J.
- [ ] Either way: remove test-only exports (`listByKind`, `findTermLinks`, `indexToSquare`) or mark them deliberate; confirm/drop knip-flagged unused deps (`tailwind-merge`, `@testing-library/user-event`).

**Landed:** _(commit)_

## Bite J — Roadmap seams: do BEFORE lobby/chat/duck-decay features (QUAL-1, QUAL-2, QUAL-3, QUAL-4, QUAL-5, QUAL-6)

- [ ] **Variant registry** (`src/online/variants.js` or in rules.js): `VARIANTS = { standard: {label, sublabel, create}, duck: {...} }`; derive `createVariantGame`, lobby options, panel labels, and URL parsing from it; unknown variant in a link → explicit error, not silent standard. [QUAL-1]
- [ ] **Serializer v2 with extension slot**: append an optional 9th field (e.g. `ext=k1:v1;k2:v2` or a `|`-delimited JSON segment) that `deserialize` round-trips and `boardFen()` strips; old 8-field strings keep parsing (back-compat with persisted snapshots). Duck-decay's per-square counters/repair clocks ride here. [QUAL-2]
- [ ] Promote board-diff `deriveCaptured` (+`INITIAL_COUNTS`) into `gameState.js` as the shared snapshot-safe implementation; document the promotion-miscount tradeoff or move to move-log-derived captures (decay needs per-square history anyway). [QUAL-3]
- [ ] Extract `useBoardInput({ attemptMove, listTargets, canSelect })` shared by the three controller hooks; extract shared `Feedback` + `pairMoves`/`MoveList` into `gamePanelParts.jsx`. [QUAL-4]
- [ ] Extract `useGameChat` from `useOnlineGame` (messages state + send/receive, caps from Bite H) — the seam the chat-features work builds on. [QUAL-6]
- [ ] Shared `RealtimeNotConfigured` component; route page headers through `SectionHeader`; shared `ContentCard` for Scenario/Lesson cards (if Bite I revived them). [QUAL-5]
- [ ] Convention sweep: shared `COLOR_NAME`/`sideChar` in `lesson/moves.js`; route index math through board.js helpers; `START_FEN` import; document the controller status contract. [QUAL-6]

**Landed:** _(commit)_

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

*Generated 2026-06-10 by the audit session. If this plan and audit.md ever disagree, audit.md's finding text wins; this file's checkboxes win for "what's done".*
