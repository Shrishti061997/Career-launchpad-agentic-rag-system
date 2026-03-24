# AI Career Launchpad

A full-stack GenAI + RAG application that helps people across all careers find jobs, build portfolios, and network. Works for tech, healthcare, education, finance, trades, marketing, and every other field. Powered by NVIDIA NIM and Retrieval-Augmented Generation.



## What it does

The app opens with a welcome page, then gives you 6 tabs — each solving a different part of the job search:

**Agent** — A chat interface where the AI decides which tool to use. Type "find me nursing jobs in Canada" and it calls Job Matches. Type "what should I learn next?" and it runs Skill Simulator. Type "draft a message to a hiring manager at Google" and it generates outreach. One input, the AI figures out the rest. This is what makes the app an AI agent — the LLM routes your request to the right tool automatically.

**Job Matches** — Searches live job postings from the Adzuna API based on your profile. Filter by full-time jobs, internships, or both. Job cards show first with Apply Now links, and the AI analysis (why each fits you, skill gaps, how to stand out) is collapsible below.

**Portfolio Builder** — Takes your target role and generates a personalized roadmap. Adapts to any profession — a nurse gets certifications and case studies, a teacher gets lesson plans, a developer gets coding projects. If you uploaded a resume, it won't suggest things you've already done.

**Outreach Assistant** — Drafts cold outreach messages (LinkedIn, email, DM) personalized to a specific person/company using your actual background and resume.

**Job Intelligence** — RAG-powered Q&A over job market data. Ask questions like "What skills are most in-demand?" or "What certifications come up the most?" and get answers grounded in real job posting data with source citations.

**Skill Simulator** — Add hypothetical skills and see how many new jobs unlock, how salary ceilings change, and whether skills have synergy together. Works for any field — add "ACLS certification" as a nurse or "PMP" as a project manager, not just tech skills.

### Other features

- **Welcome page** — Clean landing page with the app's value prop and feature overview. Shows once, then remembers you via localStorage.
- **Resume upload** — Upload a PDF resume. The app extracts the text, auto-fills your profile, and uses your full background across every tab for deeper personalization.
- **Multi-profile** — Store up to 5 profiles. Switch between them to compare how different backgrounds get different results.
- **Jobs / Internships filter** — Toggle between full-time jobs, internships, or all on the Job Matches tab.
- **Confidence badge** — Every AI response shows a data-grounding indicator. Intelligence tab shows "87% grounded in data" (calculated from average cosine similarity of retrieved documents). Job Matches shows how many live postings were analyzed.
- **Auto-refresh index** — One-click button in the Intelligence tab to sync fresh job postings from Adzuna into the vector database. Type any keyword (nursing, marketing, etc.), hit Fetch & Index, and ChromaDB updates live.
- **Profile persistence** — Profiles save to localStorage so they survive page refreshes.
- **Tab state preservation** — Switch between tabs without losing your results. Switching profiles resets everything fresh.
- **Works for all careers** — Not just tech. Placeholders, suggestions, prompts, and seed data cover healthcare, education, finance, trades, marketing, design, and more.
- **Soft skill handling** — Maps soft skills like "Leadership" and "Stakeholder Management" to role-based search terms (e.g., "manager", "product manager") for better Adzuna results instead of searching literally.

---

## Architecture

```
React Frontend (Vite, port 5173)
  |
  v
Express Backend (Node.js, port 3001)
  |           |
  v           v
NVIDIA NIM   FastAPI RAG Service (Python, port 8000)
(LLM API)     |           |
              v           v
           ChromaDB    Adzuna API
           (vectors)   (live jobs)
```

Express acts as an API gateway — the React frontend only talks to Express, and Express proxies to either the LLM or the Python RAG service depending on the request.

The RAG pipeline:
1. Job postings get embedded using sentence-transformers (all-MiniLM-L6-v2) and stored in ChromaDB
2. When a user asks a question, it's embedded into the same vector space
3. ChromaDB finds the most similar job postings via cosine similarity
4. Those postings get injected into the LLM prompt as context
5. The LLM generates an answer grounded in real data

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite |
| Backend | Node.js, Express |
| RAG Service | Python, FastAPI, ChromaDB, sentence-transformers |
| LLM | NVIDIA NIM (Llama 3.3 70B) via OpenAI-compatible SDK |
| Embeddings | all-MiniLM-L6-v2 |
| Live jobs | Adzuna API |
| Theme | Warm cream minimalist (Inter font) |

---

## Project structure

