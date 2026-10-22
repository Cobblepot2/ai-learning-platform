import test from "node:test";
import assert from "node:assert/strict";
import { courseForClient } from "../src/lib/learning/course-view";

const row = {
  id: "10000000-0000-4000-8000-000000000001",
  owner_id: "00000000-0000-4000-8000-000000000009",
  status: "published",
  visibility: "public",
  revision: 4,
  document: { id: "10000000-0000-4000-8000-000000000001", title: "Public" },
  created_at: "2026-10-22T00:00:00Z",
  updated_at: "2026-10-22T01:00:00Z",
};

test("accessible courses omit another owner's private columns", () => {
  const visible = courseForClient(row, "00000000-0000-4000-8000-000000000002", true);
  assert.deepEqual(visible, {
    id: row.id,
    status: "published",
    visibility: "public",
    document: row.document,
  });
  assert.equal("owner_id" in visible, false);
  assert.equal("revision" in visible, false);
  assert.equal("created_at" in visible, false);
  assert.equal("updated_at" in visible, false);
});

test("the caller still receives owner fields for their own courses", () => {
  const own = courseForClient(row, row.owner_id, true);
  if (!("owner_id" in own) || !("revision" in own)) {
    assert.fail("own course dropped owner fields");
  }
  assert.equal(own.owner_id, row.owner_id);
  assert.equal(own.revision, 4);
  const studio = courseForClient(row, "someone-else", false);
  if (!("owner_id" in studio)) assert.fail("studio list dropped owner_id");
  assert.equal(studio.owner_id, row.owner_id);
});
