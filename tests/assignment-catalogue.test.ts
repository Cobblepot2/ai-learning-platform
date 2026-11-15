import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { assignableFor, assignProjects } from "../src/lib/classes";

const owner = "00000000-0000-4000-8000-000000000001";
function fixture(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({ id: `gen-${String(i).padStart(10, "0")}`, title: `Project ${i}`, owner_id: owner }));
  const foreign = { id: "gen-zzzzzzzzzz", title: "Another owner's public project", owner_id: "other-owner" };
  let failureAt = Infinity, reads = 0, writes = 0;
  const queries: URL[] = [];
  let stored = { projects: rows.slice(0, 1).map((row) => row.id), version: 0 };
  const db = createClient("https://database.example.test", "test-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname.endsWith("/rpc/replace_class_projects")) {
        writes++;
        const body = JSON.parse(String(init?.body));
        stored = { projects: body.p_projects, version: stored.version + 1 };
        return Response.json(stored.version);
      }
      reads++;
      queries.push(url);
      if (reads >= failureAt) return Response.json({ code: "57014", message: "Temporary read failure" }, { status: 503 });
      const after = url.searchParams.get("id")?.replace(/^gt\./, "") ?? "";
      const limit = Math.min(37, Number(url.searchParams.get("limit") ?? 37)); // A server-side cap smaller than a requested page.
      const page = [...rows, foreign].filter((row) => (!url.searchParams.has("owner_id") || row.owner_id === owner) && row.id > after).sort((a, b) => a.id.localeCompare(b.id)).slice(0, limit);
      return Response.json(page);
    } },
  });
  return { db, rows, queries, stored: () => stored, writes: () => writes, reads: () => reads,
    failFrom(read: number) { failureAt = read; }, recover() { failureAt = Infinity; } };
}

test("assignment choices include every owned project beyond 50 and beyond one server-capped page", async () => {
  const f = fixture(135);
  const allowed = await assignableFor(f.db, owner);
  assert.equal(allowed.filter((row) => row.id.startsWith("gen-")).length, 135);
  assert.ok(f.reads() > 1);
  assert.ok(f.queries.every((url) => url.searchParams.get("owner_id") === `eq.${owner}` && url.searchParams.get("select") === "id,title"));
  assert.ok(!allowed.some((row) => row.id === "gen-zzzzzzzzzz"));
  // A previously assigned, older project is visible and can remain selected.
  const old = f.rows[0].id;
  assert.ok(allowed.some((row) => row.id === old));
  assert.deepEqual(await assignProjects(f.db, "class", [old], allowed.map((row) => row.id), 0), { projects: [old], version: 1 });
  assert.deepEqual(f.stored(), { projects: [old], version: 1 });
});

test("first-page and mid-pagination read failures never turn a partial catalogue into a write", async () => {
  for (const failedRead of [1, 2]) {
    const f = fixture(135);
    f.failFrom(failedRead);
    async function save() {
      const allowed = await assignableFor(f.db, owner);
      return assignProjects(f.db, "class", [f.rows[0].id], allowed.map((row) => row.id), 0);
    }
    await assert.rejects(save(), (error: unknown) => (error as {status: number}).status === 503);
    assert.equal(f.writes(), 0);
    assert.deepEqual(f.stored(), { projects: [f.rows[0].id], version: 0 });
    f.recover();
    await save();
    assert.equal(f.writes(), 1);
    assert.deepEqual(f.stored(), { projects: [f.rows[0].id], version: 1 });
  }
});

test("an actually empty owned catalogue still allows assigning a built-in project", async () => {
  const f = fixture(0);
  const allowed = await assignableFor(f.db, owner);
  assert.ok(allowed.some((row) => row.id === "harbour-clinic"));
  await assignProjects(f.db, "class", ["harbour-clinic"], allowed.map((row) => row.id), 0);
  assert.deepEqual(f.stored().projects, ["harbour-clinic"]);
});

test("the class page resolves the current owner and refuses missing or failed identity reads", async () => {
  const f = fixture(2);
  const scoped = { from: f.db.from.bind(f.db), auth: { async getUser() { return { data: { user: { id: owner } }, error: null }; } } };
  assert.equal((await assignableFor(scoped as never)).filter((row) => row.id.startsWith("gen-")).length, 2);
  for (const error of [null, { message: "Temporary identity failure" }]) {
    await assert.rejects(assignableFor({ auth: { async getUser() { return { data: { user: null }, error }; } } } as never), (caught: unknown) => (caught as {status:number}).status === 503);
  }
});
