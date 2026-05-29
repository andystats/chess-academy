# Third-Party Components & Content Sources

This project is MIT-licensed (code) and CC-BY-SA-4.0 (content under `src/content/`), but it builds
on, and will bundle, components and data under their own licenses. They are listed here.

## Runtime libraries (bundled via npm)

| Component | License | Notes |
|-----------|---------|-------|
| [chess.js](https://github.com/jhlywa/chess.js) | BSD-2-Clause | Move legality, FEN/SAN, game state. |
| [react-chessboard](https://github.com/Clariity/react-chessboard) | MIT | The board UI. |
| [React](https://react.dev/) / react-dom / react-router-dom | MIT | UI framework + routing. |
| [Tailwind CSS](https://tailwindcss.com/) | MIT | Styling. |
| lucide-react | ISC | Icons. |

Fonts (Baloo 2, Nunito) are served from Google Fonts under the SIL Open Font License.

## Stockfish (planned, Stage 3) — GPL-3.0

We will embed the [Stockfish](https://stockfishchess.org/) chess engine (compiled to WebAssembly,
e.g. [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js)) for hints and analysis.
**Stockfish is licensed under the GNU General Public License v3.** To respect it:

- The engine is loaded as a **separate, unmodified** WebAssembly Web Worker and communicated with
  over the standard UCI text protocol — it is an independent program, not statically linked into
  our code.
- Its `LICENSE`/`COPYING` and any required source pointers are kept intact alongside the binary
  under `public/engine/` (gitignored binaries are fetched at build time).
- Stockfish is credited prominently in the app UI wherever its output is shown.

If you redistribute a build of this app that bundles Stockfish, you must continue to honor GPL-3.0
for that component (provide/point to its source).

## Content data sources

| Source | License | Use |
|--------|---------|-----|
| [Lichess puzzle database](https://database.lichess.org/#puzzles) | CC0-1.0 (public domain) | A curated subset feeds the puzzle trainer (Stage 2). Attributed though not legally required. |
| *My System*, A. Nimzowitsch (1925) | Public domain (original) | Used only as a source of **ideas and positions**. **No book text is reproduced**; all lesson prose is original. |

We do **not** ship the text or the puzzle compilation of any in-copyright book. Copyrighted PDFs
kept locally for reference are gitignored and never committed.
