import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function serverDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Read-only server component. Browser refreshes the session. */
        }
      },
    },
  });
}
export async function requireAccount(teacher = false) {
  const db = await serverDb();
  if (!db)
    throw new HttpError(
      503,
      "Configure Supabase to save project runs.",
    );
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Sign in to continue.");
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (profileError) throw new HttpError(403, "Your profile is unavailable.");
  const isTeacher = ["instructor", "admin"].includes(profile.role);
  if (teacher && !isTeacher)
    throw new HttpError(403, "Instructor access required.");
  return { db, user: data.user, isTeacher };
}
// Only used after authorizing an activity against the user's RLS-scoped client.
export function recordDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL)
    throw new HttpError(
      503,
      "Server learning-record storage is not configured.",
    );
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const GENERIC_FAILURE = "Request failed.";

// PostgrestError is a plain object in some client versions and an Error in
// others. Branch on the code either way, and never send driver text to the client.
const DATABASE_ERRORS: Record<string, { status: number; message: string }> = {
  "42501": { status: 403, message: "You do not have permission to do that." },
  "23505": { status: 409, message: "That record already exists." },
  "23503": { status: 400, message: "That request is not valid." },
  "23502": { status: 400, message: "That request is not valid." },
  "23514": { status: 400, message: "That request is not valid." },
  "22P02": { status: 400, message: "That request is not valid." },
  "22001": { status: 400, message: "That request is not valid." },
  "22003": { status: 400, message: "That request is not valid." },
  PGRST116: { status: 404, message: "Not found." },
};

function databaseCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return null;
  if (/^[0-9A-Z]{5}$/.test(code) || /^PGRST\d+$/.test(code)) return code;
  return null;
}

export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  const mapped = DATABASE_ERRORS[databaseCode(error) ?? ""];
  if (mapped)
    return Response.json({ error: mapped.message }, { status: mapped.status });
  return Response.json({ error: GENERIC_FAILURE }, { status: 500 });
}
