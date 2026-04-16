# NarrativeAuditor

> AI-powered screenplay evaluation using the Netflix LLM-as-a-Judge architecture.

Upload a PDF script. Get a professional-grade analysis: per-criterion scores, character consistency tracking, plot gap detection, tone arc visualization, and AI-generated scene rewrites.

---

## What it does

NarrativeAuditor applies the same evaluation pattern Netflix described for reviewing show synopses — and extends it to full-length movie scripts.

Upload a PDF (tested on 136-page scripts). The app:

1. Extracts text page by page using PDF.js
2. Splits the script into ~30-page sections
3. Runs **4 independent criterion judges** (Clarity, Creativity, Engagement, Coherence) in parallel on each section — each judge runs **3 times** and scores are averaged for consensus
4. Synthesizes all section results into a final rubric-based evaluation
5. Runs **Script Intelligence** analyses: character consistency, plot gap detection, tone arc, and AI scene rewrites

---

## Netflix LLM-as-a-Judge — 3 Upgrades Implemented

| Upgrade | What it does | Why it matters |
|---|---|---|
| **Per-criterion judges** | Separate LLM call per criterion | Focused prompts produce better scores than asking one model to evaluate everything |
| **Tiered rationale** | Long reasoning → summary → score | Chain-of-thought before scoring gives more accurate, trustworthy results |
| **Consensus scoring** | Same judge × 3 runs, averaged | LLMs are non-deterministic; averaging reduces variance |

---

## Script Intelligence (4 Deep Analyses)

- **Character Consistency** — tracks every named character, flags motivation shifts, unexplained exits, continuity gaps
- **Plot Gap Detection** — identifies unresolved subplots, logic holes, missing context (CRITICAL / HIGH / MEDIUM / LOW severity)
- **Tone Arc Analysis** — visualizes emotional intensity per section, flags jarring tonal transitions
- **Scene Improver** — picks the weakest scene per section, explains the issue, and generates an AI rewrite in screenplay format

---

## Tech Stack

- **React 18** + **Vite** — no routing library, CSS Modules
- **PDF.js** (`pdfjs-dist`) — browser-side text extraction, no server upload
- **html-to-image** — exports results as a PNG chart
- **Mock mode** — runs fully offline with realistic mock data (`VITE_MOCK_API=true`)

---

## Quick Start

```bash
git clone https://github.com/gitgurudev/NarrativeAuditor.git
cd NarrativeAuditor
npm install
npm run dev
```

The app runs in **mock mode by default** — no API key needed, no backend required.

---

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_MOCK_API` | `true` | `true` = offline mock data, `false` = real API calls |
| `VITE_API_BASE_URL` | `http://localhost:5000` | Your backend URL (only used when mock is off) |

**Security note:** `VITE_` env vars are embedded in the browser bundle at build time. Never put real API keys here. When connecting to a real LLM backend, the API keys must live on the server — this frontend calls your backend, your backend calls the LLM.

---

## Run with Docker

```bash
# Build and run (mock mode, no API key needed)
docker build -t narrative-auditor .
docker run -p 8080:80 narrative-auditor
```

Open [http://localhost:8080](http://localhost:8080).

To build with a real backend URL:

```bash
docker build \
  --build-arg VITE_MOCK_API=false \
  --build-arg VITE_API_BASE_URL=https://your-backend.com \
  -t narrative-auditor .
```

---

## Deploy to Render (Recommended)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → **Static Site**
3. Connect your GitHub repo
4. Set:
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `dist`
   - **Environment variable:** `VITE_MOCK_API = true`
5. Deploy

Free tier. Auto-deploys on every push. No Docker needed for Render static sites.

---

## Project Structure

```
src/
  components/
    PdfUploader.jsx       # Landing page + drag-and-drop upload
    ChunkProgress.jsx     # Live evaluation stepper
    ResultsPanel.jsx      # Verdict + criterion cards + deep analysis tabs
    CriterionCard.jsx     # Individual score card with consensus display
    ScriptAnalysis.jsx    # 4 Script Intelligence panels
    ResultsChart.jsx      # Exportable PNG results chart
  services/
    api.js                # LLM-as-a-Judge evaluation logic (mock + real)
  utils/
    pdfParser.js          # PDF.js text extraction
    chunker.js            # 30-page chunk builder
  styles/
    global.css            # Design tokens + theme
```

---

## API Endpoints Expected (when not in mock mode)

| Endpoint | Description |
|---|---|
| `POST /api/judge-criterion` | Single criterion judge call (tiered rationale) |
| `POST /api/synthesize` | Synthesize chunk results into final evaluation |
| `POST /api/analyze-characters` | Character consistency analysis |
| `POST /api/analyze-plot-gaps` | Plot gap detection |
| `POST /api/analyze-tone` | Tone arc analysis |
| `POST /api/suggest-improvements` | Scene improvement suggestions + rewrites |

---

## Inspired By

Cameron R. Wolfe, Ph.D. — Netflix Technology Blog post on LLM-as-a-Judge evaluation systems for content review at scale.

---

## License

MIT
