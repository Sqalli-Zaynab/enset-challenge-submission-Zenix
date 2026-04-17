# Afaq - AI Career Guidance Platform

Afaq is an AI-assisted student orientation platform built for the ENSET Challenge final. It guides a student through a short interview, analyzes the profile, recommends career paths, connects the selected path to Moroccan schools/programs, generates a competency roadmap, matches opportunities, and exports a PDF report.

The implementation prioritizes demo stability: the main user journey is deterministic where it must be reliable, and AI/RAG components are used in controlled parts of the workflow.

## Overview

Afaq helps students who are unsure about their academic or career direction. Instead of asking the student to choose a domain upfront, the platform collects signals about interests, strengths, academic context, goals, work style, values, and opportunity preferences.

The final demo flow is:

1. Student enters the product from the landing page.
2. Student answers a finite guided interview in the chat UI.
3. Backend analyzes the profile.
4. Backend recommends up to 3 career paths.
5. Student chooses one career path.
6. System recommends relevant schools/programs for that selected path.
7. System generates a 30/60/90-day competency roadmap.
8. System matches relevant opportunities.
9. Student exports a branded PDF report.

The core result flow happens inside the same chat-style product screen. A separate `/results` page also exists and can render persisted result state, but the primary demo experience is the `/input` same-chat workflow.

## Key Features

- Clean Angular landing page and standalone product interview screen.
- Finite 8-question guided interview, designed to avoid endless AI loops.
- Same-chat orchestration for profile analysis, recommendations, study path, roadmap, opportunities, and PDF export.
- Human-in-the-loop checkpoints:
  - choose a career or regenerate recommendations
  - continue to roadmap, regenerate schools/programs, or choose another career
  - continue to opportunities, regenerate roadmap, or go back
  - export PDF, regenerate opportunities, or go back
- Central frontend state through `ProfileFlowService`.
- LangGraph-backed profile analysis and career recommendation modes.
- Deterministic career scoring from a structured local dataset of 16 career paths.
- Hybrid local/trusted retrieval for Moroccan study programs and opportunities.
- Demo-safe fallback datasets so critical screens do not depend fully on external services.
- Branded PDF export with profile snapshot, chosen career, study options, roadmap, and opportunities.
- Basic prompt-injection guardrails and rate limiting on the backend.

## Architecture

```mermaid
flowchart LR
  Student[Student] --> Angular[Angular Web UI]
  Angular --> Input[/input same-chat flow]
  Input --> Flow[ProfileFlowService]

  Flow --> Analyze[POST /api/profile/analyze]
  Flow --> Recommend[POST /api/career/recommend]
  Flow --> Plan[POST /api/plan/generate]
  Flow --> Pdf[PDF export service]

  subgraph Backend[Node.js + Express API]
    Analyze --> Graph[LangGraph workflow]
    Recommend --> Graph
    Graph --> ProfileNode[profileNode]
    Graph --> DiagnosisNode[diagnoseProfileNode]
    Graph --> CareerMatcher[career scoring node]
    CareerMatcher --> Careers[(careers.json)]

    Plan --> PlanController[deterministic plan controller]
    PlanController --> ProgramRetrieval[program retrieval service]
    PlanController --> OpportunityRetrieval[opportunity matching service]
    ProgramRetrieval --> Programs[(morocco-programs.json)]
    ProgramRetrieval --> Universities[(morocco-universities.json)]
    OpportunityRetrieval --> TrustedSources[(trusted opportunity sources)]
    OpportunityRetrieval --> FallbackOpps[(opportunities-fallback.json)]
    OpportunityRetrieval -. optional .-> Tavily[Tavily]
    CareerMatcher -. optional wording refinement .-> Groq[Groq]
  end
```

### Frontend

The frontend is an Angular 17 standalone-component application.

Important files:

- `frontend/src/app/pages/landing-page.component.*` - marketing landing page.
- `frontend/src/app/pages/input-page.component.*` - main same-chat guided workflow.
- `frontend/src/app/pages/result-page.component.*` - secondary persisted results view.
- `frontend/src/app/profile-flow.service.ts` - central state, persistence, and API orchestration.
- `frontend/src/app/profile-flow.types.ts` - shared frontend contracts.
- `frontend/src/app/shared/services/result-pdf-export.service.ts` - jsPDF report generation.
- `frontend/proxy.conf.json` - development proxy from Angular to the backend.

### Backend

The backend is a Node.js/Express API.

Important files:

