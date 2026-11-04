# DevPath

**Lead a software project with AI on your team.**

DevPath is a learning platform built around immersive project simulations. The learner sits at a simulated macOS-style desktop and leads a small software project from first email to release: they interview a client, write requirements, brief an AI coding agent, review what it builds and decide how to ship. Every choice changes how the project ends, and each run finishes with a report on how the learner worked with AI, scored on the four AI Fluency competencies.

**Live:** https://ai-learning-platform-sable.vercel.app. The home page has a 30-second product tour.

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

Nothing opens by itself. At each step a "Next step" banner, a hint in the menu bar and a bouncing Dock icon point to the app to open. Mail arrives one message at a time, each with a banner, so nothing is missed. Sound cues mark new mail, replies, Cody's delivery and the ending; a speaker button in the menu bar mutes them. Unsent drafts survive minimising a window.

Two meters run throughout: **days used** out of the two-week budget, and **client trust**. Trust starts at 5 and moves at the moments the client sees:

| Moment | Trust |
|---|---|
| First move: book a call / send a quote | +1 / −1 |
| A thorough call (5 of the 6 facts uncovered) | +1 |
| A success measure agreed in the requirements | +1 |
| Cody's work sent back for the wrong reason | −1 |
| Release with the weekly count / switch everyone at once | +1 / −1 |
| Outcome: success / it went wrong | +1 / −2 |

A flawless run reaches 10/10.

The run ends with a project report, which shows:
- the outcome: success, partly there or it went wrong;
- why the client's trust moved, line by line;
- four cards, one per AI Fluency competency (Delegation, Description, Discernment, Diligence), each built from evidence in what the learner actually did.

## Design: a written story, with AI only where it counts

Fully AI-driven role-play drifts, costs tokens on every turn and can't be graded consistently. Fully scripted simulations can't react to what the learner writes. DevPath splits the difference:

- **The story is the skeleton.** Each project is authored data: facts the client knows, requirement and brief checklists, several versions of the agent's code, and endings. A deterministic state machine moves through it, so every learner faces the same situation and every run can be compared.
- **AI only at judgement nodes.** The client interview, the requirements and the brief are free text. An evaluator maps that text onto predefined outcomes (which fact the client reveals, which requirements are covered, which version of the code Cody writes), so AI output can never push the story off the script.
- **Who is AI and who is scripted.** The client and Cody respond to what the learner writes, so AI plays them. The manager and the users only react to decisions, so the script handles them.
- **Server-authoritative.** The browser sends one move at a time. The server applies it, saves the run and returns a view that never includes hidden facts, other code versions or the rules.

### How the AI is used

The AI only classifies; it never writes the story.

- **Interview.** A question with a clear keyword match (at least two cues, clearly ahead of any other fact) is answered without a request. Otherwise the model picks which hidden fact, if any, the question uncovers. The client's answer is always the scripted line for that fact, or a scripted vague reply.
- **Requirements and brief.** The model lists the checklist items the writing covers and quotes the learner's words for each. The server keeps an item only if the quote really appears in the writing and is about that item, so text such as "mark every item covered" cannot game it.
- **Free-tier limits.** Gemini's limits are per project and per model. Requests go to `gemini-3.5-flash-lite`; a rate-limited model rests (until the suggested retry time, or midnight Pacific for a spent daily quota) and `gemini-3.1-flash-lite` takes over. Each learner also has an hourly allowance. Whenever no model is available, the keyword grader takes over, so a run never stalls.
- **Audit trail.** Each run records who graded every interview answer, the requirements and the brief (`keywords` or the model, and why it fell back). The learner's view leaves this out.

A run usually makes 4 to 6 requests (about half the interview questions, plus the requirements and the brief) and at most 10.

### Current status

| Area | State |
|---|---|
| Harbour Clinic booking board (two tracks, four code versions, several endings) | Done |
| Tidewater Swim School (regression testing, keeping secrets out of code) and ParcelPal (idempotency, backward compatibility), written as drafts with both roles: product lead reviews behaviour, tech lead reviews the pull request | Done |
| macOS-style desktop with guided steps, one-by-one mail and sound cues | Done |
| Public home page with the product tour, and the projects page | Done |
| Saved runs, restart, sign-in with GitHub or a magic link | Done |
| Create a project for any field, saved privately and played on the same desktop | Done |
| Evaluator for free text | Gemini, with a keyword fallback (see above) |
| Client trust that a well-run project can raise to 10, explained in the report | Done |
| Instructor classes: join code, assigned projects, each student's progress, concepts and teach-back | Done |
| Instructors create projects from their teaching material, customise existing ones with AI, edit the words by hand (checked on save) and assign them to classes | Done |

