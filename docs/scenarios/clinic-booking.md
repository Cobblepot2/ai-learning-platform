# Scenario 1: Harbour Clinic booking board

Status: **implemented** in `src/lib/projects/harbour-clinic.ts`. Free-text nodes are graded by the offline evaluator for now; the Gemini evaluator is planned.

The learner leads a two-week job for a small clinic, working with an AI client, an AI coding agent and a scripted test report. The story, facts, code and consequences are all written in advance. AI is only used where the learner writes something open-ended, and every AI call returns a structured result that the server turns into a predefined outcome. The engine stays deterministic, and every run can be graded the same way.

All names (clinic, staff, studio, agent) are fictional.

## Learning goals (mapped to AI Fluency 4D)

| Goal | 4D | Where it is assessed |
|---|---|---|
| Decide what to hand to the AI and what to find out first | Delegation | Node 1, node 4 |
| Ask the client the questions that surface the real constraints | Description | Node 2 |
| Turn what you learned into requirements someone else can build from | Description | Node 3 |
| Give the coding agent a task with the constraints that matter | Description, Delegation | Node 4 |
| Review the agent's code or behaviour and catch what it got wrong | Discernment | Node 5 |
| Decide how to test and release, and how to know it worked | Diligence | Node 6 |

## Two tracks, one story

| | Product track (non-CS) | Engineering track (CS) |
|---|---|---|
| Learner's role | Product lead at the studio | Tech lead at the studio |
| Node 4 | Writes the task in plain language | Same, plus is expected to ask for a test |
| Node 5 | Reviews a scripted **behaviour demo** of the agent's build | Reviews the agent's **pull request diff** |
| Wording | No jargon in prompts or feedback | Uses engineering terms |

Everything else (facts, branches, endings) is shared, so the teacher can compare both groups.

## Cast

- **Ms. Grace Wong**, practice manager at Harbour Family Clinic. Friendly, busy, not technical, budget-conscious. Played by AI in node 2, limited to the fact list below.
- **Mandy and Kit**, the two receptionists. Only appear in emails and tickets.
- **Leo**, the learner's manager at the studio. Sets the budget.
- **Cody**, the AI coding agent. Never generates code live; the server picks one of the prepared versions.
- **QA report**: a scripted test and pilot report, no AI.

## Hidden facts (the client's knowledge)

The AI client may only reveal these, and only when a question reasonably leads to them. The AI returns which fact ids it revealed in each reply, so the server knows exactly what the learner has uncovered.

| id | Fact | Typical question that unlocks it |
|---|---|---|
| F1 | Double bookings happen when Mandy and Kit edit the shared spreadsheet at the same time, mostly 8:30–9:30. | "When does it go wrong?" / "Who books appointments?" |
| F2 | Cancelled appointments must stay on record; the clinic keeps appointment history for 7 years. | "What happens when someone cancels?" / "Any rules about records?" |
| F3 | Patients book by phone. No patient app has been approved, and the budget is about two weeks of work. | "Who will use it?" / "What's the budget?" |
| F4 | Each slot is 15 minutes; Dr Chan only works Tuesday and Thursday mornings. | "How are slots organised?" |
| F5 | Reception uses an old shared PC with Chrome; nothing can be installed. | "What computers do you use?" |
| F6 | Success for Grace means fewer than one double booking per week. | "How will you know it's fixed?" |

## State variables

Eight variables, the engine's limit.

| id | Type | Start | Visible to learner | Set by |
|---|---|---|---|---|
| `track` | enum `product` / `engineering` | chosen | yes | Start |
| `trust` | number 0–10 | 5 | yes | Nodes 1, 5 |
| `effort` | number 0–10 days | 0 | yes | Nodes 1, 4, 5, 6 |
| `factsFound` | number 0–6 | 0 | yes | Node 2 |
| `hasMetric` | boolean | false | no | Node 3 (R4) |
| `bug` | enum `none` / `race` / `delete-on-cancel` / `scope-creep` | `none` | no | Node 5 (approving a variant) |
| `hasTest` | boolean | false | no | Node 4 (C4) |
| `measured` | boolean | false | no | Node 6 |

If `effort` passes 10 days, the run ends as "over budget" (partial at best).

## Story nodes

### Node 1: Inbox (no AI)

