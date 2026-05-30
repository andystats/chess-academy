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
- *(Coming)* a **puzzle trainer** powered by the CC0 [Lichess puzzle database](https://database.lichess.org/#puzzles),
  and embedded **[Stockfish](https://stockfishchess.org/)** for hints and analysis.

## Status

Early but real. The lesson engine, content schema + validator, local profiles, a book-study
section, and the first lessons are built; puzzles and the engine come next. See
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
