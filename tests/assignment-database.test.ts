import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("assignment replacement rejects stale requests, rolls back failures and keeps ownership boundaries", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;`);
    for (const name of readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort()) {
      await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
    }
    const teacher = "00000000-0000-4000-8000-000000000001";
    const student = "00000000-0000-4000-8000-000000000002";
    const other = "00000000-0000-4000-8000-000000000003";
    const cid = "10000000-0000-4000-8000-000000000001";
    await db.exec(`insert into auth.users values('${teacher}','t@example.com',now()),('${student}','s@example.com',now()),('${other}','o@example.com',now());
      update public.profiles set role='instructor' where id in ('${teacher}','${other}');
      insert into public.classes(id,owner_id,name,join_code) values('${cid}','${teacher}','Class A','ABCDEF');
      insert into public.class_members(class_id,student_id) values('${cid}','${student}');`);
    async function as(id: string, sql: string) {
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
      try { return await db.exec(sql); } finally { await db.exec("reset role"); }
    }
    const save = (version: number, projects: string, actor = teacher) => as(actor, `select public.replace_class_projects('${cid}',${version},${projects}) as version`);
    const snapshot = async () => ({
      version: (await db.query<{projects_version:number}>(`select projects_version from public.classes where id='${cid}'`)).rows[0].projects_version,
      projects: (await db.query<{project_id:string}>(`select project_id from public.class_projects where class_id='${cid}' order by project_id`)).rows.map((row) => row.project_id),
    });
    assert.equal((await save(0, "array['harbour-clinic']"))[0].rows[0].version, 1);
    await save(1, "array['harbour-clinic','tidewater-swim']");
    // The old [A] request arrives after [A,B]: it must not delete B.
    await assert.rejects(save(1, "array['harbour-clinic']"), (error: unknown) => (error as {code: string}).code === "PT409");
    assert.deepEqual(await snapshot(), { version: 2, projects: ["harbour-clinic", "tidewater-swim"] });
    await assert.rejects(save(2, "array['parcelpal']", other), /ownership/);
    await assert.rejects(save(2, "array['parcelpal']", student), /ownership/);
    await assert.rejects(as(teacher, `delete from public.class_projects where class_id='${cid}'`), /permission/);
    await assert.rejects(as(teacher, `insert into public.class_projects(class_id,project_id) values('${cid}','parcelpal')`), /permission/);
    await assert.rejects(as(teacher, `update public.classes set projects_version=99 where id='${cid}'`), /permission/);
    assert.equal((await as(student, `select * from public.class_projects where class_id='${cid}'`))[0].rows.length, 2);
    assert.equal((await as(other, `select * from public.class_projects where class_id='${cid}'`))[0].rows.length, 0);

    await db.exec(`create function public.fail_assignment_test() returns trigger language plpgsql as $$begin
      if new.project_id='parcelpal' then raise exception 'simulated insert failure'; end if; return new; end$$;
      create trigger fail_assignment before insert on public.class_projects for each row execute function public.fail_assignment_test();`);
    await assert.rejects(save(2, "array['parcelpal']"), /simulated insert failure/);
    assert.deepEqual(await snapshot(), { version: 2, projects: ["harbour-clinic", "tidewater-swim"] });
    await db.exec("drop trigger fail_assignment on public.class_projects; drop function public.fail_assignment_test()");
    await save(2, "array['tidewater-swim','tidewater-swim']");
    assert.deepEqual(await snapshot(), { version: 3, projects: ["tidewater-swim"] });
    await save(3, "array[]::text[]");
    assert.deepEqual(await snapshot(), { version: 4, projects: [] });
    for (const invalid of ["null", "array[null]::text[]", "array_fill('harbour-clinic'::text,array[21])"]) {
      await assert.rejects(save(4, invalid), /Invalid project/);
    }
    await db.exec(`insert into public.generated_projects(id,owner_id,domain,topic,title,tagline,summary,draft,template_version,model) values
      ('gen-aaaaaaaaaa','${teacher}','d','t','t','t','s','{}',1,'test'),('gen-bbbbbbbbbb','${other}','d','t','t','t','s','{}',1,'test')`);
    await save(4, "array['gen-aaaaaaaaaa']");
    await assert.rejects(save(5, "array['gen-bbbbbbbbbb']"), /ownership/);
    assert.deepEqual(await snapshot(), { version: 5, projects: ["gen-aaaaaaaaaa"] });
    await db.exec("set role anon");
    await assert.rejects(db.exec(`select public.replace_class_projects('${cid}',5,array[]::text[])`), /permission/);
    await db.exec("reset role");
  } finally { await db.close(); }
});
