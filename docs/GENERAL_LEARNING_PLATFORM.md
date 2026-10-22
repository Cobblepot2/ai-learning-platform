# DevPath general-purpose learning platform

## Architecture review and decisions

The upstream prototype (8c0ecbea) had two static software-engineering courses, a
six-member block union, a renderer switch, static-only AI lookups and no teaching
studio or course/enrolment storage. `profiles: own row` permitted users to update
`role`. Learner progress also merged account data with a shared local cache.

This branch retains Next.js 15, React, Tailwind, Supabase and Gemini. It adds a
small course document model rather than a plugin framework:

- `courses`: owner, publication status, visibility, revision and a validated JSONB
  course document. Status/access are authoritative database columns, not AI data.
- Course: title, domain, description, target audience, prerequisites, objectives,
  language, level, estimated duration, ordered lessons.
- Lesson: stable ID, title, summary, duration, objectives and ordered activities.
- Activity block: `{type:'activity', id, version:1, activityType, config, objectives?}`.
- `learning_attempts`: immutable server-written responses, activity snapshots,
  course revision, qualitative feedback and optional quiz score. Each improvement
  is another attempt. Lesson completion is derived from recorded submissions.
- `course_enrolments` and `course_invitations`: course-specific access and roster.

`Course`/`Lesson` remain the read shape used by catalogue and lesson pages, but
every `LessonBlock` is now an Activity envelope. The static catalogue and the
presentation demos were converted to that model, and the six legacy block
renderers were removed. `legacy.ts` only fills metadata defaults for static
courses; it no longer translates block shapes. `repository.ts` reads static
courses and database courses through the same activity validator, subject to
RLS.

## Activity registry

`src/lib/learning/registry.ts` owns validators, defaults, descriptions and
renderer/editor/evaluation metadata. Supported activities:

| Type | Purpose | Evaluation |
| --- | --- | --- |
| reading | Markdown teaching material | No score or required response |
| choice | One multiple-choice question | Deterministic answer + explanation |
| quiz | Several multiple-choice questions | Deterministic score per question |
| ordering | Put steps in a working order | Deterministic comparison |
| code-review | Find the planted line in a code sample | Deterministic line check |
| response | Writing, reflection, scenario or roleplay | Evidence-based rubric feedback and next step, no numeric score |
| conversation | Multi-turn character conversation | Character reply plus rubric feedback once the minimum turns are met |

`response` and `conversation` are the only types that call a model. The next
submission includes recent attempts, so students can clarify, revise and improve.
This is not a branching simulation engine. No AI-supplied React/JavaScript is
executed.

Deterministic activities in static catalogue courses can be practised without
an account; their feedback is returned but not written to the gradebook.
Database courses and all AI-backed feedback require a signed-in account.

To add an activity, add its validator/defaults/capabilities and an envelope to
`activitySchema`, then supply its view/editor and optional server evaluator.
`CourseStudio` lists registered definitions and uses the common field editor;
it does not need a new course-level workflow. Special interactions may need a
specialised editor/view. The registry is intentionally compile-time, not a
third-party plugin loader. Invalid types, versions and configs fail validation.

## Learner preferences

`/onboarding` collects only cross-subject preferences: an optional display name,
preferred language (`en`, `zh-Hans`, `zh-Hant`), a general goal and a learning
style. Every field has a sensible default, so the page can be skipped. The old
`zh` value is read as `zh-Hant`, which matches its previous label.

Course pages offer an optional, collapsed per-course setting for experience and
goal. It is stored in `course_learner_preferences` (one row per learner and
course) and never changes another course. Learners without any preferences get
the same balanced beginner defaults.

Legacy `background` and `experience` columns are retained and readable, but the
tutor no longer uses them to infer subject knowledge. New saves write the
learning-style column only when provided and leave legacy columns untouched.

The tutor context combines preferred language, learning style, general goal and
the current course's experience/goal. Course-level values override the general
goal when both exist; missing preferences fall back to clear English and a
balanced style rather than blocking learning.

## Teacher workflow

1. Sign in as an administrator-assigned instructor; open `/teach`. Non-teachers
   are redirected to sign-in or shown the instructor-access message.
2. Create a blank course or an optional Software Engineering/English example from
   `/teach/courses/new`.
3. Open a course at `/teach/courses/[id]`. The workspace tabs are Overview,
   Curriculum, Students, Preview and Settings; the editor lives under Curriculum.
4. Edit metadata, add/remove/reorder lessons and activities, change activity type,
   and edit its configuration. Text-only lessons can be published.
5. AI builder: define goals/audience/difficulty/requirements/reference text/length/
   language; generate and edit an outline; approve it; generate lesson content.
6. Review the proposed course. Accept into the editor or reject. Generation does
   not save or publish automatically. A failed multi-lesson generation cannot be
   accepted as a complete proposal.
7. Request a local AI revision. Compare before/after, edit the proposal, accept or
   reject. Acceptance preserves the original activity ID and detects stale edits.
8. Save, preview with the actual student renderer, then explicitly publish with
   public or enrolled access in Settings. Preview feedback does not create learner
   records.
9. Import student email addresses in Students. This stores invitations; it does
   **not send email**. Cross-course invitations are listed at `/teach/invitations`.
   Students sign in with their confirmed email and select Join invited courses in
   `/my-courses`.