```
career-launchpad/
├── client/                          # React frontend
│   ├── src/
│   │   ├── App.jsx                  # Main app - welcome gate + 6 tabs + profile
│   │   ├── components/
│   │   │   ├── WelcomePage.jsx      # Landing page shown on first visit
│   │   │   ├── AgentChat.jsx        # AI agent chat - routes to right tool
│   │   │   ├── CareerCompass.jsx    # Job matches tab (with internship filter)
│   │   │   ├── PortfolioBuilder.jsx # Portfolio tab (adapts to any career)
│   │   │   ├── OutreachAssistant.jsx # Outreach tab
│   │   │   ├── JobIntelligence.jsx  # RAG Q&A tab
│   │   │   ├── SkillSimulator.jsx   # Skill sim tab
│   │   │   ├── ProfileContext.jsx   # Shared profile state + localStorage
│   │   │   ├── ProfilePanel.jsx     # Profile sidebar + resume upload
│   │   │   ├── AIContentRenderer.jsx # Renders markdown from LLM responses
│   │   │   ├── LoadingDots.jsx
│   │   │   └── Icons.jsx
│   │   ├── services/api.js          # All API calls
│   │   └── styles/app.css           # Warm cream minimalist theme
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                          # Express API gateway
│   ├── index.js                     # Server setup, middleware, routes
│   ├── routes/
│   │   ├── ai.js                    # GenAI endpoints + agent routing + resume parsing
│   │   └── rag.js                   # Proxies to Python RAG service
│   ├── services/llm.js              # NVIDIA NIM wrapper (OpenAI SDK)
│   ├── prompts/
│   │   ├── careerCompass.js         # Job matching prompt
│   │   ├── portfolioBuilder.js      # Portfolio prompt (multi-career)
│   │   └── outreachAssistant.js     # Outreach prompt
│   └── package.json
├── rag-service/                     # Python RAG microservice
│   ├── main.py                      # FastAPI endpoints
│   ├── rag_engine.py                # ChromaDB + embedding logic
│   ├── fetch_live_jobs.py           # Adzuna API client
│   ├── seed_data.py                 # Seeds the vector database
│   ├── data/job_postings.json       # 15 diverse sample jobs (tech, healthcare, education, finance, trades, etc.)
│   └── requirements.txt
├── .env.example
├── .gitignore
├── render.yaml                      # Render deployment config (2 services)
├── LICENSE
└── README.md
```

38 files across 3 services.

---

## How to run

### Prerequisites

- Node.js 18+
- Python 3.10+
- NVIDIA NIM API key (free at [build.nvidia.com](https://build.nvidia.com))
- Adzuna API keys (free at [developer.adzuna.com](https://developer.adzuna.com))

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/career-launchpad.git
cd career-launchpad
cp .env.example .env
# Fill in your API keys in .env
```

### Terminal 1: Python RAG service

```bash
cd rag-service
pip install -r requirements.txt
python seed_data.py          # one-time - seeds ChromaDB with diverse job data
uvicorn main:app --reload --port 8000
```

### Terminal 2: Express backend

```bash
cd server
npm install
npm run dev
```

### Terminal 3: React frontend

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Running on Google Colab

The project can run entirely on Google Colab (free CPU runtime - no GPU needed). A Colab notebook is included that:
1. Installs Node.js 18 + Python packages
2. Seeds the vector database
3. Builds the React frontend
4. Starts all 3 services
5. Creates a public URL via Cloudflare tunnel (no account needed)

See `Career_Launchpad_Colab.ipynb` for step-by-step instructions.

### Deploying on Render (permanent hosting)

The project includes a `render.yaml` blueprint for deploying to Render.com (free tier). Two web services:
1. Express + React (Node runtime) - builds the frontend, serves it alongside the API
2. FastAPI RAG service (Python runtime) - seeds the database on build, runs uvicorn

Set `RAG_SERVICE_URL` on the Express service to point at the Python service's Render URL. Both services need `NVIDIA_API_KEY`, and the Python service needs `ADZUNA_APP_ID` + `ADZUNA_APP_KEY`.

---

## API endpoints

### GenAI (Express -> NVIDIA NIM)

| Method | Endpoint | What it does |
|--------|----------|-------------|
| POST | /api/ai/career | Fetches live jobs + LLM analysis (supports job_type filter) |
| POST | /api/ai/agent | AI agent - routes user message to the right tool |
| POST | /api/ai/portfolio | Generates portfolio roadmap (adapts to any career) |
| POST | /api/ai/outreach | Drafts outreach messages |
| POST | /api/ai/parse-resume | Extracts text from PDF resume |

### RAG (Express -> Python -> ChromaDB -> NVIDIA NIM)

| Method | Endpoint | What it does |
|--------|----------|-------------|
| POST | /api/rag/query | Full RAG pipeline (retrieve + generate) |
| POST | /api/rag/search | Raw semantic search |
| GET | /api/rag/stats | Database statistics |
| POST | /api/rag/fetch | Fetch + index live jobs from Adzuna |
| POST | /api/rag/discover | Find jobs matching a user profile (supports job_type) |
| POST | /api/rag/simulate | Skill simulation (before/after comparison) |

---

## What I learned building this

- How RAG works end-to-end - embedding, vector search, augmented generation
- The difference between just calling an LLM vs grounding it in real data
- How to design prompts that produce consistent, structured output
- Building a microservice architecture (React, Express, FastAPI)
- Working with vector databases (ChromaDB) and embedding models
- Integrating external APIs (Adzuna for live jobs, NVIDIA NIM for LLM)
- Making AI features work across different professions, not just tech
- Building an AI agent that routes user intent to the right backend tool

---

## Possible improvements

- Interview prep (generate practice questions from a specific job posting)
- Resume tailoring per job (rewrite bullets to match a posting)
- Skill roadmap visualization (radar chart showing you vs job requirements)
- Save job matches and track applications
- User authentication + database for full persistence across devices

---

## License

MIT
