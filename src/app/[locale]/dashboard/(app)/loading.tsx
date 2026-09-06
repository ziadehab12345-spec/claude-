export default function Loading() {
  return (
    <div aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded bg-sand-200" />
      <div className="card mt-6 h-16 animate-pulse bg-sand-100" />
      <div className="card mt-6 h-96 animate-pulse bg-sand-100" />
    </div>
  );
}
