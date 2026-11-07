# Chess Academy

An open-source chess study and play room built around a **real-time Stockfish + AI Coach**. Play against the computer or control both sides on an interactive board while the coach reviews positions in real time—flagging opponent threats to neutralize, explaining what you should be thinking about, showing optimal candidate moves and *why* they work, and grading the moves you play.

> **Working title.** "Chess Academy" is a placeholder name — rename freely in `package.json`,
> `index.html`, and `tailwind.config.js`.

## What's inside

- **Live Engine & AI Coach (`/coach`)** — a calm, board-centric study room where you can play against Stockfish (adjustable strength, Levels 1–20) or switch to **Both Sides (Sandbox)** to explore openings, middlegames, or endgames. Built around a permanent central chessboard and a fixed-geometry 4-tab coaching panel that never jitters or resizes:
  - **Main Idea Tab:** null-move threat detection (e.g., *"If given a move, White threatens Qxb7, winning the undefended pawn on b7"*), loose-piece warnings, king-safety/castling prompts, and a plain-English recommended plan.
  - **Key Best Moves Tab:** Stockfish `MultiPV=3` lines translated into concrete natural-language explanations (e.g., *"Castling (`O-O`) neutralizes the current threat on f7 while tucking the king to safety"*), with interactive board arrows and variation preview.
  - **State of the Board Tab:** evaluation strip, opening/phase badge, classical Stockfish evaluation breakdown (`Material`, `Pieces`, `Mobility`, `King Safety`, `Threats`, `Pawns`, `Passed`, `Space` — showing Middlegame `MG` and Endgame `EG` tapered scores), hanging/undefended piece radars, and full clickable move history + FEN loader.
  - **Ask Coach Tab:** conversational Q&A grounded in Stockfish’s live Depth 15+ calculation, exact piece-square maps, takeback memory (remembering moves you just undid and why they failed), real-time simulation of hypothetical candidate moves (*"What if I play..."*), multi-turn conversation memory, and classical chess literature (*My System*, *Chess Fundamentals*, opening theory, tactical motifs, and endgame technique).
  - **Live Coach vs. Guided Play (No Spoilers):** see optimal moves in real time, or switch to **Guided Play** to receive threat and mistake warnings while keeping the exact best move hidden until you ask.
  - **Permanent Last-Move Feedback Banner:** grades every move played (`Optimal Move`, `Solid Choice`, `Inaccuracy`, `Mistake`, `Blunder — Tactical Alert`) directly under the board with a one-click **Take back** button that preserves the undone move context for the Coach.
- **Pluggable AI & Strategy Companion** — runs out-of-the-box with a deterministic synthesizer, or connects to **Supabase Edge Function (`coach-chat` with Anthropic Claude Sonnet / Haiku)**, **Local Ollama** (100% offline/free), **Anthropic Claude**, **OpenAI**, or **Google Gemini**.
- **Practice Arena & Scenarios (`/`)** — focused tactical/strategic practice positions, unassisted Stockfish free play (`/arena/free`), and glossary-linked mini-lessons.
- **Play a Friend Online (`/arena/online`)** — invite-link multiplayer supporting Standard Chess, **Duck Chess**, and **Duck Chess Decay**.

---

## Quick start

```bash
npm install
npm run dev                # start the dev server (http://localhost:5173)
npm test                   # run the unit/integration tests
npm run lint               # run ESLint (zero warnings)
npm run validate-content   # verify all authored FENs and moves are legal
npm run build              # production build
```

Requires Node 18+ (developed on Node 22).

---

## Setting Up the AI Coach Companion

The coach’s real-time position scan, threat detector, and move explanations work **immediately with zero setup** using the bundled Stockfish WASM worker and built-in strategy synthesizer.

To enable free-form conversational LLM coaching in the **Ask Coach** tab, you can use **Local Ollama (offline & free)**, **Supabase Edge Functions (for public online hosting)**, or **Bring-Your-Own-Key (local dev)**.

### Option 1: Free Offline LLM with Ollama (Recommended for Local Use)

