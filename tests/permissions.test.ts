import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const teacher = "00000000-0000-4000-8000-000000000001",
  student = "00000000-0000-4000-8000-000000000002",
  outsider = "00000000-0000-4000-8000-000000000003",
  otherTeacher = "00000000-0000-4000-8000-000000000004";
const course = "10000000-0000-4000-8000-000000000001",
  personal = "10000000-0000-4000-8000-000000000002";
test("database enforces role, ownership, enrolment, publication and evidence boundaries", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  await db.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
  // Match Supabase's pre-existing broad grants, then ensure migration narrows them.
  await db.exec(
    "grant all on all tables in schema public to anon, authenticated, service_role;",
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261022050613_general_learning_platform.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261022180000_review_fixes.sql",
      "utf8",
    ),
  );
  const ownerRead = readFileSync(
    "supabase/migrations/20261022203000_quota_params_and_owner_read.sql",
    "utf8",
  );
  await db.exec(ownerRead);
  await db.exec(ownerRead);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261022235900_learning_preferences.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261023090000_simulation_sessions.sql",
      "utf8",
    ),
  );
  await db.exec(
    `insert into auth.users values ('${teacher}','teacher@example.test',now()),('${student}','student@example.test',now()),('${outsider}','outsider@example.test',now()),('${otherTeacher}','other@example.test',now()); update public.profiles set role='instructor' where id in ('${teacher}','${otherTeacher}');`,
  );
  async function as(id: string, sql: string) {
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
    );
    try {
      return await db.exec(sql);
    } finally {
      await db.exec("reset role");
    }
  }
  await assert.rejects(
    as(
      student,
      "update public.profiles set role='instructor' where id=auth.uid()",
    ),
    /permission|administrator/,
  );
  await assert.rejects(
    as(
      student,
      `insert into public.profiles(id,role) values('${student}','admin') on conflict(id) do update set role='admin'`,
    ),
    /permission|administrator/,
  );
  await assert.rejects(
    as(student, "delete from public.profiles where id=auth.uid()"),
    /permission/,
  );
  const renamed = await as(
    student,
    "update public.profiles set display_name='Learner' where id=auth.uid() returning id",
  );
  assert.equal(renamed[0].rows.length, 1);
  const styled = await as(
    student,
    "update public.profiles set learning_style='step_by_step' where id=auth.uid() returning learning_style",
  );
  assert.equal(styled[0].rows[0].learning_style, "step_by_step");
  const preference = await as(
    student,
    "insert into public.course_learner_preferences(user_id,course_id,experience,goal) values(auth.uid(),'static-course','some','build') returning course_id",
  );
  assert.equal(preference[0].rows[0].course_id, "static-course");
  assert.equal(
    (await as(outsider, "select * from public.course_learner_preferences"))[0]
      .rows.length,
    0,
  );
  await assert.rejects(
    as(
      student,
      `insert into public.course_learner_preferences(user_id,course_id,experience,goal) values('${outsider}','other-course','none','understand')`,
    ),
    /row-level security/,
  );
  const quotaArgs = await db.exec(
    "select proname, proargnames::text as names from pg_proc where proname = 'consume_ai_quota'",
  );
  assert.equal(quotaArgs[0].rows.length, 1);
  assert.match(String(quotaArgs[0].rows[0].names), /p_bucket/);
  assert.equal(
    (
      await as(
        student,
        "select public.consume_ai_quota('tutor', 60, 3600) as ok",
      )
    )[0].rows[0].ok,
    true,
  );
  assert.equal(
    (
      await as(
        student,
        "select public.consume_ai_quota('tutor', 60, 3600) as ok",
      )
    )[0].rows[0].ok,
    true,
  );
  assert.equal(
    (
      await db.exec(
        `select hits from public.ai_usage where user_id = '${student}' and bucket = 'tutor'`,
      )
    )[0].rows[0].hits,
    2,
  );
  assert.equal(
    (
      await as(
        student,
        "select public.consume_ai_quota('roleplay', 1, 3600) as ok",
      )
    )[0].rows[0].ok,
    true,
  );
  assert.equal(
    (
      await as(
        student,
        "select public.consume_ai_quota('roleplay', 1, 3600) as ok",
      )
    )[0].rows[0].ok,
    false,
  );
  assert.equal(
    (
      await db.exec(
        `select hits from public.ai_usage where user_id = '${student}' and bucket = 'roleplay'`,
      )
    )[0].rows[0].hits,
    2,
  );
  const doc = (id: string) => `'{"id":"${id}","lessons":[]}'::jsonb`;
  const created = await as(
    teacher,
    `insert into public.courses(id,owner_id,document) values('${course}',auth.uid(),${doc(course)}) returning id`,
  );
  assert.equal(created[0].rows[0].id, course);
  const personalCreated = await as(
    student,
    `insert into public.courses(id,owner_id,document) values('${personal}',auth.uid(),${doc(personal)}) returning id`,
  );
  assert.equal(personalCreated[0].rows[0].id, personal);
  const touched = await as(
    teacher,
    `update public.courses set updated_at = now() where id = '${course}' returning id`,
  );
  assert.equal(touched[0].rows[0].id, course);
  const invited = await as(
    teacher,
    `insert into public.course_invitations(course_id,email) values('${course}','extra@example.test') returning email`,
  );
  assert.equal(invited[0].rows[0].email, "extra@example.test");
  await assert.rejects(
    as(
      student,
      `update public.courses set status='published' where id='${personal}'`,
    ),
    /row-level security/,
  );
  await assert.rejects(
    as(
      student,
      `update public.courses set visibility='public' where id='${personal}'`,
    ),
    /row-level security/,
  );
  assert.equal(
    (await as(outsider, `select * from public.courses where id='${course}'`))[0]
      .rows.length,
    0,
  );
  assert.equal(
    (
      await as(
        otherTeacher,
        `update public.courses set status='published' where id='${course}' returning id`,
      )
    )[0].rows.length,
    0,
  );
  await as(
    teacher,
    `update public.courses set status='published',visibility='enrolled' where id='${course}'; insert into public.course_invitations(course_id,email) values('${course}','student@example.test')`,
  );
  await as(outsider, "select public.claim_course_invitations()");
  assert.equal(
    (await as(outsider, `select * from public.courses where id='${course}'`))[0]
      .rows.length,
    0,
  );
  await as(student, "select public.claim_course_invitations()");
  assert.equal(
    (await as(student, `select * from public.courses where id='${course}'`))[0]
      .rows.length,
    1,
  );
  await assert.rejects(
    as(
      outsider,
      `insert into public.course_enrolments values('${course}',auth.uid(),now())`,
    ),
    /row-level security|permission denied/,
  );
  await assert.rejects(
    as(
      teacher,
      `insert into public.course_enrolments values('${course}','${outsider}',now())`,
    ),
    /row-level security|permission denied/,
  );
  await assert.rejects(
    as(
      student,
      `insert into public.learning_attempts(id,user_id,course_id,lesson_id,activity_id,course_revision,activity_snapshot,response) values(gen_random_uuid(),auth.uid(),'${course}','l','a',1,'{}','fake')`,
    ),
    /permission/,
  );
  await assert.rejects(
    as(
      student,
      `insert into public.lesson_progress(user_id,course_id,lesson_id,completed_at) values(auth.uid(),'${course}','l',now())`,
    ),
    /row-level security/,
  );
  await db.exec(
    `insert into public.lesson_progress(user_id,course_id,lesson_id) values('${student}','${course}','server')`,
  );
  await as(
    student,
    `delete from public.lesson_progress where user_id='${student}' and course_id='${course}'`,
  );
  assert.equal(
    (
      await db.exec(
        `select * from public.lesson_progress where course_id='${course}'`,
      )
    )[0].rows.length,
    1,
  );
  const legacyProgress = await as(
    student,
    `insert into public.lesson_progress(user_id,course_id,lesson_id) values(auth.uid(),'legacy-demo','l') returning course_id`,
  );
  assert.equal(legacyProgress[0].rows[0].course_id, "legacy-demo");
  await db.exec(
    `insert into public.learning_attempts(id,user_id,course_id,lesson_id,activity_id,course_revision,activity_snapshot,response) values(gen_random_uuid(),'${student}','${course}','l','a',1,'{}','real response')`,
  );
  assert.equal(
    (await as(teacher, "select * from public.learning_attempts"))[0].rows
      .length,
    1,
  );
  assert.equal(
    (await as(outsider, "select * from public.learning_attempts"))[0].rows
      .length,
    0,
  );
  assert.equal(
    (await as(otherTeacher, "select * from public.learning_attempts"))[0].rows
      .length,
    0,
  );
  await db.exec(
    `insert into public.simulation_sessions(id,user_id,course_id,lesson_id,activity_id,activity_snapshot,state,version) values('20000000-0000-4000-8000-000000000001','${student}','${course}','l','a','{}','{"stageId":"start","step":0,"variables":{}}',1)`,
  );
  assert.equal(
    (await as(student, "select * from public.simulation_sessions"))[0].rows
      .length,
    1,
  );
  assert.equal(
    (await as(outsider, "select * from public.simulation_sessions"))[0].rows
      .length,
    0,
  );
  assert.equal(
    (await as(teacher, "select * from public.simulation_sessions"))[0].rows
      .length,
    0,
  );
  await assert.rejects(
    as(
      student,
      `insert into public.simulation_sessions(id,user_id,course_id,lesson_id,activity_id,activity_snapshot,state,version) values('20000000-0000-4000-8000-000000000002',auth.uid(),'${course}','l','b','{}','{}',1)`,
    ),
    /permission/,
  );
  await assert.rejects(
    as(
      student,
      `update public.simulation_sessions set state='{"forged":true}' where user_id=auth.uid()`,
    ),
    /permission/,
  );
  await assert.rejects(
    as(
      student,
      "delete from public.simulation_sessions where user_id=auth.uid()",
    ),
    /permission/,
  );
  await as(
    teacher,
    `update public.courses set status='draft' where id='${course}'`,
  );
  assert.equal(
    (await as(student, `select * from public.courses where id='${course}'`))[0]
      .rows.length,
    0,
  );
  await as(
    teacher,
    `update public.courses set status='published',visibility='public' where id='${course}'`,
  );
  await db.exec(
    "set role anon; select set_config('request.jwt.claim.sub','',false)",
  );
  assert.equal(
    (await db.exec(`select * from public.courses where id='${course}'`))[0].rows
      .length,
    1,
  );
  await db.exec("reset role");
  await db.close();
});
