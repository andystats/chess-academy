# Contributing

Thanks for helping build a friendly place to learn chess! There are two easy ways in:

1. **Write a lesson or glossary entry** — no coding needed (this guide).
2. **Improve the app** — see [Code contributions](#code-contributions) at the end.

By contributing you agree your code is licensed MIT and your **content** (lessons, glossary,
puzzles) is licensed [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/). Please be
kind and follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Authoring a lesson (no programming required)

A lesson is a single JSON file in `src/content/lessons/`. Copy an existing one (e.g.
`src/content/lessons/classics/the-center.json`), change the contents, and open a pull request.
When you do, our checks automatically confirm **every move you wrote is legal and the lesson is
solvable** — so a typo in a move fails the check with a friendly message instead of breaking the
site.

### The shape of a lesson file

```jsonc
{
  "schemaVersion": 1,
  "kind": "lesson",
  "id": "classics/the-center",      // see "Picking an id" below — this is permanent
  "track": "classics",              // "classics" | "habits"
  "title": "The Center",
  "subtitle": "Staking your claim",
  "summary": "What the four central squares are and why they matter.",
  "estMinutes": 6,
  "tags": ["opening", "center"],
  "attribution": "Original prose; ideas after Nimzowitsch, My System (public domain).",
  "body": {
    "steps": [ /* ... one or more steps ... */ ]
  }
}
```

### Step types

Each entry in `body.steps` has a `type`. Every step has an `id`, a `fen` (the board position), an
`orientation` (`"white"` or `"black"` — whose side faces the student), and `markdown` (the words
the student reads). The five types:

| `type` | What the student does | Extra fields |
|--------|----------------------|--------------|
| `prose` | Reads, then clicks **Next**. | — |
| `single-move` | Makes one correct move. | `solution: { "san": ["e4", "d4"] }` |
| `line` | Plays out a sequence; the app answers for the other side. | `mainline`, optional `acceptableAt` |
| `choose` | Picks the right answer (no board move). | `options: [...]` |
| `free-explore` | Moves pieces freely to experiment. | — |

#### A `single-move` step

```jsonc
{
  "id": "grab-center",
  "type": "single-move",
  "title": "Grab the center",
  "orientation": "white",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "markdown": "Push a pawn to claim a center square.",
  "solution": { "san": ["e4", "d4"] },
  "hints": [
    { "text": "A pawn move is best here." },
    { "text": "Try the king's pawn.", "arrows": [["e2", "e4"]] }
  ],
  "feedback": { "correct": "Yes! Now you own a center square.", "wrong": "That doesn't fight for the center yet — try again." }
}
```

- **Moves are written in [SAN](https://en.wikipedia.org/wiki/Algebraic_notation_(chess))**
  (`e4`, `Nf3`, `O-O`, `exd5`, `e8=Q`). You can list more than one acceptable first move in
  `solution.san`. Don't worry about typing `+` for check or `#` for mate — the checker is forgiving.

#### A `line` step (the app plays the opponent)

```jsonc
{
  "id": "open-game",
  "type": "line",
  "title": "Develop with tempo",
  "orientation": "white",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "markdown": "Play a healthy opening. The computer answers for Black.",
  "mainline": ["e4", "e5", "Nf3", "Nc6", "Bb5"],
  "acceptableAt": { "2": ["Bc4"] }   // optional: at the student's 3rd move, Bc4 is also fine
}
```

- `mainline` lists **both sides' moves in order**, starting with the student's side (the side to
  move in the `fen`). The app plays the opponent's moves for you.
- `acceptableAt` is optional. The key is the **student's move number, counting from 0** (so `"0"`
  is their first move, `"1"` their second…). Each listed move must lead back into the same line.
  *(Branching into genuinely different continuations is a planned feature, not yet supported.)*

#### A `choose` step

```jsonc
{
  "id": "whats-the-threat",
  "type": "choose",
  "title": "What's the threat?",
  "orientation": "black",
  "fen": "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
  "markdown": "White just played Bb5. What is the idea?",
  "options": [
    { "id": "a", "label": "Win the e5 pawn", "correct": true, "explain": "Right — Bxc6 then Nxe5." },
    { "id": "b", "label": "Checkmate now", "correct": false, "explain": "No mate is threatened yet." }
  ]
}
```

### Glossary cross-links

In any `markdown`, wrap a glossary term in double brackets: `the [[center]]` or, with custom
display text, `[[center|central squares]]`. The word becomes tappable and shows a little
definition card. Every `[[term]]` must match a glossary entry (the checker enforces this).

### Picking an `id`

- Lowercase letters, numbers, and dashes, with `/` to group: `classics/the-center`.
- It must be **unique** and is the lesson's permanent address (it's part of the URL and how a
  learner's progress is saved). **Never rename an `id`** once it's merged — pick carefully.

### Annotations (highlights & arrows)

Any board step may add `"annotations": { "highlight": ["e4", "d4"], "arrows": [["e2", "e4"]] }` to
draw the student's eye. Arrows are `[from, to]` or `[from, to, "good"|"bad"|"idea"]`.

### Before you open a PR

```bash
npm run validate-content   # confirms your moves are legal and your [[terms]] resolve
```

---

## Code contributions

- Fork, branch, and open a PR against `main`.
- Run `npm run lint && npm test && npm run validate-content` before pushing.
- Match the surrounding code style; keep components small and content-driven.
- New behavior needs a test. The lesson engine lives in `src/lesson/`, content in `src/content/`.