[Ollama](https://ollama.com/) runs open-weights models like `llama3.2` locally on your machine with no API keys or usage costs.

1. **Install Ollama:**
   - **macOS (Direct Download — no Xcode required):**
     ```bash
     curl -fL https://ollama.com/download/Ollama-darwin.zip -o /tmp/Ollama-darwin.zip
     unzip -q -o /tmp/Ollama-darwin.zip -d /Applications
     ln -sf /Applications/Ollama.app/Contents/Resources/ollama /opt/homebrew/bin/ollama
     ```
     *(Or install via Homebrew with `brew install ollama`, or download from <https://ollama.com/download>.)*
   - **Linux:**
     ```bash
     curl -fsSL https://ollama.com/install.sh | sh
     ```
   - **Windows:** Download the installer from <https://ollama.com/download>.

2. **Allow Browser Access (CORS) & Start Ollama:**
   Because the web app runs in your browser (e.g. `http://localhost:5173`), start Ollama with `OLLAMA_ORIGINS="*"` so the browser is allowed to call `http://localhost:11434`:
   ```bash
   # On macOS, persist for the GUI app too:
   launchctl setenv OLLAMA_ORIGINS "*"

   # Start the server and pull the default lightweight model (~2 GB):
   OLLAMA_ORIGINS="*" ollama serve &
   ollama pull llama3.2
   ```

3. **Select Ollama in the Coach UI:**
   - Open `http://localhost:5173/coach` (or the live hosted site), select the **Ask Coach** tab, click the **⚙ Provider** button in the top-right corner of the card, and select **Local Ollama (`http://localhost:11434`)**.
   - *Online Note:* Visitors on the hosted site can also select **Local Ollama** to connect their browser directly to Ollama running on their own machine (`http://localhost:11434`) as long as `OLLAMA_ORIGINS="*"` is set.

---

### Option 2: Wiring Up Claude / OpenAI / Gemini for the Public Online Site (Supabase Edge Function)

Because Chess Academy deploys as a static site (GitHub Pages / Vercel), you should **never** put a secret `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` into a `VITE_*` build variable (anything prefixed with `VITE_` is compiled into the public JavaScript bundle).

Instead, this repository includes a ready-to-deploy **Supabase Edge Function** at [`supabase/functions/coach-chat/index.ts`](./supabase/functions/coach-chat/index.ts). Your secret API key stays safely on Supabase’s server, and your public site calls `supabase.functions.invoke('coach-chat')`.

1. **Link your Supabase project** (the same one used for online multiplayer):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-supabase-project-ref>
   ```
2. **Set your server-side LLM secret key** (pick one—the Edge Function checks Anthropic first, then OpenAI, then Gemini):
   ```bash
   # For Anthropic Claude (tries claude-sonnet-4-5 / claude-sonnet-5-5 with fallback to claude-haiku-5-5):
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   # Optional: pin a specific model ID via ANTHROPIC_MODEL
   # npx supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-5

   # OR for OpenAI (defaults to gpt-4o-mini):
   npx supabase secrets set OPENAI_API_KEY=sk-...

   # OR for Google Gemini (defaults to gemini-2.5-flash):
   npx supabase secrets set GEMINI_API_KEY=AIza...
   ```
3. **Deploy the Edge Function:**
   ```bash
   npx supabase functions deploy coach-chat --no-verify-jwt
   ```
4. **Enable it by default on your deployed site:**
   In your GitHub repository (**Settings → Secrets and variables → Actions → Variables**), ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, and add:
   ```text
   VITE_COACH_EDGE_FUNCTION=true
   ```
   When `VITE_COACH_EDGE_FUNCTION=true` is present, visitors on your live GitHub Pages site will automatically use **Hosted Cloud Coach (Supabase Edge Function Proxy)** without needing their own API key.

---

### Option 3: Bring-Your-Own-Key (Local Dev or Personal Browser Session)

For quick personal testing without deploying an Edge Function:
- Open **Companion Model Settings** in the **Ask Coach** tab and choose **Anthropic Claude**, **OpenAI**, or **Google Gemini**, then paste your API key (saved only in your browser’s `localStorage`), **or**
- Add `VITE_ANTHROPIC_API_KEY`, `VITE_OPENAI_API_KEY`, or `VITE_GEMINI_API_KEY` to your local `.env.local` file (which is git-ignored).

---

## Play a friend online

The app is live at **<https://andystats.github.io/chess-academy/>**. Two people on different devices
can play standard chess, **Duck Chess**, or **Duck Chess Decay** in real time — no accounts, no install.

1. Open the site → **Practice Arena → Play a Friend Online**.
2. Pick a variant (Standard, **Duck Chess**, or **Duck Chess Decay**) and your colour, then **Create game**.
3. **Copy the invite link** and send it to your friend — opening it joins them as the other colour.
4. Take turns on the same board, in real time.

> Realtime play uses [Supabase](https://supabase.com/) and needs `VITE_SUPABASE_URL` /
> `VITE_SUPABASE_ANON_KEY` (see [`.env.example`](./.env.example)). Without them the rest of the app
> still works — only online play and the hosted Edge Function proxy are disabled.

## Tech

React 18 · Vite · Tailwind · [chess.js](https://github.com/jhlywa/chess.js) (rules) ·
[react-chessboard](https://github.com/Clariity/react-chessboard) (board) · Stockfish 10 WASM · Vitest.

## Licensing

- **Code** — [MIT](./LICENSE).
- **Content** (`src/content/`) — [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Third-party components** (e.g. Stockfish, GPL-3.0) keep their own licenses — see
  [THIRD_PARTY.md](./THIRD_PARTY.md).

## Contributing

Lessons, glossary terms, bug fixes, and code are all welcome. Start with
[CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md).
