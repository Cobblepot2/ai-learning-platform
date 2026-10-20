"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    const code = new URLSearchParams(window.location.search).get("code");
    if (!supabase || !code) {
      router.replace("/");
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setError(error.message);
      // Full reload so the learner store picks up the new session and remote progress.
      else window.location.replace("/dashboard");
    });
  }, [router]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center text-stone-600">
      {error ? <p className="text-rose-600">Sign-in failed: {error}</p> : <p>Signing you in…</p>}
    </div>
  );
}
