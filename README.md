# Chess Academy

An open-source chess study tool for learners building fundamentals and strategic habits. It
teaches through short, interactive lessons on a real board you can drag or tap pieces on — no
account, no ads, works offline-first in the browser.

> **Working title.** "Chess Academy" is a placeholder name — rename freely in `package.json`,
> `index.html`, and `tailwind.config.js`.

## What's inside

- **My System study** — a book-like, playable path after Nimzowitsch's *My System* (the ideas are
  public domain; all prose here is written fresh for this project).
- **Classics** — strategic fundamentals drawn from the same tradition as standalone lessons.
- **Thinking habits** — the modern coaching checklists: **C**hecks, **C**aptures, **T**hreats;
  "to take is a mistake"; "optimise your worst piece"; always check your opponent's best reply.
- **Glossary** — plain-language definitions with little example boards, cross-linked from lessons.
- **Practice arena** — play **[Stockfish](https://stockfishchess.org/)** at the strength you choose,
  run lesson scenarios, share a board for local two-player, or **play a friend online** (below).
- *(Coming)* a **puzzle trainer** powered by the CC0 [Lichess puzzle database](https://database.lichess.org/#puzzles).

## Play a friend online

The app is live at **<https://andystats.github.io/chess-academy/>**. Two people on different devices
can play standard chess, **Duck Chess**, or **Duck Chess Decay** in real time — no accounts, no install.

1. Open the site → **Practice Arena → Play a Friend Online**.
2. Pick a variant (Standard, **Duck Chess**, or **Duck Chess Decay**) and your colour, then **Create game**.
3. **Copy the invite link** and send it to your friend — opening it joins them as the other colour.
4. Take turns on the same board, in real time.

### First time with Duck Chess?

Duck Chess is normal chess with one twist — a rubber duck 🦆 that blocks squares:

- **Each turn has two steps:** make a normal move, **then move the duck** to any empty square (after
  the first placement it must move to a *different* square each turn).
- **The duck blocks everything** — no piece may land on it or slide through it (knights still jump
  over), and it can't be captured.
- **There is no check or checkmate.** You may move your king into danger and ignore threats to it, so
  **you win by *capturing* the enemy king** outright. Hunt for the king grab — and use the duck to
  shield your own king or block a winning capture.
- **Duck Chess Decay** adds terrain: when the duck moves away, its old square stays blocked for two
  completed turns before repairing.

> Realtime play uses [Supabase](https://supabase.com/) and needs `VITE_SUPABASE_URL` /
> `VITE_SUPABASE_ANON_KEY` (see [`.env.example`](./.env.example)). Without them the rest of the app
> still works — only online play is disabled.

## Status

Early but real. The lesson engine, content schema + validator, local profiles, a book-study section,
the first lessons, and the practice arena — Stockfish play, lesson scenarios, local two-player, and
**online multiplayer with Duck Chess variants** — are built; the puzzle trainer comes next. See
[`ROADMAP`](#roadmap) below.

## Quick start

```bash
npm install
npm run dev            # start the dev server (http://localhost:5173)
npm test               # run the unit/integration tests
npm run validate-content   # check every lesson's moves are legal & solvable
npm run build          # production build
```

Requires Node 18+ (developed on Node 22).

## Content is data, not code

Every lesson, glossary entry, and puzzle set is a JSON file under `src/content/`. **You do not
need to be a programmer to add a lesson** — write the prose and the moves, open a pull request,
and CI checks the moves are legal for you. See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the
lesson-authoring guide.

## Tech

React 18 · Vite · Tailwind · [chess.js](https://github.com/jhlywa/chess.js) (rules) ·
[react-chessboard](https://github.com/Clariity/react-chessboard) (board) · Vitest. Deploys as a
static site to GitHub Pages.

## Roadmap

| Stage | Scope |
|-------|-------|
| 0 | Foundation, tooling, CI, licensing |
| 1 | Lesson engine, content schema + validator, profiles, first lessons + glossary |
| 2 | Puzzle trainer + spaced repetition (Lichess CC0 set) |
| 3 | Stockfish (WASM) for hints, "best reply", and free-play analysis |
| 4 | Reference sections, read-aloud, accessibility & study-UX polish |

## Licensing

- **Code** — [MIT](./LICENSE).
- **Content** (`src/content/`) — [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Third-party components** (e.g. Stockfish, GPL-3.0) keep their own licenses — see
  [THIRD_PARTY.md](./THIRD_PARTY.md).

We deliberately **do not** ship the text of any copyrighted book. Ideas from *My System* are used
freely (it is long out of copyright in its original form); all prose is original.

## Contributing

Lessons, glossary terms, bug fixes, and code are all welcome. Start with
[CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md).