The workspace opens on three messages:

- **Email from Grace**: "Patients keep complaining we booked them at the same time as someone else. Could you build us an app like the big clinics have? Can you start this week?"
- **Ticket from Kit**: "Mandy and I both booked 9:00 with Dr Lee again this morning."
- **Email from Leo**: "We can give Harbour two weeks, no more."

Choice:

| Action | Effects | Feedback |
|---|---|---|
| Book a call with Grace before committing | trust +1 | You find out what the problem is before deciding what to build. |
| Ask Cody to start a booking app now | effort +2 | You delegated before anyone knew what to build. Cody's half-built app has to be thrown away. (Delegation) |
| Reply with a quote for a patient app | trust −1 | You answered the request, not the problem. |

All three lead to node 2.

### Node 2: Client interview (AI, at most 8 turns)

Chat with Grace. Each AI reply returns `{ reply, revealedFacts: [...] }` validated against the fact list. The learner can end the interview at any time after 3 questions.

Scoring: number of facts revealed (F1, F2, F3 and F6 matter most for later nodes).

### Node 3: Requirements and acceptance criteria (AI, 1 call)

The learner writes a short requirements note for the team. One AI call checks it against this checklist and returns the ids it covers:

| id | Requirement | Depends on fact |
|---|---|---|
| R1 | The same doctor and slot cannot be booked twice, even if both receptionists save at once | F1 |
| R2 | Cancelling keeps the appointment on record, marked as cancelled | F2 |
| R3 | Staff-only tool; no patient app in this release | F3 |
| R4 | Success measure: fewer than one double booking per week | F6 |
| R5 | Works in Chrome on the existing reception PC | F5 |

Feedback points at missing items. If the learner never uncovered a fact, the feedback says so ("Grace never told you what happens to cancelled appointments; you didn't ask."). Covering R4 sets `hasMetric = true`.

### Node 4: Brief the coding agent (AI, 1 call)

The learner writes the task for Cody. One AI call checks it against the constraints below and returns the ids it covers. The server then picks the version of Cody's work with this priority (the first match wins):

| Missing constraint | Cody delivers | Variant id |
|---|---|---|
| C2: cancelling must keep the record | Cancelling **deletes** the appointment | `delete-on-cancel` |
| C1: reject a booking at save time if the slot is taken | Checks availability first, then saves, so two simultaneous saves both succeed | `race` |
| C3: stay within scope, no patient accounts | Correct booking logic plus an unrequested patient login module | `scope-creep` |
| (none missing) | Correct version | `good` |

| id | Constraint |
|---|---|
| C1 | A booking for a taken doctor + slot is rejected when it is saved, not only hidden in the screen |
| C2 | Cancelling marks the appointment as cancelled; nothing is deleted |
| C3 | Only the staff booking board; no patient accounts, reminders or payments |
| C4 | (Engineering track) Include a test that two bookings for the same slot can't both succeed |

C4 doesn't change the variant. It sets `hasTest = true`, and Cody's pull request then includes the test. On the `race` variant that test fails, so the PR in node 5 shows a red check. The learner still has to notice it and not approve.

### Node 5: Review Cody's work (no AI, optional 1 call)

- **Engineering track**: Cody opens a pull request "Add shared booking board" with the chosen variant's diff. The learner can comment on a line, approve, or request changes.
- **Product track**: Cody shares a scripted behaviour demo (for example "Mandy cancels the 9:15 appointment → it disappears from the day list and from the history"). The learner approves or requests changes, choosing a reason.

Requesting changes for the right reason costs effort +2 and returns the `good` version. Approving a buggy version sets `bug` to that variant's id. An optional AI call grades a free-text review comment and maps it to "names the real problem / vague / wrong".

### Node 6: Test and release (no AI)

| Action | Available when | Effects | Next |
|---|---|---|---|
| Release to both receptionists and measure for two weeks | `hasMetric` | measured = true | Ending |
| Run a one-week pilot with Mandy first | always | effort +2 | Ending |
| Release on Monday, no measurement | always | | Ending |

### Endings (scripted)

