import {
  SIMULATION_SCHEMA_VERSION,
  simulationConfigSchema,
} from "@/lib/learning/simulation/schema";
import { harbourClinicListing as listing } from "./catalog";
import type { CodeFile, ProjectScenario } from "./types";

/*
 * Server-side only: this file holds the code variants, hidden facts and
 * checklists. Client components must use ./catalog instead.
 *
 * Scenario 1. Story, facts, code and consequences are all written here.
 * See docs/scenarios/clinic-booking.md for the design notes.
 * All people and organisations are fictional.
 */

const sharedTypes: CodeFile = {
  path: "src/types.ts",
  lines: [
    "export type BookingInput = {",
    "  doctorId: string;",
    "  slot: string; // ISO start time, 15-minute slots",
    "  patientName: string;",
    "  bookedBy: string; // receptionist",
    "};",
  ],
};

const goodMigration: CodeFile = {
  path: "migrations/002_booking_board.sql",
  lines: [
    "alter table appointments",
    "  add column status text not null default 'booked',",
    "  add column cancelled_at timestamptz;",
    "",
    "-- Only one active booking per doctor and slot.",
    "create unique index one_booking_per_slot",
    "  on appointments (doctor_id, slot)",
    "  where status = 'booked';",
  ],
};

const goodBooking: CodeFile = {
  path: "src/booking.ts",
  lines: [
    'import type { BookingInput } from "./types";',
    'import { db, isUniqueViolation } from "./db";',
    "",
    "export async function bookSlot(input: BookingInput) {",
    "  try {",
    "    // The unique index rejects the second save, even if both",
    "    // receptionists press Book at the same moment.",
    '    await db.insert("appointments", { ...input, status: "booked" });',
    "    return { ok: true };",
    "  } catch (error) {",
    "    if (isUniqueViolation(error)) {",
    '      return { ok: false, reason: "That slot is already booked." };',
    "    }",
    "    throw error;",
    "  }",
    "}",
    "",
    "export async function cancelAppointment(id: string) {",
    '  await db.update("appointments", id, {',
    '    status: "cancelled",',
    "    cancelledAt: new Date(),",
    "  });",
    "}",
  ],
};

const bookingTest: CodeFile = {
  path: "tests/booking.test.ts",
  lines: [
    'import { bookSlot } from "../src/booking";',
    "",
    'test("two receptionists cannot book the same slot", async () => {',
    '  const slot = { doctorId: "lee", slot: "2026-11-03T09:00", bookedBy: "" };',
    "  const [first, second] = await Promise.all([",
    '    bookSlot({ ...slot, patientName: "A. Chan", bookedBy: "Mandy" }),',
    '    bookSlot({ ...slot, patientName: "B. Ho", bookedBy: "Kit" }),',
    "  ]);",
    "  expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);",
    "});",
  ],
};