- `backend/app.js` - Express entrypoint, middleware, route mounting, health route.
- `backend/src/routes/*.js` - API route definitions.
- `backend/src/controllers/*.js` - request handlers.
- `backend/src/services/ai.service.js` - wrapper around the LangGraph workflow.
- `backend/src/agent/graph.mjs` - LangGraph orchestration for analysis, recommendation, plan mode, and legacy/dynamic chat mode.
- `backend/src/services/career-recommendation.service.js` - deterministic career scoring and optional AI explanation refinement.
- `backend/src/services/morocco-program-retrieval.service.js` - Moroccan schools/programs retrieval and fallback ranking.
- `backend/src/services/opportunity-matching.service.js` - opportunity normalization, scoring, and fallback matching.
- `backend/src/services/trusted-opportunity-retrieval.service.js` - optional trusted-source retrieval through Tavily.
- `backend/src/middleware/guardrails.js` - basic prompt-injection detection and input sanitization.
- `backend/src/middleware/rateLimit.js` - general and AI endpoint rate limits.

## Core Workflow

### 1. Guided Interview

The `/input` page owns the main product experience. It uses a controlled 8-question interview:

1. What subjects or activities do you enjoy most?
2. What kind of work attracts you most?
3. What are you naturally good at?
4. What are you studying now, and what academic level are you in?
5. What matters most to you in a career?
6. What is your main goal right now?
7. Do you prefer analytical, practical, creative, or people-oriented work?
8. What type of opportunities interest you most?

This interview is frontend-controlled for live-demo reliability. It maps answers into the normalized `ProfileDraft` shape used by `ProfileFlowService`.

### 2. Profile Analysis

After the last answer, the frontend calls:

```http
POST /api/profile/analyze
```

The backend runs the LangGraph analysis path. It normalizes the profile, infers themes/readiness, and returns:

- `profile`
- `diagnosis`
- `agentTrace`

### 3. Career Recommendation

The frontend then calls:

```http
POST /api/career/recommend
```

The backend scores the local `careers.json` dataset and returns up to 3 recommendations. Each recommendation includes:

- career ID and title
- category
- match score
- confidence
- short description
- reasons and explanation
- skills and related fields
- resource links when available

The local dataset currently contains 16 career paths across technology, design, business, education, HR, industrial engineering, electronics, and entrepreneurship.

### 4. Human Career Selection

The user explicitly chooses one of the recommended paths in the chat. This is the main human-in-the-loop checkpoint. The system does not silently lock a final recommendation.

### 5. Study Path, Roadmap, and Opportunities

After career selection, the frontend calls:

```http
POST /api/plan/generate
```

The plan endpoint returns:

- selected career path
- Moroccan schools/programs
- 30/60/90-day roadmap
- matched opportunities
- explanation
- agent/retrieval trace

The current plan generation path is deterministic and controller-based for demo stability. It uses the selected career and analyzed profile to retrieve/rank relevant study options and opportunities.

### 6. PDF Export

The final PDF is generated in the browser with jsPDF. It includes:

- profile snapshot
- chosen career
- why the path fits
- alternative paths from the recommendation set
- recommended schools/programs
- 30/60/90-day roadmap
- matched opportunities with links

## Recommendation System

### Career Matching

Career recommendations are not generated freely by the LLM. The source of truth is:

```text
backend/src/data/careers.json
```

Each career contains:

- ID, title, category, descriptions
- core, technical, and soft skills
- related fields and keywords
- strength, cause, value, program, roadmap, and opportunity tags
- entry difficulty and location options
- O*NET/resource links when available
- roadmap steps

`career-recommendation.service.js` extracts profile signals and scores each career using deterministic matching. Optional AI refinement can improve wording only when explicitly enabled.

### Schools / Programs Retrieval

Study options are sourced from:

- `backend/src/data/knowledge/morocco-programs.json`
- `backend/src/data/knowledge/morocco-universities.json`

`morocco-program-retrieval.service.js` builds a query from the selected career and profile, ranks program-level matches, then falls back to university/school entries when needed.

Returned study options include:

- program
- school
- city
- degree level
- program link or school link
- source type
- relevance reason

### Opportunity Matching

Opportunities are sourced from:

- trusted source definitions in `trusted-opportunity-sources.json`
- approved source list in `trusted_sources.txt`
- local fallback catalog in `opportunities-fallback.json`

If `TAVILY_API_KEY` is configured, the backend can retrieve leads from trusted sources only. If Tavily is missing or retrieval is weak, the fallback catalog keeps the demo stable.

Matched opportunities include:

- title
- type
- provider
- source URL
- location and mode
- deadline when available
- skills and eligibility
- relevance explanation
- source type: `trusted-rag` or `fallback-local`

## RAG, AI, and Determinism

Afaq uses a hybrid approach:

- Deterministic local datasets are the source of truth for careers, schools/programs, roadmaps, and fallback opportunities.
- LangGraph orchestrates profile analysis and recommendation modes.
- Groq is optional and used only for refinement/legacy dynamic flows when configured.
- Tavily is optional and limited to trusted opportunity sources.
- Retrieval traces are returned in agent traces for jury/debug visibility.

This is best described as controlled lexical retrieval with curated fallback, not a vector-database RAG implementation.

## Human-In-The-Loop and Guardrails

