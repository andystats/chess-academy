# Threat Model: Chess Academy

## 1. Overview

Chess Academy is a client-only **Vite/React single-page application** for studying chess — guided lessons, a glossary, classic strategy study, a Stockfish practice arena, local hot-seat play, and online multiplayer (standard chess + a Duck Chess variant). It is built to a static bundle (`vite build`) and deployed as a static site to **GitHub Pages** (`/.github/workflows/deploy.yml`), with a `vercel.json` SPA rewrite as an alternative target. **The application has no backend of its own**: there is no server-side code, no database the app writes to, no session store, and no server-issued credentials. The only remote dependency is **Supabase Realtime**, used purely as a message bus. Key components: routing/shell (`src/App.jsx`), local profiles persisted in IndexedDB (`src/profile/`), the Stockfish WASM engine driven in a Web Worker over the UCI text protocol (`src/engine/stockfishClient.js`, binaries in `public/engine/`), the Duck Chess rules engine (`src/engine/duck/`), and the online game stack (`src/lib/supabase.js`, `src/online/`, `src/routes/OnlineLobbyPage.jsx`, `src/routes/OnlinePlayPage.jsx`, `src/components/ChatBox.jsx`).

The defining security property is that **the online multiplayer is intentionally trust-minimal and unauthenticated**. The shipped implementation differs from the parked design in `docs/future-multiplayer-and-duck-chess.md` (which proposed Postgres + Supabase Auth + Row-Level Security + a validating Edge Function): the *actual* code uses **only Supabase Realtime Broadcast + Presence on PUBLIC channels** — no database, no Auth, no RLS, no server-side move validation. The anon key ships in the client bundle by design (`src/lib/supabase.js`), and the sole access control for a game is **knowledge of the random game id in the invite link** (`src/online/localSnapshot.js` `newGameId`). The game-creator ("host") is the authoritative state holder; joiners send move-intents and adopt host snapshots (`src/online/useOnlineGame.js`).

Security-sensitive flows:
- **Online game sync over a public channel**: any party with the project URL + a game id can subscribe, send move-intents, snapshots, and chat (`src/online/useGameChannel.js`).
- **Untrusted snapshot/move deserialization**: a joiner rebuilds its entire game state from whatever the host broadcasts; the Duck Chess `deserialize` does no validation (`src/engine/duck/board.js`).
- **Peer chat rendering** between the two players (`src/components/ChatBox.jsx`), and lesson/glossary prose rendering (`src/components/Markdown.jsx`) — the candidate XSS sinks.
- **Untrusted profile-file import** parsing user-supplied JSON (`src/profile/ProfileContext.jsx` `importProfile`).
- **Supply chain**: Stockfish WASM is vendored from an npm package at install/build time (`scripts/vendor-engine.mjs`), and the bundle ships third-party JS (react-router, react-chessboard, chess.js, Supabase SDK).

What this repo **owns**: the client UI, the lesson/profile logic, the Duck Chess engine, the realtime protocol/authority logic, and the build pipeline. What it **delegates**: rules legality for standard chess (chess.js), board rendering (react-chessboard), message transport and TLS (Supabase Realtime / browser), engine search (Stockfish WASM), and at-rest storage (browser IndexedDB/localStorage). The largest risk concentration is the **online subsystem**: it is the only attacker-reachable-over-the-network surface, it is unauthenticated by design, and it parses attacker-influenced state. Because the app holds no secrets, money, accounts, or private data, the realistic impact ceiling across the board is low — griefing a two-person game, tab-local denial of service, or annoyance — not data theft or account takeover.

## 2. Threat Model, Trust Boundaries and Assumptions