| Ending | Condition | What the learner sees |
|---|---|---|
| Success | `bug = none` and measured | QA report: zero double bookings in two weeks; Grace extends the contract. |
| Partial | `bug = none` and not measured, or `bug = scope-creep` | It works, but there is no evidence it helped, or the extra module ate the budget. |
| Failure: lost records | `bug = delete-on-cancel` | Week 1: an auditor asks for last month's cancellations; they are gone. |
| Failure: still double-booked | `bug = race` | Pilot report: two double bookings at 9:00 on Tuesday, exactly the original problem. |

A pilot run (node 6) reveals the bug before it reaches all staff, turning failure into partial. That rewards Diligence.

### Debrief (template, optional 1 AI call to personalise)

One card per 4D competency, each quoting the learner's own evidence: the questions they asked, the requirements they wrote, the constraint they left out, the line they approved.

## Cody's code versions (engineering track)

All versions share the same small data layer. Only the booking and cancel functions differ.

### `good`

```ts
// migrations/002_booking_board.sql
create unique index one_booking_per_slot
  on appointments (doctor_id, slot)
  where status = 'booked';
```

```ts
// src/booking.ts
export async function bookSlot(db: Db, input: BookingInput) {
  try {
    // The unique index rejects the second save, even if both
    // receptionists click "Book" at the same moment.
    await db.insert("appointments", { ...input, status: "booked" });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "That slot is already booked." };
    throw error;
  }
}

export async function cancelAppointment(db: Db, id: string) {
  await db.update("appointments", id, { status: "cancelled", cancelledAt: new Date() });
}
```

### `race` (missing C1)

```ts
export async function bookSlot(db: Db, input: BookingInput) {
  const taken = await db.findOne("appointments", {
    doctorId: input.doctorId,
    slot: input.slot,
    status: "booked",
  });
  if (taken) return { ok: false, reason: "That slot is already booked." };
  // Bug: two saves that arrive together both pass the check above.
  await db.insert("appointments", { ...input, status: "booked" });
  return { ok: true };
}
```

No unique index in the migration. The "Bug" comment above is for this document only and is not shown to learners.

### `delete-on-cancel` (missing C2)

Booking is the `good` version, but:

```ts
export async function cancelAppointment(db: Db, id: string) {
  await db.delete("appointments", id);
}
```

### `scope-creep` (missing C3)

The `good` version plus `src/patient-accounts.ts` (sign-up, login, password reset) and a new "Patient portal" page. No bug, but effort +3 and the PR is three times larger to review.

## Data format: proposal to align with the PR #6 engine

The scenario compiles to the existing `SimulationConfig` (variables, stages, actions, effects, endings, rubric) plus scenario data that the workspace UI needs. Proposed additions:

1. **System actions.** A new flag on actions, `trigger: "learner" | "system"`. System actions are never listed to the learner. The server picks them after an AI node, for example `brief-delete-on-cancel`. They go through `applySimulationAction` like any other action, so state, history, versioning and attempt recording all stay as they are.
2. **AI node definitions.** A stage can carry one `aiNode`:
   - `interview`: persona, fact list, max turns, min turns
   - `checklist`: checklist items, plus an ordered mapping `{ missing: [ids] } → systemActionId` with a default
   - `review-comment`: optional grading of a free-text review comment

   The AI only ever returns ids from these lists. The server validates them and falls back to a scripted action if validation fails.
3. **Workspace content.** `inbox` (emails, tickets), `repo` (files per variant), `demo` (behaviour steps per variant, product track) and `pullRequest` (title, description, diff per variant). These are static and shown according to the current stage and variant.
4. **4D tags.** Each action and checklist item carries a `competency` tag (`delegation`, `description`, `discernment`, `diligence`), so the debrief and the teacher's class profile can be built from the run history without another AI call.
5. **Track.** `track: "product" | "engineering"` chosen at the start, stored in state, used for wording and node 5.

Budget per run: at most 8 interview turns + 1 (requirements) + 1 (agent brief) + 1 (optional review comment) + 1 (optional debrief) = **12 AI calls**, all with `gemini-3.5-flash-lite` and JSON-schema output.

## Open questions

- Should node 2 allow returning to the interview after node 3, at an effort cost? That's more realistic, but adds a branch.
- Is one scenario enough for the demo, or should a short second scenario (for example a bug report from production) reuse the same engine to show it generalises?
- Does the teacher get to edit scenarios in the studio this term, or only view class results?