Human validation is visible in the `/input` chat workflow:

- career choice before plan generation
- continue/regenerate/back controls after schools/programs
- continue/regenerate/back controls after roadmap
- export/regenerate/back controls after opportunities

Backend safety mechanisms currently include:

- prompt-injection pattern detection in `guardrails.js`
- HTML angle-bracket sanitization for top-level string fields
- general and AI-specific rate limiting
- trusted-source restriction for opportunity retrieval
- deterministic fallback datasets to avoid unsupported empty results

The current guardrails are lightweight and suitable for an MVP demo, not a complete production safety policy.

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend health check and optional service availability |
| `POST` | `/api/profile/analyze` | Analyze and normalize the student profile |
| `POST` | `/api/career/recommend` | Return up to 3 ranked career recommendations |
| `POST` | `/api/plan/generate` | Generate selected-path study options, roadmap, and opportunities |
| `POST` | `/api/plan/decision` | Validate a plan decision payload |
| `POST` | `/api/plan/confirm` | Alias for plan decision validation |
| `POST` | `/api/chat/message` | Legacy/dynamic LangGraph chat route, not the primary demo path |
| `GET` | `/api/eval/summary` | Lightweight in-memory evaluation summary |
| `POST` | `/api/eval/abtest` | Simple prompt A/B response comparison |
| `POST` | `/api/eval/finetune` | Simulated fine-tuning endpoint |

## Tech Stack

### Frontend

- Angular 17
- TypeScript
- Angular Router
- RxJS
- jsPDF
- Browser `localStorage`

### Backend

- Node.js with ES modules
- Express 5
- LangGraph
- LangChain Tavily integration
- Groq SDK
- Zod
- express-rate-limit
- dotenv
- Winston

## Project Structure

```text
.
|-- backend/
|   |-- app.js
|   |-- package.json
|   `-- src/
|       |-- agent/
|       |-- controllers/
|       |-- data/
|       |   |-- careers.json
|       |   |-- oportunities.json
|       |   `-- knowledge/
|       |-- middleware/
|       |-- routes/
|       |-- services/
|       `-- validators/
|-- frontend/
|   |-- angular.json
|   |-- package.json
|   |-- proxy.conf.json
|   |-- scripts/
|   `-- src/app/
|       |-- components/
|       |-- layout/
|       |-- pages/
|       |-- shared/
|       |-- profile-flow.service.ts
|       `-- profile-flow.types.ts
|-- package.json
`-- README.md
```

## Local Setup

### Prerequisites

- Node.js 18+ recommended
- npm

### Install Dependencies

From the repository root:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### Configure Environment

Create or update `backend/.env`:

```env
PORT=3000
NODE_ENV=development

# Optional. Main deterministic demo still works without this.
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# Optional. Used only for trusted opportunity retrieval.
TAVILY_API_KEY=

# Optional. Enables AI wording refinement for career explanations.
ENABLE_AI_CAREER_REFINEMENT=false
```

Do not commit real API keys.

### Run Backend

```bash
npm --prefix backend start
```

Backend default URL:

```text
http://127.0.0.1:3000
```

Health check:

```text
http://127.0.0.1:3000/health
```

### Run Frontend

In a second terminal:

```bash
npm --prefix frontend run start:frontend
```

Frontend default URL:

```text
http://127.0.0.1:4200
```

The Angular dev server proxies `/api/*` to `http://127.0.0.1:3000` using `frontend/proxy.conf.json`.

### One-Command Dev Wrapper

The frontend wrapper can start the backend automatically if port `3000` is not already reachable:

```bash
npm --prefix frontend start
```

### Build Frontend

```bash
npm --prefix frontend run build
```

## Demo Guide

1. Start the backend.
2. Start the frontend.
3. Open `http://127.0.0.1:4200`.
4. Click the landing page CTA to enter `/input`.
5. Answer the 8 guided interview questions.
6. Wait for profile analysis and career recommendations.
7. Select one of the 3 recommended careers.
8. Review schools/programs in the chat.
9. Continue to the competency roadmap.
10. Continue to matched opportunities.
11. Export the PDF report.

Recommended demo note: use the main `/input` same-chat workflow. The dynamic `/api/chat/message` route exists, but it is not the stable primary demo path.

## Current Limitations

- No authentication or user accounts.
- No database persistence; frontend state is stored in `localStorage`.
- No vector database; retrieval is lexical/curated with fallback data.
- Main interview is deterministic and finite for demo stability, not an open-ended LLM interview.
- Groq and Tavily are optional; missing keys trigger deterministic fallback behavior in the main flow.
- `/api/eval/*` is a lightweight demonstration service, not a full prompt-evaluation or fine-tuning pipeline.
- Backend CORS is currently open through `cors()` for local development.
- Guardrails are basic pattern-based checks, not a full security policy engine.

## Team

Built by Team Zenix for the ENSET Challenge Hackathon 2026.
