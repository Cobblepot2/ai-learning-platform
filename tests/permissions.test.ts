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
  await as(
    student,
    "update public.profiles set display_name='Learner' where id=auth.uid()",
  );
  const doc = (id: string) => `'{"id":"${id}","lessons":[]}'::jsonb`;
  await as(
    teacher,
    `insert into public.courses(id,owner_id,document) values('${course}',auth.uid(),${doc(course)})`,
  );
  await as(
    student,
    `insert into public.courses(id,owner_id,document) values('${personal}',auth.uid(),${doc(personal)})`,
  );
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
  await as(
    student,
    `insert into public.lesson_progress(user_id,course_id,lesson_id) values(auth.uid(),'legacy-demo','l')`,
  );
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
