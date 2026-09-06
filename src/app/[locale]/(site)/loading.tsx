/** Shown while a page's data loads. Keeps the layout stable instead of blank. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16" aria-busy="true">
      <div className="h-3 w-24 animate-pulse rounded bg-sand-200" />
      <div className="mt-4 h-10 w-2/3 animate-pulse rounded bg-sand-200" />
      <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-sand-200" />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card h-56 animate-pulse bg-sand-100" />
        ))}
      </div>
    </div>
  );
}
