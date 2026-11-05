import test from "node:test";
import assert from "node:assert/strict";
import { roleChangeProblem } from "../src/lib/admin";

test("an admin switches others between student and instructor, and nothing else", () => {
  const admin = "admin-id";
  assert.equal(roleChangeProblem(admin, { id: "s", role: "student" }, "instructor"), null);
  assert.equal(roleChangeProblem(admin, { id: "t", role: "instructor" }, "student"), null);
  assert.match(roleChangeProblem(admin, { id: "s", role: "student" }, "admin")!, /student or instructor/);
  assert.match(roleChangeProblem(admin, { id: admin, role: "admin" }, "student")!, /your own role/);
  assert.match(roleChangeProblem(admin, { id: "other-admin", role: "admin" }, "student")!, /SQL editor/);
  assert.match(roleChangeProblem(admin, null, "student")!, /doesn't exist/);
});
