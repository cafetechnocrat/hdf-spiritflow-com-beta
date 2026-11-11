// Placeholder shown while a page streams in. It keeps navigation instant.
export function PageLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading...</span>
      <div className="h-8 w-40 animate-pulse rounded-lg bg-track" />
      <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded-lg bg-track" />
      <div className="mt-6 h-64 animate-pulse rounded-2xl bg-surface" />
    </div>
  );
}
