import test from "node:test";
import assert from "node:assert/strict";
import { AssignmentConflict, createAssignmentSaver, type AssignmentSaveStatus } from "../src/lib/assignment-saver";
import { assignProjects } from "../src/lib/classes";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture() {
  const calls: { projects: string[]; version: number; resolve: (version: number) => void; reject: (error: Error) => void }[] = [];
  const statuses: AssignmentSaveStatus[] = [];
  let refreshes = 0;
  const saver = createAssignmentSaver(0, (projects, version) => new Promise<number>((resolve, reject) => {
    calls.push({ projects, version, resolve, reject });
  }), (status) => statuses.push(status), () => { refreshes++; });
  return { saver, calls, statuses, refreshes: () => refreshes };
}

test("rapid clicks serialize writes, coalesce pending choices and use the acknowledged version", async () => {
  const f = fixture();
  f.saver.choose(["A"]);
  f.saver.choose(["A", "B"]);
  f.saver.choose(["B"]);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].projects, ["A"]);
  assert.equal(f.saver.sync(99), false); // A late router refresh cannot erase pending intent.
  f.calls[0].resolve(1);
  await tick();
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[1].projects, ["B"]);
  assert.equal(f.calls[1].version, 1);
  assert.equal(f.refreshes(), 0);
  f.saver.choose([]); // Removing the last assignment must not be treated as no work.
  f.calls[1].resolve(2);
  await tick();
  assert.deepEqual(f.calls[2].projects, []);
  assert.equal(f.calls[2].version, 2);
  f.calls[2].resolve(3);
  await tick();
  assert.equal(f.refreshes(), 1);
  assert.deepEqual(f.statuses.at(-1), { saving: false, saved: true, error: null, conflict: false });
});

test("a failed request retains the latest choices for an explicit retry", async () => {
  const f = fixture();
  f.saver.choose(["A"]);
  f.saver.choose(["A", "B"]);
  f.calls[0].reject(new Error("Network failed"));
  await tick();
  assert.equal(f.statuses.at(-1)?.saved, false);
  assert.equal(f.refreshes(), 0);
  assert.equal(f.saver.sync(5), false);
  f.saver.retry();
  assert.deepEqual(f.calls[1].projects, ["A", "B"]);
  assert.equal(f.calls[1].version, 0);
  f.calls[1].resolve(1);
  await tick();
  assert.equal(f.statuses.at(-1)?.saved, true);
});

test("conflicts stop retries, including an ambiguous save whose response was lost", async () => {
  const f = fixture();
  f.saver.choose(["A"]);
  // The database may have committed even though the browser lost its response.
  f.calls[0].reject(new Error("Response lost"));
  await tick();
  f.saver.retry();
  assert.equal(f.calls[1].version, 0);
  f.calls[1].reject(new AssignmentConflict("Reload to review the saved choices"));
  await tick();
  f.saver.retry(); f.saver.choose(["B"]);
  assert.equal(f.calls.length, 2);
  assert.equal(f.statuses.at(-1)?.conflict, true);
  assert.equal(f.saver.sync(5), false);
  assert.equal(f.refreshes(), 0);
});

test("idle refreshes can advance a version, but stale refreshes cannot roll it back", () => {
  const f = fixture();
  assert.equal(f.saver.sync(2), true);
  assert.equal(f.saver.sync(1), false);
  f.saver.choose(["B"]);
  assert.equal(f.calls[0].version, 2);
  f.calls[0].resolve(3);
});

test("assignment API helper uses the atomic versioned RPC and maps stale writes to 409", async () => {
  const calls: unknown[] = [];
  const db = { async rpc(name: string, args: unknown) { calls.push([name, args]); return { data: 8, error: null }; } };
  assert.deepEqual(await assignProjects(db as never, "class", ["A", "A", "B"], ["A", "B"], 7), { projects: ["A", "B"], version: 8 });
  assert.deepEqual(calls, [["replace_class_projects", { p_class_id: "class", p_expected_version: 7, p_projects: ["A", "B"] }]]);
  await assert.rejects(assignProjects(db as never, "class", ["unavailable"], ["A"], 7), /no longer available/);
  assert.equal(calls.length, 1);
  await assert.rejects(assignProjects({ async rpc() { return { error: { code: "PT409" } }; } } as never, "class", [], [], 7), (error: unknown) => {
    return (error as { status: number }).status === 409;
  });
  await assert.rejects(assignProjects({ async rpc() { return { error: { code: "40001" } }; } } as never, "class", [], [], 7), (error: unknown) => {
    return (error as { status: number }).status === 503; // Real serialization failures remain retryable.
  });
});