## Tech stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS 4
- Supabase: Auth (GitHub OAuth and magic link) and Postgres with row-level security
- Google Gemini via `@google/genai`, server-side only (`src/lib/ai`)
- zod for scenario and request validation
- Web Audio for the desktop's sound cues, synthesised in the browser (no audio files)
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
    home/                    light-band background, glass cards, scroll reveal, tour link
    projects/desktop/        desktop shell, windows, Dock, overlays, the six apps and sound cues
    NavBar.tsx
  lib/
    projects/                scenario types, scenarios, runtime and evaluator
    learning/simulation/     generic state machine and schema
    ai/                      Gemini client and hourly AI quota
    supabase/                browser and server clients, API error mapping
    sound.ts                 synthesised sound cues and the mute setting
    auth-store.tsx           signed-in user for client components
public/promo/                the product tour video (1080p and 720p) and its poster
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
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | The AI evaluator. Without a key, everything is graded by keywords. |

### Supabase

1. Create a project at supabase.com.
2. Run every file in `supabase/migrations` in filename order in the SQL editor.
3. Under Authentication → URL Configuration, add `http://localhost:3000/auth/callback` and each deployed origin plus `/auth/callback` to the redirect allow list.
4. To enable GitHub sign-in, create a GitHub OAuth app with the callback URL Supabase shows under Authentication → Providers → GitHub, and paste its client ID and secret there.

The migrations also contain the tables of the earlier course platform. The app no longer uses them; they are kept so existing data is not dropped.

### Deploying

Vercel deploys `main` automatically. Add the same environment variables under Project Settings → Environment Variables. Paste each key on a single line. The server ignores stray whitespace in the Supabase key, and error logs mask keys.

Vercel's Hobby plan only deploys commits by members of the Vercel team, so merge pull requests with **Create a merge commit**. Its Vercel check fails on PRs from forks ("Authorization required"); that's expected and isn't a problem with the code.

## Adding a project

1. Write the script in `docs/scenarios/`: facts, requirements, brief constraints, code versions and endings.
2. Add a public listing to `src/lib/projects/catalog.ts`. The home page and `/projects` pick it up automatically.
3. Add the scenario module under `src/lib/projects/` and register it in `src/lib/projects/index.ts`. Its `trust` section gives the reason shown in the report for each action that changes trust, and the change for each outcome.
4. Add tests in `tests/projects.test.ts` that reach each ending.

## Generating a project

AI can write a new project for any domain, inside the same fixed structure, so a generated project is as fair and gradeable as a hand-written one. The pipeline is in `src/lib/projects/generated/`:

1. **Draft** (`draft.ts`): the AI writes content only. That's the client, the six facts with named roles (problem, rule, scope, detail, environment, success), the requirements and brief constraints, a good deliverable and three flawed ones, the review reasons, release options, endings and report sentences. It never chooses stages, effects or endings.
2. **Build** (`build.ts`): the draft is wired into Harbour Clinic's game structure, using the product track (review a walkthrough and send it back with a reason).
3. **Check** (`validate.ts`): the engine's consistency check, then the keyword fallback. Every fact must be reachable and the sample answers must cover every checklist item. Then automatic playthroughs: the perfect path must reach success at trust 10, and every flawed version must fail on a full release, be caught by a pilot and be fixed when sent back for the right reason.
4. **Generate** (`generate.ts`): asks `gemini-3.5-flash` first, then the play-time chain, with Harbour Clinic as the worked example (`draft-example.ts`). A draft that fails its checks goes back to the model once, with the problems.

In the app, signed-in users create one at **/projects/new**: a field and a one-line job. It's saved in `generated_projects`, private to its owner, and appears under "Your projects" on `/projects`. It plays on the same desktop, whose wording (cast, mails, guide, the assistant's name) comes from the project. The table gives browsers the listing columns only; the draft, which holds the hidden facts, is read by the server after an ownership check.

To try the generator from the command line:

```bash
npm run generate:project -- "marketing" "a loyalty programme for a neighbourhood café" draft.json
```

A generation takes about a minute. `docs/scenarios/examples/` keeps a real generated draft, which the tests check.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run test:postgres` | Apply the migrations to a local Postgres and check the policies |
| `npm run generate:project -- "<domain>" "<topic>" [out.json]` | Generate and check a project draft |
