'use client';
export default function ErrorPage({ reset }: { reset: ()=>void }) {
  return <section className="mx-auto max-w-xl space-y-4 p-8"><h1 className="text-2xl font-bold">Something went wrong</h1><p>The page could not be loaded. Your project progress is saved, so you can try again.</p><button className="rounded bg-indigo-600 px-4 py-2 text-white" onClick={reset}>Try again</button></section>;
}
