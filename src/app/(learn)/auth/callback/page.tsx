"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    const params = new URLSearchParams(window.location.search);
    if (!supabase) {
      router.replace("/");
      return;
    }
    // The provider reports failures (e.g. the user cancelled) in the query string.
    const providerError = params.get("error_description") ?? params.get("error");
    if (providerError) {
      setError(providerError);
      return;
    }
    // The browser client exchanges the ?code= itself while it initialises, and
    // getSession() waits for that. Exchanging the code again here would fail
    // because the PKCE verifier has already been used.
    supabase.auth.getSession().then(async ({ data }) => {
      // Full reload so the learner store picks up the new session and remote progress.
      if (!data.session) {
        setError(
          "This sign-in link has expired or was opened in a different browser. Please sign in again.",
        );
        return;
      }
      let destination = "/";
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.ok) {
          const account = await res.json();
          if (account?.isTeacher) destination = "/teach";
        }
      } catch {
        // Fall back to the learner home if role lookup is unavailable.
      }
      window.location.replace(destination);
    });
  }, [router]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center text-stone-600">
      {error ? (
        <>
          <p className="text-rose-600">Sign-in failed: {error}</p>
          <Link href="/login" className="mt-4 inline-block font-medium text-indigo-600 underline">
            Back to sign in
          </Link>
        </>
      ) : (
        <p>Signing you in…</p>
      )}
    </div>
  );
}