10. Inspect participation, current-lesson completion, quiz attempts and qualitative
    evidence per course or per student; `/teach/students` aggregates across
    courses. The teacher reads only their own courses' student data.

Students can use `/my-courses` to create and edit personal courses using the same
builder service. They can order lessons as their learning path. Database and
server checks prevent publishing or sharing these private courses.

## Database and deployment

1. Install Node.js 20.19+ (tested with Node 24), then `npm ci`.
2. Apply every file in `supabase/migrations` in filename order, on a **staging
   project first**: `0001_init.sql`, `20261022050613_general_learning_platform.sql`,
   `20261022180000_review_fixes.sql`,
   `20261022203000_quota_params_and_owner_read.sql`, then
   `20261022235900_learning_preferences.sql`. Each migration is
   transactional and preserves existing profiles/progress. The README has the
   fresh-project checklist (service role key, instructor grant, `/auth/callback`).
3. Configure `.env.local` (or deployment environment):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — server only, never `NEXT_PUBLIC_`.
   - `GEMINI_API_KEY` — server only.
   - `GEMINI_MODEL` — use a model enabled in your Google project; the upstream
     default is preserved, not independently validated against a live account.
4. Configure Supabase Auth redirect URLs for `/auth/callback` on the deployment.
5. Sign up teacher and student accounts. From the trusted Supabase SQL editor,
   assign the instructor role to the verified teacher UUID:
   ```sql
   update public.profiles set role = 'instructor' where id = '<teacher-uuid>';
   ```
   Never expose this operation in a client profile form. Review **all existing
   privileged profile roles** before deployment: the old policy allowed changes,
   and this migration cannot determine whether an earlier role was legitimate.
6. `npm run typecheck && npm run lint && npm test && npm run build`.
7. Deploy this branch as a preview with the same server environment variables.
   No live database, hosted deployment or main branch has been changed here.

Without Supabase the original local demos still work. New course creation fails
explicitly rather than pretending to save. Without the service key, interactive
results are not marked saved. Without Gemini, manual editing, publication and
quiz evaluation work; AI generation/feedback report the missing configuration.

## Permission design

- Role columns are denied to ordinary insert/update/upsert requests. Users cannot
  delete/recreate their profile to assign roles. Student private-course rules
  are enforced both by APIs and RLS.
- Internal definer lookup helpers are in `private`, have fixed search paths and
  explicitly limited execute grants. They derive identity from `auth.uid()`.
- The one public definer RPC claims invitations using only the signed-in user's
  **confirmed email** from `auth.users`; it accepts no user/email arguments.
- Course reads, AI context and student responses use the caller's cookie-based
  Supabase client. Service-role writes occur only after user-scoped authorization.
- Browser inserts/updates/deletes of learning evidence are revoked. Dynamic
  lesson completion cannot be written through the legacy progress table API.
- Every generated record stores an activity snapshot and course revision; later
  editing does not silently rewrite past evidence. Completion checks current
  activity configs. Legacy demos retain their original self-reported progress.

## Demonstration script

### A — Software Engineering

1. Teacher: Start Software Engineering example; explain the objective and the
   shared Reading/Guided response components.
2. In AI builder, set topic to requirements interviews and ask for a short clinic
   stakeholder conversation. Edit the outline before generating content.
3. Accept and manually refine the scenario/rubric. Save, preview, then publish
   for invited students. Import the student's confirmed email.
4. Student: Join invited courses; open the published lesson. Ask context-based
   questions, receive a character reply plus rubric evidence, then submit an
   improved question or decision. Mark the lesson complete.
5. Teacher: Refresh results and show both attempts and improvement suggestions.

### B — English Communication

Repeat using Start English example, or generate an English workplace negotiation
course. Use goals about polite clarification, acknowledging scheduling constraints
and proposing a feasible compromise. Keep Reading and Guided response; no code
component or quiz is required. Publish, submit a response, revise, complete and
show the teacher's feedback record. Both scenarios use identical routes, schema,
registry, editor and persistence.

The original software engineering and AI coding agent courses remain available
and contain the required course-project teaching domains, including stakeholder
communication/product decisions. Their contents are examples, not platform rules.

## Limits and validation scope

- No live Supabase/Gemini credentials were supplied, so live cloud generation,
  delivery latency, Auth email confirmation and hosted RLS advisors still require
  a staging smoke test. Local SQL tests execute the actual migration in PGlite.
- Browser tests use explicitly mocked cloud APIs for the teacher workflow. They
  complement, rather than replace, database permission tests and live acceptance.
- Reference materials currently accept pasted text, not file uploads or URL
  retrieval. No email delivery, school-wide administration or arbitrary simulation
  runtime is included. No collaborative editing UI; conflicting saves return 409.
- AI feedback is formative, not high-stakes grading. It is based on supplied
  content/rubrics and student responses but can still be wrong.
- Add deployment-specific distributed AI rate limits/budgets before opening this
  prototype to an untrusted public audience. Tutor, course builder, `response`
  evaluation and `conversation` replies require a signed-in account and
  `consume_ai_quota`. Deterministic activities in static catalogue courses are the
  only guest-evaluable path.
- Public course documents include quiz answer keys (as the old prototype did).
  This platform is not a secure examination system.
- Large course generation is sequential, one lesson per request. If generation
  fails, retry or author manually; no durable background job queue is included.