export const harbourClinic: ProjectScenario = {
  id: listing.id,
  version: 1,
  title: listing.title,
  tagline: listing.tagline,
  summary: listing.summary,
  client: {
    name: "Grace Wong",
    role: "Practice manager",
    organisation: "Harbour Family Clinic",
    persona:
      "Grace Wong, practice manager at Harbour Family Clinic, a small family clinic. Friendly, busy and not technical. Speaks in short, natural sentences, sometimes mentions patients or staff by name. Cares about the budget and about not upsetting patients. Describes solutions ('an app like the big clinics') rather than problems unless asked good questions.",
  },
  facts: [
    {
      id: "F1",
      text: "Double bookings happen when Mandy and Kit edit the shared spreadsheet at the same time, mostly between 8:30 and 9:30.",
      cues: ["happen", "wrong", "double", "same time", "same slot", "spreadsheet", "morning", "rush", "busy", "cause", "why", "reception", "mandy", "kit"],
      reply:
        "It's always the morning rush, about half eight to half nine. Mandy and Kit both have the spreadsheet open and both type into the same row. Neither of them notices until two patients turn up.",
    },
    {
      id: "F2",
      text: "Cancelled appointments must stay on record. The clinic keeps appointment history for seven years.",
      cues: ["cancel", "record", "history", "delete", "rule", "regulation", "audit", "keep", "data"],
      reply:
        "Oh, cancellations must stay on file. We keep the appointment history for seven years, the auditors check it. Right now we just colour the row grey.",
    },
    {
      id: "F3",
      text: "Patients book by phone. No patient app has been approved, and the budget is about two weeks of work.",
      cues: ["patient", "app", "who will use", "user", "budget", "cost", "money", "online", "phone", "scope"],
      reply:
        "Honestly, most of our patients just ring us. The board hasn't approved any patient app. Leo said you can give us about two weeks, and that's what we can pay for.",
    },
    {
      id: "F4",
      text: "Each slot is 15 minutes. Dr Chan only works Tuesday and Thursday mornings.",
      cues: ["slot", "length", "minutes", "doctor", "schedule", "hours", "shift", "long is"],
      reply:
        "Every appointment is fifteen minutes. Dr Lee is in every day, Dr Chan only Tuesday and Thursday mornings.",
    },
    {
      id: "F5",
      text: "Reception uses one old shared PC with Chrome. Nothing can be installed on it.",
      cues: ["computer", "pc", "device", "laptop", "browser", "install", "equipment", "tablet", "hardware"],
      reply:
        "We've got one old PC at the front desk, the clinic's IT won't let us install anything. Chrome works, that's about it.",
    },
    {
      id: "F6",
      text: "For Grace, success means fewer than one double booking per week.",
      cues: ["success", "measure", "fixed", "goal", "good", "better", "how will you know", "target", "result"],
      reply:
        "If we got it down to less than one double booking a week, I'd be thrilled. Right now it's three or four.",
    },
  ],
  inbox: [
    {
      id: "grace-email",
      kind: "email",
      from: "Grace Wong <grace@harbourclinic.example>",
      subject: "Can you build us an app?",
      body: "Hi,\n\nPatients keep complaining that we booked them at the same time as someone else. It's embarrassing. Could you build us an app like the big clinics have? Can you start this week?\n\nThanks,\nGrace",
    },
    {
      id: "kit-ticket",
      kind: "ticket",
      from: "Kit (reception)",
      subject: "Dr Lee 9:00 double booked again",
      body: "Mandy and I both booked the 9:00 with Dr Lee this morning. Had to send one patient home. Third time this week.",
    },
    {
      id: "leo-email",
      kind: "email",
      from: "Leo (your manager)",
      subject: "Harbour Clinic",
      body: "We can give Harbour two weeks, no more. Cody is free if you want to use it. Keep me posted.",
    },
  ],
  interview: {
    opening:
      "Hello! Thanks for making time. So, can you build us an app? Something like the big clinics have. What do you need from me?",
    minQuestions: 3,
    maxQuestions: 8,
    vagueReplies: [
      "Hmm, I'm not sure what you mean. We just want the bookings to work.",
      "That's a bit technical for me. What would you like to know about how we work?",
      "I suppose so? I really just want patients to stop turning up at the same time.",
    ],
  },
  requirements: [
    {
      id: "R1",
      label: "The same doctor and slot can't be booked twice, even if both receptionists save at once",
      competency: "description",
      fact: "F1",
      cues: [
        ["double", "twice", "same slot", "same time", "conflict", "overlap", "already booked", "taken", "two bookings", "clash"],
      ],
    },
    {
      id: "R2",
      label: "Cancelling keeps the appointment on record, marked as cancelled",
      competency: "description",
      fact: "F2",
      cues: [
        ["cancel"],
        ["keep", "kept", "record", "history", "mark", "status", "not delete", "never delete", "don't delete", "do not delete", "retain", "seven years", "7 years"],
      ],
    },
    {
      id: "R3",
      label: "Staff-only tool; no patient app in this release",
      competency: "description",
      fact: "F3",
      cues: [
        ["staff", "reception", "internal", "no patient", "not a patient", "no app", "not an app", "only"],
      ],
    },
    {
      id: "R4",
      label: "Success measure: fewer than one double booking per week",
      competency: "diligence",
      fact: "F6",
      cues: [
        ["per week", "a week", "each week", "weekly", "measure", "metric", "success", "target", "fewer than", "less than", "reduce"],
      ],
    },
    {
      id: "R5",
      label: "Works in Chrome on the existing reception PC",
      competency: "description",
      fact: "F5",
      cues: [["chrome", "browser", "web", "existing pc", "current pc", "no install", "without install"]],
    },
  ],
  brief: [
    {
      id: "C1",
      label: "Reject a booking for a taken doctor and slot when it is saved, not only in the screen",
      competency: "description",
      cues: [
        ["taken", "already booked", "double", "same slot", "same time", "conflict", "unique", "twice", "overlap", "clash"],
        ["save", "saving", "server", "database", "reject", "at the same time", "simultaneous", "concurrent", "both", "race", "lock", "constraint", "unique"],
      ],
    },
    {
      id: "C2",
      label: "Cancelling marks the appointment as cancelled; nothing is deleted",
      competency: "description",
      cues: [
        ["cancel"],
        ["keep", "kept", "mark", "status", "never delete", "not delete", "don't delete", "do not delete", "history", "record", "retain", "soft"],
      ],
    },
    {
      id: "C3",
      label: "Only the staff booking board; no patient accounts, reminders or payments",
      competency: "delegation",
      cues: [
        ["only", "just", "no ", "not ", "don't", "do not", "without", "out of scope", "nothing else"],
        ["patient app", "patient account", "patient login", "patient portal", "login", "account", "payment", "reminder", "portal", "scope", "extra feature"],
      ],
    },
    {
      id: "C4",
      label: "Include a test that two bookings for the same slot can't both succeed",
      competency: "diligence",
      tracks: ["engineering"],
      cues: [["test", "tests", "testing", "unit test", "spec"]],
    },
  ],
  variantRules: [
    { missing: "C2", variant: "delete-on-cancel", action: "brief-delete" },
    { missing: "C1", variant: "race", action: "brief-race" },
    { missing: "C3", variant: "scope-creep", action: "brief-scope" },
  ],
  defaultVariant: { variant: "good", action: "brief-good" },
  variants: [
    {
      id: "good",
      prTitle: "Add shared booking board",
      prSummary:
        "Adds a booking board for reception. A unique index stops two active bookings for the same doctor and slot. Cancelling marks the appointment as cancelled and keeps it in the history.",
      files: [goodMigration, goodBooking, sharedTypes],
      problemLines: [],
      problemReason: null,
      demo: [
        { action: "Mandy and Kit both book Dr Lee at 9:00 at the same moment.", result: "Mandy's booking is saved. Kit sees “That slot is already booked.”" },
        { action: "Mandy cancels Mr Ho's 9:15 appointment.", result: "The slot opens up. The appointment stays in the history, marked Cancelled." },
        { action: "Kit opens the board on the front-desk PC.", result: "It loads in Chrome. Nothing to install." },
      ],
      checks: [{ name: "booking.test.ts", passed: true, detail: "two receptionists cannot book the same slot: passed" }],
    },
    {
      id: "race",
      prTitle: "Add shared booking board",
      prSummary:
        "Adds a booking board for reception. Before saving, it checks whether the slot is free and shows an error if it is taken. Cancelling keeps the appointment in the history.",
      files: [
        {
          path: "migrations/002_booking_board.sql",
          lines: [
            "alter table appointments",
            "  add column status text not null default 'booked',",
            "  add column cancelled_at timestamptz;",
          ],
        },
        {
          path: "src/booking.ts",
          lines: [
            'import type { BookingInput } from "./types";',
            'import { db } from "./db";',
            "",
            "export async function bookSlot(input: BookingInput) {",
            '  const taken = await db.findOne("appointments", {',
            "    doctorId: input.doctorId,",
            "    slot: input.slot,",
            '    status: "booked",',
            "  });",
            '  if (taken) return { ok: false, reason: "That slot is already booked." };',
            '  await db.insert("appointments", { ...input, status: "booked" });',
            "  return { ok: true };",
            "}",
            "",
            "export async function cancelAppointment(id: string) {",
            '  await db.update("appointments", id, {',
            '    status: "cancelled",',
            "    cancelledAt: new Date(),",
            "  });",
            "}",
          ],
        },
        sharedTypes,
      ],
      problemLines: [
        { path: "src/booking.ts", line: 5 },
        { path: "src/booking.ts", line: 10 },
        { path: "src/booking.ts", line: 11 },
        { path: "migrations/002_booking_board.sql", line: 3 },
      ],
      problemReason: "double-booking",
      demo: [
        { action: "Kit books Dr Lee at 9:00, then Mandy tries the same slot a minute later.", result: "Mandy sees “That slot is already booked.”" },
        { action: "Mandy and Kit both press Book for Dr Lee at 9:00 at the same moment.", result: "Both see “Booked”. The 9:00 now has two patients." },
        { action: "Mandy cancels Mr Ho's 9:15 appointment.", result: "The slot opens up. The appointment stays in the history, marked Cancelled." },
      ],
      checks: [
        {
          name: "booking.test.ts",
          passed: false,
          detail: "two receptionists cannot book the same slot: expected 1 successful booking, received 2",
        },
      ],
    },
    {
      id: "delete-on-cancel",
      prTitle: "Add shared booking board",
      prSummary:
        "Adds a booking board for reception. A unique index stops two bookings for the same doctor and slot. Cancelling removes the appointment so the slot is free again.",
      files: [
        goodMigration,
        {
          path: "src/booking.ts",
          lines: [
            'import type { BookingInput } from "./types";',
            'import { db, isUniqueViolation } from "./db";',
            "",
            "export async function bookSlot(input: BookingInput) {",
            "  try {",
            '    await db.insert("appointments", { ...input, status: "booked" });',
            "    return { ok: true };",
            "  } catch (error) {",
            "    if (isUniqueViolation(error)) {",
            '      return { ok: false, reason: "That slot is already booked." };',
            "    }",
            "    throw error;",
            "  }",
            "}",
            "",
            "export async function cancelAppointment(id: string) {",
            "  // Free the slot for another patient.",
            '  await db.delete("appointments", id);',
            "}",
          ],
        },
        sharedTypes,
      ],
      problemLines: [{ path: "src/booking.ts", line: 18 }],
      problemReason: "cancel-deletes",
      demo: [
        { action: "Mandy and Kit both book Dr Lee at 9:00 at the same moment.", result: "Mandy's booking is saved. Kit sees “That slot is already booked.”" },
        { action: "Mandy cancels Mr Ho's 9:15 appointment.", result: "The slot opens up. Mr Ho's appointment disappears from the day list and from the history." },
        { action: "Grace searches last week's history for cancellations.", result: "No cancelled appointments are found." },
      ],
      checks: [{ name: "booking.test.ts", passed: true, detail: "two receptionists cannot book the same slot: passed" }],
    },
    {
      id: "scope-creep",
      prTitle: "Add shared booking board and patient portal",
      prSummary:
        "Adds a booking board for reception, plus a patient portal so patients can sign up, log in and book online. A unique index stops double bookings. Cancelling keeps the appointment in the history.",
      files: [
        goodMigration,
        goodBooking,
        {
          path: "src/patient-accounts.ts",
          lines: [
            'import { db, hashPassword } from "./db";',
            "",
            "// Patients can create an account and book online.",
            "export async function signUp(email: string, password: string) {",
            '  await db.insert("patients", { email, passwordHash: await hashPassword(password) });',
            "}",
            "",
            "export async function sendReminder(patientId: string) {",
            "  // TODO: connect an SMS provider",
            "}",
          ],
        },
        sharedTypes,
      ],
      problemLines: [
        { path: "src/patient-accounts.ts", line: 3 },
        { path: "src/patient-accounts.ts", line: 4 },
        { path: "src/patient-accounts.ts", line: 8 },
      ],
      problemReason: "extra-features",
      demo: [
        { action: "Mandy and Kit both book Dr Lee at 9:00 at the same moment.", result: "Mandy's booking is saved. Kit sees “That slot is already booked.”" },
        { action: "Mandy cancels Mr Ho's 9:15 appointment.", result: "The slot opens up. The appointment stays in the history, marked Cancelled." },
        { action: "Grace opens the new “Patient portal” page.", result: "Patients can sign up and book online. Reminders show “coming soon”." },
      ],
      checks: [{ name: "booking.test.ts", passed: true, detail: "two receptionists cannot book the same slot: passed" }],
    },
  ],
  testFile: bookingTest,
  reviewReasons: [
    { id: "double-booking", label: "Two people can still book the same slot" },
    { id: "cancel-deletes", label: "Cancelled appointments disappear from the history" },
    { id: "extra-features", label: "It adds things the clinic didn't ask for" },
    { id: "styling", label: "The colours don't match the clinic's brand" },
  ],
  stageKinds: {
    "choose-track": "choice",
    inbox: "choice",
    interview: "interview",
    requirements: "requirements",
    brief: "brief",
    "brief-test": "brief",
    review: "review",
    release: "release",
  },
  trackNarratives: {
    review: {
      product:
        "Cody has finished and recorded a short walkthrough of how the booking board behaves. Watch it as if you were Grace, then approve it or send it back with a reason.",
      engineering:
        "Cody has opened a pull request. Read the diff and the checks. Approve it, or point at the line that's wrong and request changes.",
    },
  },
  debriefNotes: {
    missedFact: {
      F1: "You never found out when the double bookings happen. They come from two people saving at the same moment, which is exactly what the agent needed to guard against.",
      F2: "Grace never told you what happens to cancelled appointments, because you didn't ask. The clinic must keep seven years of history.",
      F3: "You didn't ask who would use the system or what the budget was. No patient app is approved.",
      F6: "You didn't ask how Grace would judge success, so you had no target to measure against.",
    },
    missedRequirement: {
      R1: "Your requirements didn't say that the same slot must not be bookable twice when two people save together.",
      R2: "Your requirements didn't say that cancelled appointments must stay on record.",
      R3: "Your requirements didn't limit the scope to a staff tool.",
      R4: "Your requirements had no success measure, so nobody could tell whether the release worked.",
      R5: "Your requirements didn't mention the reception PC.",
    },
    missedConstraint: {
      C1: "Your brief didn't tell Cody to reject a taken slot at the moment it is saved. Checking first and saving afterwards still lets two simultaneous bookings through.",
      C2: "Your brief didn't tell Cody that cancelling must keep the record. Cody chose the simplest option: delete it.",
      C3: "Your brief didn't limit the scope, so Cody added a patient portal nobody asked for.",
      C4: "Your brief didn't ask for a test, so nothing would have caught a double booking before release.",
    },
  },
  // Parsed once at load: applies schema defaults and fails fast on invalid content.
  config: simulationConfigSchema.parse({
    schemaVersion: SIMULATION_SCHEMA_VERSION,
    title: "Harbour Clinic booking board",
    scenario: {
      description:
        "Harbour Family Clinic keeps double-booking its morning appointments. You lead a two-week job with Cody, an AI coding agent.",
      objectives: [
        "Find out what the client really needs before building",
        "Give the coding agent a brief with the constraints that matter",
        "Review the agent's work and catch what it got wrong",
        "Release in a way that proves the problem is solved",
      ],
      initialSituation:
        "Your inbox has an email from the clinic's practice manager, a ticket from reception and a note from your manager about the budget.",
      participantRole: "You lead the job for a small software studio.",
      persona: "Grace Wong, practice manager.",
    },
    variables: [
      { id: "track", type: "enum", label: "Track", initial: "unset", options: ["unset", "product", "engineering"], visible: false },
      { id: "trust", type: "number", label: "Client trust", initial: 5, min: 0, max: 10, visible: true, description: "How much Grace trusts you to deliver what she needs." },
      { id: "effort", type: "number", label: "Days used", initial: 0, min: 0, max: 10, unit: "of 10", visible: true, description: "The studio can spend two working weeks on this job." },
      { id: "hasMetric", type: "boolean", label: "Has a success measure", initial: false, visible: false },
      { id: "variant", type: "enum", label: "Delivered version", initial: "none", options: ["none", "good", "race", "delete-on-cancel", "scope-creep"], visible: false },
      { id: "hasTest", type: "boolean", label: "Has a test", initial: false, visible: false },
      { id: "release", type: "enum", label: "Release", initial: "none", options: ["none", "plain", "pilot", "measured"], visible: false },
    ],
    startStage: "choose-track",
    stages: [
      {
        id: "choose-track",
        title: "Choose your role",
        narrative: "Same project, two ways in. Pick the role that fits you. You can try the other one later.",
        actions: [
          {
            id: "pick-product",
            label: "Product lead",
            description: "No coding needed. You'll review how the software behaves.",
            effects: [{ op: "set", variable: "track", value: "product" }],
            feedback: "You're the product lead. You'll judge Cody's work by how it behaves for the clinic.",
            nextStage: "inbox",
          },
          {
            id: "pick-engineering",
            label: "Tech lead",
            description: "You'll review Cody's pull request and code.",
            effects: [{ op: "set", variable: "track", value: "engineering" }],
            feedback: "You're the tech lead. You'll review Cody's pull request line by line.",
            nextStage: "inbox",
          },
        ],
      },
      {
        id: "inbox",
        title: "Monday morning",
        narrative: "Three messages are waiting. Read them, then decide your first move.",
        actions: [
          {
            id: "call-grace",
            label: "Book a call with Grace before committing to anything",
            effects: [{ op: "add", variable: "trust", value: 1 }],
            feedback: "You want to understand the problem before deciding what to build. Grace appreciates being asked.",
            nextStage: "interview",
          },
          {
            id: "cody-starts",
            label: "Ask Cody to start building a booking app straight away",
            effects: [{ op: "add", variable: "effort", value: 2 }],
            feedback: "You delegated before anyone knew what to build. Cody spent two days on an app that has to be thrown away once you talk to Grace.",
            nextStage: "interview",
          },
          {
            id: "send-quote",
            label: "Reply with a quote for a patient booking app",
            effects: [{ op: "add", variable: "trust", value: -1 }],
            feedback: "You answered the request, not the problem. Grace is unsure what she's paying for and asks for a call anyway.",
            nextStage: "interview",
          },
        ],
      },
      {
        id: "interview",
        title: "Call with Grace",
        narrative: "Grace has a few minutes between patients. Ask the questions that tell you what's really going wrong. End the call when you have what you need.",
        actions: [
          {
            id: "end-interview",
            trigger: "system",
            label: "End the call",
            feedback: "You wrap up the call and head back to write things down.",
            nextStage: "requirements",
          },
        ],
      },
      {
        id: "requirements",
        title: "Write the requirements",
        narrative: "Write a short requirements note for the team: what the booking board must do, and how you'll know it worked.",
        actions: [
          {
            id: "requirements-metric",
            trigger: "system",
            label: "Requirements with a success measure",
            effects: [{ op: "set", variable: "hasMetric", value: true }],
            feedback: "Your note includes a way to tell whether the release worked.",
            nextStage: "brief",
          },
          {
            id: "requirements-plain",
            trigger: "system",
            label: "Requirements without a success measure",
            feedback: "Your note describes what to build.",
            nextStage: "brief",
          },
        ],
      },
      {
        id: "brief",
        title: "Brief Cody",
        narrative: "Cody will build whatever you ask for, exactly as you ask for it. Write the task.",
        actions: [
          {
            id: "brief-good",
            trigger: "system",
            label: "Cody builds the booking board",
            effects: [{ op: "set", variable: "variant", value: "good" }, { op: "add", variable: "effort", value: 3 }],
            feedback: "Cody gets to work on your brief.",
            nextStage: "brief-test",
          },
          {
            id: "brief-race",
            trigger: "system",
            label: "Cody builds the booking board",
            effects: [{ op: "set", variable: "variant", value: "race" }, { op: "add", variable: "effort", value: 3 }],
            feedback: "Cody gets to work on your brief.",
            nextStage: "brief-test",
          },
          {
            id: "brief-delete",
            trigger: "system",
            label: "Cody builds the booking board",
            effects: [{ op: "set", variable: "variant", value: "delete-on-cancel" }, { op: "add", variable: "effort", value: 3 }],
            feedback: "Cody gets to work on your brief.",
            nextStage: "brief-test",
          },
          {
            id: "brief-scope",
            trigger: "system",
            label: "Cody builds the booking board",
            effects: [{ op: "set", variable: "variant", value: "scope-creep" }, { op: "add", variable: "effort", value: 5 }],
            feedback: "Cody gets to work on your brief, and on a few ideas of its own.",
            nextStage: "brief-test",
          },
        ],
      },
      {
        id: "brief-test",
        title: "Cody is working",
        narrative: "Cody is building the booking board.",
        actions: [
          {
            id: "with-test",
            trigger: "system",
            label: "Cody adds a test",
            effects: [{ op: "set", variable: "hasTest", value: true }],
            feedback: "Cody adds the test you asked for.",
            nextStage: "review",
          },
          {
            id: "without-test",
            trigger: "system",
            label: "Cody finishes",
            feedback: "Cody has finished.",
            nextStage: "review",
          },
        ],
      },
      {
        id: "review",
        title: "Review Cody's work",
        narrative: "Cody has finished. Review the work, then approve it or send it back.",
        actions: [
          {
            id: "approve",
            label: "Approve and merge",
            feedback: "You approve Cody's work. It's ready to release.",
            nextStage: "release",
          },
          {
            id: "changes-fixed",
            trigger: "system",
            label: "Request changes",
            effects: [{ op: "set", variable: "variant", value: "good" }, { op: "add", variable: "effort", value: 2 }],
            feedback: "You sent it back for the right reason. Cody fixes the problem and updates the work. It cost two more days.",
            nextStage: "review",
          },
          {
            id: "changes-wrong",
            trigger: "system",
            label: "Request changes",
            effects: [{ op: "add", variable: "effort", value: 1 }, { op: "add", variable: "trust", value: -1 }],
            feedback: "Cody looks again but finds nothing to change for that reason. A day is gone and Grace asks why it's taking longer.",
            nextStage: "review",
          },
        ],
      },
      {
        id: "release",
        title: "Release",
        narrative: "The booking board is ready. How do you put it in front of the clinic?",
        actions: [
          {
            id: "release-measure",
            label: "Release to both receptionists and track double bookings for two weeks",
            availableWhen: { kind: "compare", variable: "hasMetric", op: "eq", value: true },
            effects: [{ op: "set", variable: "release", value: "measured" }],
            feedback: "You release it and agree to count double bookings every week against Grace's target.",
          },
          {
            id: "release-pilot",
            label: "Run a one-week pilot with Mandy first",
            effects: [{ op: "set", variable: "release", value: "pilot" }, { op: "add", variable: "effort", value: 2 }],
            feedback: "You trade two days for a safer start: Mandy uses the board alongside the spreadsheet for a week.",
          },
          {
            id: "release-now",
            label: "Switch both receptionists over on Monday",
            effects: [{ op: "set", variable: "release", value: "plain" }],
            feedback: "You switch the clinic over on Monday.",
          },
        ],
      },
    ],
    completion: {
      maxSteps: 20,
      rules: [
        {
          outcome: "failure",
          when: {
            kind: "group",
            op: "and",
            conditions: [
              { kind: "compare", variable: "variant", op: "eq", value: "delete-on-cancel" },
              { kind: "compare", variable: "release", op: "neq", value: "none" },
              { kind: "compare", variable: "release", op: "neq", value: "pilot" },
            ],
          },
          summary:
            "In the first week an auditor asks for last month's cancellations. They're gone: every cancelled appointment was deleted. Grace has to explain the missing records.",
        },
        {
          outcome: "failure",
          when: {
            kind: "group",
            op: "and",
            conditions: [
              { kind: "compare", variable: "variant", op: "eq", value: "race" },
              { kind: "compare", variable: "release", op: "neq", value: "none" },
              { kind: "compare", variable: "release", op: "neq", value: "pilot" },
            ],
          },
          summary:
            "On Tuesday at 9:00 Mandy and Kit book Dr Lee at the same moment, and both bookings go through. Two patients turn up. It's exactly the problem the clinic hired you to fix.",
        },
        {
          outcome: "partial",
          when: {
            kind: "group",
            op: "and",
            conditions: [
              { kind: "compare", variable: "variant", op: "eq", value: "delete-on-cancel" },
              { kind: "compare", variable: "release", op: "eq", value: "pilot" },
            ],
          },
          summary:
            "During the pilot Mandy notices that cancelled appointments vanish from the history. You stop before the clinic loses real records, but the fix pushes the release past the two weeks.",
        },
        {
          outcome: "partial",
          when: {
            kind: "group",
            op: "and",
            conditions: [
              { kind: "compare", variable: "variant", op: "eq", value: "race" },
              { kind: "compare", variable: "release", op: "eq", value: "pilot" },
            ],
          },
          summary:
            "During the pilot week Mandy and Kit still manage to double-book the 9:00 once. The pilot caught it before the full switch, but the job overruns while Cody fixes it.",
        },
        {
          outcome: "success",
          when: {
            kind: "group",
            op: "and",
            conditions: [
              { kind: "compare", variable: "variant", op: "eq", value: "good" },
              { kind: "compare", variable: "release", op: "eq", value: "measured" },
            ],
          },
          summary:
            "Two weeks later the weekly count shows zero double bookings, against a target of fewer than one. Grace extends the contract.",
        },
        {
          outcome: "partial",
          when: { kind: "compare", variable: "release", op: "neq", value: "none" },
          summary:
            "The booking board works and reception likes it, but nobody can show the clinic that the problem is solved, or the extra work ate into the budget.",
        },
      ],
      exhaustedSummary:
        "The two weeks ran out while the work was still going back and forth. The clinic is still on the spreadsheet.",
    },
    rubric: [
      { id: "delegation", criterion: "Delegation", description: "Decided what to find out first and what to hand to the agent." },
      { id: "description", criterion: "Description", description: "Asked the right questions and briefed the agent with the constraints that matter." },
      { id: "discernment", criterion: "Discernment", description: "Reviewed the agent's work and caught what it got wrong." },
      { id: "diligence", criterion: "Diligence", description: "Released in a way that proves the problem is solved." },
    ],
    debrief: {
      success: "You found the real problem, briefed Cody precisely, checked its work and released with a way to prove it worked.",
      partial: "The clinic got something that mostly works. The debrief below shows where a different decision would have changed the result.",
      failure: "The release went wrong in a way you could have prevented. The debrief below traces it back to the decision that caused it.",
      incomplete: "The job ran out of time before it reached the clinic.",
    },
  }),
};
