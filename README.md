# DevPath (working name)

A GenAI-powered learning platform with interactive mini-courses on software engineering and on building software with AI coding agents. Content and feedback adapt to each learner's background (non-CS major, CS student, CS graduate, career switcher), goal and preferred language.

This is the prototype for the week 8–9 project discussion meeting.

## What works now

| Area | Status |
|---|---|
| Learner profile (background, experience, goal, language) | ✅ saved in the browser, synced to Supabase when signed in |
| 2 courses, 6 lessons | ✅ `src/content/courses/` |
| Quiz, ordering mini-game, code-review bug hunt | ✅ |
| AI tutor side panel (knows the lesson, adapts to the profile) | ✅ `/api/tutor` (streaming) |
| AI role-play: requirements interview with a café owner, plus scored debrief | ✅ `/api/roleplay` |
| Prompt lab: write a spec for a coding agent, get rubric feedback | ✅ `/api/prompt-lab` |
| Progress dashboard | ✅ `/dashboard` |
| Magic-link sign-in (Supabase) | ✅ only when Supabase env vars are set |
| Instructor tools (edit courses, AI course generator, import students, engagement) | ⏳ next phase, `activity_events` table already records engagement |

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

### Supabase

1. Create a project at supabase.com.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Under Authentication → URL Configuration, add `http://localhost:3000/auth/callback` (and your Vercel URL + `/auth/callback`) to the redirect URLs.
4. Copy the project URL and anon key into `.env.local`.

### Deploy to Vercel

Import the GitHub repo in Vercel and add the same environment variables in Project Settings → Environment Variables.

## Project structure

```
src/
  app/                 pages and API routes
    api/tutor          AI tutor (streams text)
    api/roleplay       role-play persona + structured debrief
    api/prompt-lab     rubric feedback (structured output)
  components/          UI; components/blocks = one component per activity type
  content/courses/     course content as typed data
  lib/
    ai/gemini.ts       Gemini client, learner description, streaming + JSON helpers
    learner-store.tsx  profile + progress (localStorage, Supabase sync)
    types.ts           shared types, including the lesson block schema
supabase/migrations/   database schema
```

## Adding a lesson

Lessons are lists of blocks (`text`, `quiz`, `ordering`, `code-review`, `roleplay`, `prompt-lab`) defined in `src/lib/types.ts`. Add a lesson object to a course file in `src/content/courses/` and it appears automatically. The same schema is what the planned AI course generator will output.