**Assets**
- **Game integrity / fairness**: the authoritative game state (FEN + duck square + turn + history) and the "only the right player moves on their turn" invariant (`src/online/useOnlineGame.js`). The crown jewel here is a fair, uninterrupted game between two friends.
- **Game-channel confidentiality (weak/by-design)**: the contents of a game session (moves, chat) are readable by anyone who learns the game id. There is no expectation of secrecy beyond the unguessability of the id.
- **Local learner data**: profile names, avatars, and per-lesson progress in IndexedDB; the active-profile pointer and per-browser online `self-id` in localStorage (`src/profile/storage.js`, `src/online/localSnapshot.js`). Low sensitivity (self-entered display names, no credentials).
- **The Supabase anon key**: present in the bundle by design (`src/lib/supabase.js`); not a secret. Value to an attacker is limited to consuming the project owner's free-tier Realtime quota.
- **Build/supply-chain integrity**: the deployed bundle and the vendored Stockfish binaries (`scripts/vendor-engine.mjs`, GitHub Actions secrets for Supabase URL/key).

**Trust boundaries**
- **Public Realtime channel (network)**: the strongest boundary. Anything arriving on `game:<id>` — snapshots, move-intents, chat, presence — is attacker-influenceable input; the channel is explicitly *not* `private`, so the anon key alone authorizes subscription (`src/online/useGameChannel.js` lines 16-18, 60-90). Everything beyond this boundary is untrusted.
- **Host authority boundary**: within a game, the host is trusted by joiners as the source of truth; joiners adopt any snapshot with a higher `seq` wholesale (`src/online/useOnlineGame.js` `adoptSnapshot`). A joiner cannot distinguish the real host from any other party that knows the id and emits a higher-`seq` snapshot.
- **Invite-link / game-id boundary**: possession of the id is the entire access-control model (`src/online/localSnapshot.js` `newGameId`, `src/routes/OnlineLobbyPage.jsx`). The id also encodes nothing sensitive; `?v=`/`?host=` query params are non-secret orientation hints (`src/routes/OnlinePlayPage.jsx`).
- **Browser local storage (OS/origin)**: IndexedDB + localStorage are origin-scoped and trusted to the same degree as the origin; any script on the origin (or a local user) can read/write them (`src/profile/storage.js`, `src/online/localSnapshot.js`).
- **File import boundary**: an imported `.json` profile is fully untrusted and normalized before use (`src/profile/ProfileContext.jsx` `importProfile`).
- **Web Worker / UCI boundary**: the Stockfish worker is a separate context communicated with over plain text; its output strings are parsed, never evaluated (`src/engine/stockfishClient.js` lines 11-12, 70-78).
- **Build / CI boundary**: npm dependency resolution, the `postinstall` engine-vendor script, and GitHub Actions (with `VITE_SUPABASE_*` repo secrets) sit between developer commits and the deployed artifact (`.github/workflows/`, `scripts/vendor-engine.mjs`).

**Inputs by control tier**
- **Attacker-controlled**:
  - All broadcast payloads on a known game channel: `snapshot` (full serialized game state, `seq`, `players`, `hostColor`, `variant`), `move-intent` (`pieceMove`, `duckSquare`, `by`), `request-snapshot`, and `chat` (`text`, `by`, `id`) — handlers in `src/online/useGameChannel.js`, consumers in `src/online/useOnlineGame.js`.
  - The serialized state string fed to `createVariantGame` → `deserialize` (`src/engine/duck/board.js`) / `new Chess(fen)` (`src/online/rules.js`), which is reconstructed without validation.
  - A user-supplied profile `.json` file (`src/profile/ProfileContext.jsx`).
  - URL path/query for any route, including the `gameId` param and the 404/redirect machinery (`public/404.html`, `index.html` restore snippet, `src/App.jsx` routes).
- **Operator-controlled**: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env (`.env.example`, `.env.local`, `.env.production` written from Actions secrets in `deploy.yml`); `BASE_PATH` for the Pages sub-path (`vite.config.js`); the Supabase project's own dashboard config (free-tier quotas, whether the project is left wide open). Misconfiguration risk: shipping a *non-anon* (service-role) key would be catastrophic, but the committed key is a `sb_publishable_` anon key.
- **Developer-controlled**: the dependency set and lockfile (`package.json`, `package-lock.json`); the `postinstall`/`predev`/`prebuild` engine-vendor hook (`scripts/vendor-engine.mjs`); the CI/deploy workflows and their secrets (`.github/workflows/`); test fixtures.

