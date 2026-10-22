# DevPath (working name)

A GenAI-powered learning platform with interactive mini-courses across subjects. Learners set a preferred language, a general goal and a learning style; course-level experience can differ per subject. AI feedback and the tutor adapt to those preferences rather than to a computer-science background label.

This is the prototype for the week 8–9 project discussion meeting.

## What works now

| Area | Status |
|---|---|
| Learner preferences (name, language, goal, learning style) | ✅ saved locally, synced to Supabase when signed in |
| Course-level experience and goal | ✅ optional per-course preference, stored separately |
| 2 courses, 6 lessons | ✅ `src/content/courses/` |
| Quiz, ordering, code-review bug hunt | ✅ |
| AI tutor side panel (knows the lesson, adapts to the profile) | ✅ `/api/tutor` (streaming) |
| Guided response and conversation activities with rubric feedback | ✅ `/api/activities` |
| Declarative simulations (AI-designed or hand-written) | ✅ stateful branching with server-owned state, rubric feedback and two cross-domain demos |
| Teacher workspace: course editor, AI builder, students and invitations | ✅ `/teach` (instructor role required) |
| Personal courses for learners | ✅ `/my-courses` |
| Progress dashboard | ✅ `/dashboard` |
| Magic-link sign-in (Supabase) | ✅ only when Supabase env vars are set |

AI tutor, course builder and AI activity feedback require a signed-in account. The shared hourly quota is checked in Postgres. Deterministic activities in the static catalogue can be practised as a guest; those results are not saved.

## Tech stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- Supabase (Auth + Postgres with row-level security)
- Google Gemini API via `@google/genai` (model set by `GEMINI_MODEL`, default `gemini-3.5-flash-lite`), called only from server routes so the key never reaches the browser
- Deploy target: Vercel

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

`GEMINI_API_KEY` is required for the AI features. Without Supabase variables the app still runs and stores progress in the browser.

### Fresh Supabase project

1. Create a project at supabase.com.
2. In the SQL editor, run every file in `supabase/migrations` in this order:
   - `0001_init.sql`
   - `20261022050613_general_learning_platform.sql`
   - `20261022180000_review_fixes.sql`
   - `20261022203000_quota_params_and_owner_read.sql`
   - `20261022235900_learning_preferences.sql`
   - `20261023090000_simulation_sessions.sql`
3. Copy the project URL, the anon key and the service role key into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; never prefix it with `NEXT_PUBLIC_`)
4. Under Authentication → URL Configuration, add `http://localhost:3000/auth/callback` and each deployed origin plus `/auth/callback` to the redirect allow list.
5. Sign up, then grant the instructor role in the SQL editor. The app cannot assign this role itself:

```sql
update public.profiles set role = 'instructor' where id = '<user-uuid>';
```

AI features (tutor, course builder and AI activity feedback) require that sign-in. Without the service role key, lesson completion and saved attempts are not recorded.

### Deploy to Vercel

Import the GitHub repo in Vercel and add the same environment variables in Project Settings → Environment Variables.

## Project structure

```
src/
  app/
    (learn)/           learner shell: courses, my-courses, dashboard, auth
    (teach)/teach/     instructor workspace: dashboard, courses, students, invitations
    studio/            compatibility redirect into the teaching workspace
    api/tutor          AI tutor (streams text)
    api/activities     activity submission, deterministic + AI evaluation, attempts
    api/courses        course CRUD with ownership and publication checks
    api/builder        outline, lesson and simulation design generation
    api/simulations    server-authoritative simulation start/choose/restart
    api/enrolments     invitation claiming and enrolment
  components/          UI; components/learning = activity views and studio panels
  content/courses/     static catalogue and the shared authoring helpers
  lib/
    ai/gemini.ts       Gemini client, learner description, streaming + JSON helpers
    learning/registry.ts  activity schemas, defaults, editors, renderers, evaluators
    learning/simulation/  declarative DSL, validation, server engine, feedback
    learning/studio/   course editor state hook and panels
    types.ts           shared read/catalogue types
supabase/migrations/   database schema
```

## Adding a lesson

Lessons contain ordered activities defined by the registry in
`src/lib/learning/registry.ts`. Each activity is validated, editable and rendered
through the same definition. Static courses use the helpers in
`src/content/courses/authoring.ts` (`reading`, `choice`, `quiz`, `ordering`,
`codeReview`, `response`, `conversation`, `simulation`); the same envelope is what the course
builder stores in the database. To add a new activity type, add its schema,
defaults, editor/renderer and optional evaluator to the registry.

### Simulations

A `simulation` activity is a Zod-validated declarative scenario: bounded state
variables, stages, actions with availability conditions, effects, an optional
next stage, completion rules and a rubric. The server owns the state; clients
send only an action id. There is no generated JavaScript, expression evaluator,
`eval` or external call. AI can design the structure in the course studio, but
the teacher reviews it, and the deterministic engine works without AI.

See the architecture document for the DSL and the two demo scenarios
(requirement prioritisation and supplier negotiation).

## Teaching workspace and course studio

The instructor workspace lives at `/teach` and requires the instructor role.
A course opens at `/teach/courses/[id]` with Overview, Curriculum, Students,
Preview and Settings tabs; the AI builder and manual editor share the Curriculum
tab. Learners can still create and edit personal courses at `/my-courses` using
the same editor component. `/studio` is a compatibility redirect for old links.

The editor is split into a state hook (`lib/learning/studio/useCourseStudio.ts`)
and focused panels (`components/learning/studio/`), so curriculum editing, AI
generation and publishing can evolve independently. Software engineering remains
an example teaching domain, not a requirement of the platform model.

See [architecture, migration, permissions, limits and demo instructions](docs/GENERAL_LEARNING_PLATFORM.md).
