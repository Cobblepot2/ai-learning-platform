'use client';
export default function ErrorPage({ reset }: { reset: ()=>void }) {
  return <section className="mx-auto max-w-xl space-y-4 p-8"><h1 className="text-2xl font-bold">This content could not be loaded</h1><p>The course may contain an unsupported activity, or course storage is unavailable. Ask the course owner to check its configuration.</p><button className="rounded bg-indigo-600 px-4 py-2 text-white" onClick={reset}>Try again</button></section>;
}
