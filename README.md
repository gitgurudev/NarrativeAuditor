# NarrativeAuditor

> AI-powered screenplay evaluation using the Netflix LLM-as-a-Judge architecture.

Upload a PDF script. Get a professional-grade analysis — per-criterion scores, character consistency tracking, plot gap detection, tone arc visualization, and AI-generated scene rewrites. Everything runs in the browser. No backend required.

---

## What it does

NarrativeAuditor applies the same evaluation pattern Netflix described for reviewing show synopses — extended to full-length movie scripts.

Upload a PDF (tested on 136-page scripts). The app:

1. Extracts text page by page using PDF.js (browser-side, no upload)
2. Splits the script into ~30-page sections
3. Evaluates each section across **4 criteria** in a single LLM call — Clarity, Creativity, Engagement, Coherence
4. Synthesizes all section results into a final rubric-based evaluation with verdict
5. Runs **Script Intelligence** — 4 deep analyses delivered alongside the results

---

## Netflix LLM-as-a-Judge — Architecture

| Pattern | What it does | Why it matters |
|---|---|---|
| **Per-criterion judges** | Separate evaluation focus per criterion | Focused prompts outperform asking one model to evaluate everything at once |
| **Tiered rationale** | Detailed reasoning → 2-sentence summary → score | Chain-of-thought before scoring produces more accurate, trustworthy results |
| **Combined evaluation** | All 4 criteria scored in one call | Efficient token usage — complete analysis per section in a single request |

---

## Script Intelligence (4 Deep Analyses)

Runs alongside the final synthesis — delivered all at once:

- **Character Consistency** — tracks every named character, flags motivation shifts, unexplained exits, continuity gaps
- **Plot Gap Detection** — identifies unresolved subplots, logic holes, missing context (CRITICAL / HIGH / MEDIUM / LOW severity)
- **Tone Arc Analysis** — visualizes emotional intensity per section with color-coded bars, flags jarring tonal transitions
- **Scene Improver** — picks the 3 weakest sections, explains what's wrong, and generates an AI rewrite in screenplay format

---

## Tech Stack

- **React 18** + **Vite** — CSS Modules, no routing library
- **PDF.js** (`pdfjs-dist`) — browser-side text extraction, PDF never leaves your device
- **OpenAI GPT-4o** — all LLM calls made directly from the browser
- **html-to-image** — export results as a PNG chart

---

## Quick Start

```bash
git clone https://github.com/gitgurudev/NarrativeAuditor.git
cd NarrativeAuditor
npm install
```

Create a `.env.local` file:

```
VITE_OPENAI_API_KEY=sk-proj-your-key-here
```

```bash
npm run dev
```

Get your API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_OPENAI_API_KEY` | OpenAI API key — used for all LLM evaluation calls |

---

## Deploy to Render

1. Push repo to GitHub
2. Go to [render.com](https://render.com) → New → **Static Site**
3. Connect your GitHub repo
4. Set:
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `dist`
   - **Environment variable:** `VITE_OPENAI_API_KEY = your-key`
5. Deploy

Free tier. Auto-deploys on every push.

---

## Run with Docker

```bash
docker build --build-arg VITE_OPENAI_API_KEY=sk-proj-your-key -t narrative-auditor .
docker run -p 8080:80 narrative-auditor
```

Open [http://localhost:8080](http://localhost:8080).

---

## Project Structure

```
src/
  components/
    PdfUploader.jsx       # Landing page + drag-and-drop upload
    ChunkProgress.jsx     # Live evaluation progress stepper
    ResultsPanel.jsx      # Verdict + criterion cards
    CriterionCard.jsx     # Individual score card
    ScriptAnalysis.jsx    # 4 Script Intelligence panels
    ResultsChart.jsx      # Exportable PNG results chart
  services/
    api.js                # All LLM calls — evaluation, synthesis, analysis
  utils/
    pdfParser.js          # PDF.js text extraction
    chunker.js            # 30-page chunk builder
  styles/
    global.css            # Design tokens + theme
```

---

## Inspired By

Cameron R. Wolfe, Ph.D. — Netflix Technology Blog post on LLM-as-a-Judge evaluation systems for content review at scale.

---

## License

MIT