**Assumptions**
- The random game id has enough entropy to resist guessing/enumeration: it is 16 chars sliced from `crypto.randomUUID()` (with a `Math.random()` fallback only if `crypto` is unavailable) — `src/online/localSnapshot.js`. Confidentiality of a session rests entirely on this holding and on the link not leaking (referrer, shared screenshots, chat history).
- The browser's same-origin policy and IndexedDB/localStorage origin isolation hold, and TLS for the Supabase WebSocket is provided correctly by the browser + Supabase.
- The shipped Supabase key is an anon/publishable key and the Supabase project is not separately configured to expose privileged tables/functions to anon (the app itself never uses the DB, but the project could host other things).
- Third-party libraries (chess.js legality, react-chessboard rendering, the Supabase SDK, React's JSX auto-escaping) behave per contract; the vendored Stockfish binary from the pinned `stockfish.js@^10` package is the genuine, unmodified engine.

## 3. Attack Surface, Mitigations and Attacker Stories

### 3.1 Public Realtime channel — eavesdropping and unauthorized participation
**Surface**: Every game runs on a public Supabase channel `game:<id>` that any client holding the (bundle-embedded) anon key can subscribe to, given the game id; the channel is deliberately never marked `private`, so there is no per-channel authorization (`src/online/useGameChannel.js` lines 16-18, 60-70; `src/lib/supabase.js`). The id is the only gate (`src/online/localSnapshot.js`).

**Mitigations**
- Game ids come from `crypto.randomUUID()` (122 bits) truncated to 16 hex-ish chars, making blind enumeration impractical (`newGameId` in `src/online/localSnapshot.js`).
- The design scope is explicitly "a private link between two friends"; the code and docs treat the channel as unauthenticated by intent, not by oversight (`src/lib/supabase.js` header, `.env.example`).
- Seat-claiming is trust-on-first-move: the first id to move a given color claims that seat, and later intents from other ids for a claimed seat are ignored by the host (`src/online/useOnlineGame.js` `applyIntent`, lines 112-120).

**Attacker stories**
- A person who obtains the invite link (shoulder-surf, forwarded message, referrer leak) silently subscribes and watches the entire game and chat in real time: a confidentiality loss bounded to one casual game, severity low.
- An attacker who learns the id before the second player joins races to claim the open seat ("seat hijack"), so the intended friend is locked out and must start a new game: availability/grief, severity low-to-medium.
- An attacker brute-forces game ids hoping to stumble into an active session: defeated in practice by the 122-bit UUID source, severity low.

### 3.2 Host authority spoofing and snapshot injection
**Surface**: Joiners treat *any* snapshot with `seq` greater than their current `seq` as the new authoritative truth and rebuild their entire game from it, with no verification that the sender is the legitimate host (`src/online/useOnlineGame.js` `adoptSnapshot`, lines 132-144). Because `broadcast.self:false` and there is no signing, the joiner cannot tell the host's snapshot from a third party's.

**Mitigations**
- Monotonic `seq` prevents stale or replayed older snapshots from overwriting newer state (`adoptSnapshot` early-returns when `snapshot.seq <= seqRef.current`).
- The host re-validates joiner move-intents against the rules engine before applying and bumps `seq` on every authoritative change, so a joiner cannot directly forge board state *to the host* — only the host writes authoritative state from the host's perspective (`applyIntent` → `broadcastAuthoritative(true)`).
- State is reconstructed through the rules engines (`createVariantGame`), so an adopted snapshot still has to be a parseable position to be playable.

**Attacker stories**
- A third party on the channel broadcasts a crafted `snapshot` with a very high `seq` and an arbitrary board, and the joiner adopts it — desynchronizing or hijacking the joiner's view of the game ("ghost host"): game-integrity loss for a casual match, severity medium.
- An attacker injects a snapshot whose `players` map reassigns seats, confusing which color a victim controls (`adoptSnapshot` copies `snapshot.players` verbatim): grief/confusion, severity low-to-medium.
- An attacker floods high-`seq` snapshots to keep resetting both clients' boards: denial of the game session, severity low (game-scoped, no persistence).

### 3.3 Untrusted state deserialization (robustness / DoS)
**Surface**: Adopted snapshots and the persisted localStorage snapshot are passed straight into `createVariantGame(variant, state)` → for Duck Chess, `deserialize()` does zero validation: it splits the wire string, `parsePlacement` writes whatever piece letters it sees into a fixed 64-cell array, and numeric fields go through `Number()` (yielding `NaN` on garbage) — `src/engine/duck/board.js` lines 51-64, 122-135. For standard chess the string is handed to `new Chess(fen)` (`src/online/rules.js`). The resulting `fen`/`boardFen()` is then rendered by react-chessboard (`src/components/BoardPanel.jsx` `position={fen}`).

**Mitigations**
- `parsePlacement` writes into a pre-sized `new Array(64)`, so an over-long placement field overflows into sparse indices rather than growing unbounded; the move generator iterates a fixed 8x8 and ignores out-of-range cells (`src/engine/duck/board.js`, `src/engine/duck/moves.js`).
- The board is persisted to localStorage before broadcast and re-loadable, but each load goes through the same try/catch-guarded JSON parse (`loadSnapshot` in `src/online/localSnapshot.js` returns null on malformed JSON).
- This is a casual, no-stakes context; a corrupted board only affects the two participants' current tab.

**Attacker stories**
- A malicious peer sends a snapshot with a malformed serialized state (bad piece chars, `NaN` move counters, a `duck` square off the board), and the joiner's rules engine or react-chessboard throws while rendering, crashing the game view until reload ("malformed-FEN crash"): client-side DoS, severity low-to-medium.
- A peer sends a board with duplicate or zero kings; `deriveResult` keys win solely on the presence of `K`/`k`, so the attacker can force a bogus "King captured" result or a never-ending game (`src/engine/duck/duckChess.js` `deriveResult`): game-integrity grief, severity low.
- An attacker sends deeply pathological state hoping to wedge the move generator into heavy work: bounded by the fixed 64-cell iteration, so impact is minimal, severity low.

### 3.4 Peer chat rendering (XSS candidate)
**Surface**: Chat messages received over the broadcast channel are rendered in the opponent's UI (`src/components/ChatBox.jsx`, fed by `src/online/useOnlineGame.js` `messages`). Attacker-authored text crossing into the DOM is the classic stored/relayed-XSS scenario.

**Mitigations**
- Message text is rendered as a JSX text child (`{message.text}`), so React auto-escapes it; there is **no** `dangerouslySetInnerHTML`, `innerHTML`, or `eval` anywhere in `src/` (verified by grep). A `<script>` or `<img onerror>` in chat renders as inert literal text.
- The send path trims and length-limits input (`maxLength={500}` on the input, `text.trim()` in `sendChat`), and messages carry a synthetic `id`/`by` rather than echoing arbitrary HTML attributes (`src/online/useOnlineGame.js` lines 296-305).
- There is no persistence of chat (ephemeral, session-only), so even a successful injection could not be stored or replayed to future visitors.

**Attacker stories**
- A peer sends chat containing HTML/JS markup hoping to execute script in the victim's session: neutralized by React's text escaping, severity low (no impact under current rendering).
- A peer sends an extremely long or rapid stream of chat messages to flood the victim's chat pane / memory (`messages` array grows unbounded, no rate cap on the receive side): minor client-side DoS/annoyance, severity low.
- A peer spoofs the `by` color so its bubble renders on the victim's own side, a minor UI-spoofing nuisance (`ChatBox` positions by `message.by === selfColor`): cosmetic, severity low.

### 3.5 Lesson/glossary content rendering
**Surface**: Lesson and glossary prose (JSON under `src/content/`) is rendered through a custom mini-markdown component supporting paragraphs, `**bold**`, and `[[term]]` glossary links (`src/components/Markdown.jsx`).

**Mitigations**
- All rendering is via JSX nodes (`<strong>`, text fragments, `renderTerm`), never raw HTML; there is no HTML passthrough, so even if content were attacker-authored it could not inject markup (`src/components/Markdown.jsx`).
- Content is build-time data authored in-repo and validated by a content schema/validator in CI (`scripts/validate-content.mjs`, `npm run validate-content` in `.github/workflows/ci.yml`), so it is developer-controlled, not user-supplied at runtime.

**Attacker stories**
- A malicious pull request adds lesson JSON attempting to smuggle markup or a hostile link through the renderer: blocked both by JSX escaping and by code review + the content validator gate, severity low.
- A contributor adds a `[[term]]` referencing a non-existent glossary slug to break navigation: a content-quality bug, not a security issue, severity low.

### 3.6 Untrusted profile-file import
**Surface**: "Import a saved profile" reads a user-chosen `.json` file and parses it into a profile + progress records (`src/profile/ProfileContext.jsx` `importProfile`, `src/profile/PickProfile.jsx`).

**Mitigations**
- Strict shape check: rejects anything whose `format !== 'chess-academy-profile'` or lacking a `profile` object; wraps `JSON.parse` so malformed files surface a friendly error rather than crashing (`importProfile`, `onImport`).
- Every imported field is normalized to the same invariants as the create path: `name` coerced to a ≤20-char string, `avatar` allow-listed against `AVATARS`, `createdAt` forced finite, and a **fresh** `crypto.randomUUID()` id assigned so an import can never clobber an existing profile.
- Progress entries pass through `sanitizeProgress`, which whitelists `status`, filters `completedStepIds` to strings, and coerces numerics (`src/profile/progress.js`).

**Attacker stories**
- A victim is tricked into importing a hostile profile file with oversized/typed-wrong fields to corrupt local state or overwrite their profile: prevented by field normalization and the fresh-id assignment, severity low.
- A crafted file with a huge `progress` map is imported to bloat IndexedDB: bounded by browser storage quotas and limited to the victim's own origin, severity low.

### 3.7 Stockfish Web Worker / UCI boundary
**Surface**: The app spawns a classic Web Worker from a vendored script URL and exchanges UCI text lines with it (`src/engine/stockfishClient.js`; binaries under `public/engine/`). The worker URL is derived from `import.meta.env.BASE_URL` (`workerUrl`).

**Mitigations**
- Engine output is parsed as plain strings (regex score extraction, `bestmove` line split) and **never evaluated**; the returned move is validated with `isUci` before use (`src/engine/stockfishClient.js` lines 11-12, 95-100, 125-132).
- Strict one-command-at-a-time protocol with timeouts and a single pending resolver bounds resource use and prevents a stuck engine from hanging the UI indefinitely (`waitFor`, `HANDSHAKE_TIMEOUT_MS`, `MOVE_TIMEOUT_MS`).
- The single-threaded WASM build needs no `SharedArrayBuffer`/COOP-COEP, narrowing cross-origin-isolation concerns; the worker is same-origin from the app's own static assets.

**Attacker stories**
- An attacker who could swap the vendored binary (a supply-chain or host-compromise prerequisite, see 3.8) gets code execution in the worker context: real but gated behind a separate compromise, severity high *if* that precondition is met, otherwise not reachable.
- The engine misbehaves or hangs on a pathological position, freezing analysis: bounded by the command timeouts, severity low.

### 3.8 Build, dependency, and supply-chain surface
**Surface**: The deployed artifact is produced by `npm ci` + `vite build` in GitHub Actions; a `postinstall`/`predev`/`prebuild` hook runs `scripts/vendor-engine.mjs` to copy Stockfish from `node_modules/stockfish.js` into `public/engine/`; the bundle ships several third-party libraries (react-router-dom, react-chessboard, chess.js, @supabase/supabase-js, three) — `package.json`, `.github/workflows/`.

**Mitigations**
- Dependencies are version-pinned via `package-lock.json` and installed with `npm ci` (lockfile-exact) in CI (`.github/workflows/ci.yml`, `deploy.yml`).
- The engine-vendor script is small, local, and idempotent — it only copies a fixed file list from an already-installed package and exits if the source is absent; it fetches nothing from the network at build time (`scripts/vendor-engine.mjs`).
- Supabase credentials are injected from GitHub Actions secrets into `.env.production` at build time and are public-by-design anyway; `.env.production` is gitignored and the committed `.env.local` holds only a publishable anon key (`.gitignore`, `deploy.yml`).
- Deploy workflow runs with least-privilege `permissions` (`contents: read`, `pages: write`, `id-token: write`) and pinned major action versions.

**Attacker stories**
- A compromised or typo-squatted transitive dependency (or a malicious `postinstall` in the tree) executes during `npm ci` in CI or on a contributor's machine, exfiltrating the Actions secrets or poisoning the bundle: classic supply-chain compromise, severity high (impact bounded by the fact that the only secret is a public anon key, but bundle poisoning could serve malware to all visitors).
- A bundled dependency carries a known vulnerability that is reachable in this app — e.g. `react-router-dom`/`@remix-run/router` at the pinned range is flagged by `npm audit` for XSS-via-open-redirect (GHSA-2w69-qvjg-hvjx): exploitability depends on whether the app uses an affected redirect pattern (it uses static `<Route>`/`<Navigate>` targets, not user-controlled redirect URLs, in `src/App.jsx`), so practical impact appears limited, severity medium pending upgrade.
- An attacker with write access to the gh-pages artifact or the Pages settings serves a tampered bundle (including a swapped Stockfish binary): full client compromise for visitors, severity high, but requires compromising GitHub/CI first.

### 3.9 Static hosting headers and SPA redirect handling
**Surface**: The app is served as static files from GitHub Pages with **no application-defined security headers** (no Content-Security-Policy, X-Frame-Options, HSTS, or referrer policy anywhere in `index.html`, the build, or config — verified by grep). Deep links are handled by the `spa-github-pages` redirect: `public/404.html` encodes the path into a query string and `location.replace`s to the root, where an inline snippet in `index.html` restores the URL via `history.replaceState`.

**Mitigations**
- The redirect restore writes the reconstructed path through `history.replaceState` (URL/history APIs), **not** into `innerHTML` or `document.write`, so the path data is not injected into the DOM as markup (`index.html` lines 14-28).
- GitHub Pages serves over HTTPS by default and sets some baseline platform headers; the app holds no cookies, no auth tokens, and no cross-site state, so CSRF and cookie-theft classes are largely inapplicable.
- The Supabase anon key and game ids are the only sensitive-ish values exposed to the page, and neither is a credential that headers would protect.

**Attacker stories**
- Absent a CSP, any successful script-injection foothold (e.g. via a future dependency XSS) would face no second-layer mitigation: this raises the blast radius of *other* bugs but is not itself directly exploitable, severity low-to-medium (defense-in-depth gap).
- Absent `X-Frame-Options`/`frame-ancestors`, the app can be framed for clickjacking; with no sensitive actions (no accounts, no transactions) the upside for an attacker is minimal, severity low.
- An attacker crafts a hostile deep-link query string hoping the 404→index restore mishandles it: constrained to history-state manipulation within the same origin (no HTML sink), so impact is limited to landing on an unexpected route, severity low.

**Less-relevant vulnerability classes.** Several standard categories do not meaningfully apply because the app has **no server, no database it controls, no authentication, and no secrets of value**: **server-side injection** (SQL/NoSQL/command/SSRF) — there is no server or DB query path; **broken authentication / session management** — there are no accounts, passwords, sessions, JWTs, or cookies; **authorization/IDOR on server resources** — no server-side objects exist (the only "authorization" is knowing a game id, covered in 3.1); **CSRF** — no cookie-authenticated state-changing endpoints; **cryptographic misuse** — the app performs no crypto beyond using `crypto.randomUUID()` for ids and delegating TLS to the browser/Supabase; **secret leakage** — the one key in the bundle is a publishable anon key by design. **Tampering** and **information disclosure** appear within the online channel (3.1-3.3); **denial of service** is uniformly client/tab-scoped (3.3, 3.4); **elevation of privilege** has no real meaning in a single-tier client with no roles. **Repudiation** is irrelevant — there is no audit log, accountability requirement, or identity to repudiate against.

## 4. Criticality Calibration

**Critical**
- *(none)* — there is no remote-code-execution path, no credential or key of value to steal, no authentication to bypass, and no server to compromise. The architecture removes the preconditions for any critical-tier impact.

**High**
- Supply-chain compromise of a build/runtime dependency (malicious `postinstall` or poisoned package during `npm ci`) could poison the deployed bundle or the vendored Stockfish binary and thereby run attacker code in every visitor's browser — gated behind compromising the dependency tree or CI (3.7, 3.8).
- Compromise of the GitHub Pages artifact or Pages configuration would let an attacker serve a fully malicious app to all users — gated behind a prior GitHub/CI compromise (3.8).

**Medium**
- A peer (or any party who learns the game id) can desynchronize or hijack the opponent's game view by injecting high-`seq` snapshots, since joiners adopt host snapshots without authenticating the host (3.2).
- A bundled dependency advisory (`react-router-dom`/`@remix-run/router`, GHSA-2w69-qvjg-hvjx) is present in the shipped tree; current usage relies on static route targets, so practical exploitability appears limited but is not affirmatively ruled out (3.8).
- The absence of any Content-Security-Policy means the app provides no defense-in-depth against an injection foothold introduced by a future bug (3.9).

**Low**
- Eavesdropping on a casual game/chat or hijacking an unclaimed seat for someone who already has the invite link — confidentiality/availability loss bounded to a single no-stakes session (3.1).
- Malformed-snapshot crashes or chat/snapshot flooding that disrupt only the two participants' current tab until reload, with no persistence (3.3, 3.4).
- Local-only exposure of self-entered profile names/progress, and a crafted profile-import file — both contained by field normalization, fresh-id assignment, and origin-scoped storage (3.6).

**Calibration rationale.** Severity here is dominated by one fact: **Chess Academy is a credential-free, backend-free static SPA whose only network surface is an intentionally unauthenticated message bus for casual two-player games.** There is nothing to steal (no accounts, money, PII, or secrets — the shipped key is public by design), nothing to escalate into (single trust tier, no roles, no server), and no persistence an attacker can poison across sessions. That collapses what would be high/critical findings in a typical web service (eavesdropping, participant spoofing, state injection) down to **low-to-medium griefing of an individual, ephemeral game session**. The genuinely higher-severity risks live **off the runtime data path** — in the **supply chain and deployment pipeline**, where a compromise would let an attacker serve malicious code to all visitors; those rate **high** precisely because the client is otherwise the *only* thing an attacker can affect, so controlling what ships to it is the maximal lever. XSS, normally critical when it can steal tokens or keys, is here de-rated to **low** because (a) the obvious sinks (chat, lesson markdown) render through React's auto-escaping with no raw-HTML path, and (b) even a hypothetical injection would find no auth token, session cookie, or crypto key worth exfiltrating. The owner's stated priorities — robustness of the online join flow and upcoming **lobby/waiting-room**, **richer chat**, and a **mutable-board duck-chess** variant — all expand surfaces 3.2-3.4: more peer-controlled state and more rendered peer content. None changes the trust model, but each widens the unauthenticated-input attack surface, so the host-authority-spoofing and untrusted-deserialization items (currently medium/low) are the ones whose likelihood would rise as those features land, and richer chat is the feature most likely to reintroduce an XSS sink if it ever moves to rich/HTML rendering.
