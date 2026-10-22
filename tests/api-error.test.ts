import test from "node:test";
import assert from "node:assert/strict";
import { PostgrestError } from "@supabase/postgrest-js";
import { apiError, HttpError } from "../src/lib/supabase/server";

async function body(error: unknown) {
  const response = apiError(error);
  return { status: response.status, json: await response.json() };
}

test("apiError maps known database codes and hides driver text", async () => {
  const plain = await body({
    message: 'new row violates row-level security policy for table "courses"',
    code: "42501",
    details: "Failing row contains secret-owner",
    hint: "Grant everything",
  });
  assert.equal(plain.status, 403);
  assert.deepEqual(plain.json, {
    error: "You do not have permission to do that.",
  });

  const unique = await body({
    message: "duplicate key value violates unique constraint",
    code: "23505",
  });
  assert.equal(unique.status, 409);
  assert.equal(unique.json.error, "That record already exists.");

  for (const code of ["23503", "23514", "23502", "22P02"]) {
    const invalid = await body({
      message: `driver detail ${code} secret-column`,
      code,
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.json.error, "That request is not valid.");
    assert.equal(JSON.stringify(invalid.json).includes("secret-column"), false);
  }

  const missing = await body(
    new PostgrestError({
      message: "Cannot coerce the result to a single JSON object",
      details: "The result contains 0 rows",
      hint: "",
      code: "PGRST116",
    }),
  );
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error, "Not found.");

  const unknown = await body({
    message: "column reference bucket is ambiguous",
    code: "42702",
    details: "internal",
  });
  assert.equal(unknown.status, 500);
  assert.equal(unknown.json.error, "Request failed.");
  assert.equal(JSON.stringify(unknown.json).includes("bucket"), false);
});

test("apiError does not return raw Error text", async () => {
  const http = await body(new HttpError(409, "Reload before saving."));
  assert.equal(http.status, 409);
  assert.equal(http.json.error, "Reload before saving.");

  const leaked = await body(new Error("relation secret_table does not exist"));
  assert.equal(leaked.status, 500);
  assert.equal(leaked.json.error, "Request failed.");
  assert.equal(JSON.stringify(leaked.json).includes("secret_table"), false);

  const blank = await body("nope");
  assert.equal(blank.status, 500);
  assert.equal(blank.json.error, "Request failed.");
});
