# DevPath

**Lead a software project with AI on your team.**

DevPath is a learning platform built around immersive project simulations. The learner sits at a simulated macOS-style desktop and leads a small software project from first email to release: they interview a client, write requirements, brief an AI coding agent, review what it builds and decide how to ship. Every choice changes how the project ends, and each run finishes with a report on how the learner worked with AI, scored on the four AI Fluency competencies.

COMP5241 group project, The Hong Kong Polytechnic University.

## How a project works

Every project runs on the same desktop with six apps. The client, the problem and the stakes change from project to project; the workflow stays the same.

| App | What the learner does |
|---|---|
| Mail | Reads the brief: the client's request, a ticket from the users and a note from the manager. Makes the first move. |
| Meet | Interviews the client, who only reveals what the learner asks about. |
| Notes | Writes the requirements, including how everyone will know the work succeeded. |
| Cody | Briefs the AI coding agent, which builds exactly what the brief says, gaps and all. |
| Review | Reviews a pull request (tech lead) or a walkthrough (product lead), and approves it or sends it back with a reason. |
| Launch | Chooses how to release, then sees the outcome. |

The run ends with a project report: the outcome (success, partly there or it went wrong) and four cards, one per AI Fluency competency (Delegation, Description, Discernment, Diligence), each built from evidence in what the learner actually did.

## Design: a written story, with AI only where it counts

Fully AI-driven role-play drifts, costs tokens on every turn and can't be graded consistently. Fully scripted simulations can't react to what the learner writes. DevPath splits the difference:

- **The story is the skeleton.** Each project is authored data: facts the client knows, requirement and brief checklists, several versions of the agent's code, and endings. A deterministic state machine moves through it, so every learner faces the same situation and every run can be compared.
- **AI only at judgement nodes.** The client interview, the requirements and the brief are free text. An evaluator maps that text onto predefined outcomes (which fact the client reveals, which requirements are covered, which version of the code Cody writes), so AI output can never push the story off the script.
- **Who is AI and who is scripted.** The client and Cody respond to what the learner writes, so AI plays them. The manager and the users only react to decisions, so the script handles them.
- **Server-authoritative.** The browser sends one move at a time. The server applies it, saves the run and returns a view that never includes hidden facts, other code versions or the rules.

### Current status

| Area | State |
|---|---|
| Harbour Clinic booking board (two tracks, four code versions, several endings) | Done |
| macOS-style desktop, public home page and projects page | Done |
| Saved runs, restart, sign-in with GitHub or a magic link | Done |
| Evaluator for free text | Offline keyword evaluator. A Gemini evaluator (with the offline one as fallback) is next. |
| Teacher view of class results (read-only) | Planned |

## Tech stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS 4
- Supabase: Auth (GitHub OAuth and magic link) and Postgres with row-level security
- Google Gemini via `@google/genai`, server-side only (`src/lib/ai`, ready for the AI evaluator)
- zod for scenario and request validation
- Vercel for hosting

## Architecture

```
Browser (desktop UI)                Server                              Supabase
────────────────────                ──────                              ────────
POST /api/projects/[id]   ─────▶   route.ts: check sign-in, load run
{ op: "ask", question }            runtime.ts: apply the move
                                     ├─ evaluate.ts: free text → outcome
                                     └─ engine.ts: state machine step
                                   save with optimistic locking ─────▶  simulation_sessions
                          ◀─────   projectView(): public view only
```

- `src/lib/projects/catalog.ts` holds the public listing for each project. It is the only scenario file client components may import.
- Each scenario module (for example `harbour-clinic.ts`) holds the full script and is parsed with zod when it loads.
- `src/lib/learning/simulation/` is the generic state machine. Scenario-only steps are marked `trigger: "system"`, so the browser cannot choose them directly.

## Project structure

```
src/
  app/
    (learn)/                 public pages: home, /projects, sign-in, auth callback
    (sim)/projects/[id]/     the full-screen desktop for one project
    api/projects/[id]/       start a run and apply each move
  components/
    home/                    light-band background, glass cards, scroll reveal
    projects/desktop/        desktop shell, windows, Dock, overlays and the six apps
    NavBar.tsx
  lib/
    projects/                scenario types, scenarios, runtime and evaluator
    learning/simulation/     generic state machine and schema
    ai/                      Gemini client and hourly AI quota
    supabase/                browser and server clients, API error mapping
    auth-store.tsx           signed-in user for client components
docs/scenarios/              scenario scripts
supabase/migrations/         database schema
tests/                       unit tests
```

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in `.env.local` before signing in:

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sign-in |
| `SUPABASE_SERVICE_ROLE_KEY` | Saving project runs (server only, never prefix it with `NEXT_PUBLIC_`) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | The AI evaluator, once it lands |

### Supabase

1. Create a project at supabase.com.
2. Run every file in `supabase/migrations` in filename order in the SQL editor.
3. Under Authentication → URL Configuration, add `http://localhost:3000/auth/callback` and each deployed origin plus `/auth/callback` to the redirect allow list.
4. To enable GitHub sign-in, create a GitHub OAuth app with the callback URL Supabase shows under Authentication → Providers → GitHub, and paste its client ID and secret there.

The migrations also contain the tables of the earlier course platform. The app no longer uses them; they are kept so existing data is not dropped.

### Deploying

Vercel deploys `main` automatically. Add the same environment variables under Project Settings → Environment Variables.

## Adding a project

1. Write the script in `docs/scenarios/`: facts, requirements, brief constraints, code versions and endings.
2. Add a public listing to `src/lib/projects/catalog.ts`. The home page and `/projects` pick it up automatically.
3. Add the scenario module under `src/lib/projects/` and register it in `src/lib/projects/index.ts`.
4. Add tests in `tests/projects.test.ts` that reach each ending.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run test:postgres` | Apply the migrations to a local Postgres and check the policies |
