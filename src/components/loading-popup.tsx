// A popup that tells the person data is loading and to wait. It covers the screen
// so nothing is clicked meanwhile, and goes away when the work finishes.
export function LoadingPopup({ message = "Loading data... please wait" }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/35 px-4"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-surface px-5 py-4 text-text shadow-card">
        <span
          className="h-5 w-5 flex-none animate-spin rounded-full border-2 border-track border-t-accent"
          aria-hidden="true"
        />
        <span className="text-[0.92rem] font-medium">{message}</span>
      </div>
    </div>
  );
}
