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
      "Configure Supabase to save courses and learning records.",
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
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json(
    { error: error instanceof Error ? error.message : "Request failed." },
    { status: 400 },
  );
}
