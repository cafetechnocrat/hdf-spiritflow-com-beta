"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

const text = { refresh: "Refresh", refreshing: "Refreshing..." } as const;

// Reads every figure again. The dashboard does not refresh by itself.
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-surface px-3 text-[0.8rem] font-medium text-text shadow-[0_0_0_1px_var(--color-divider)] hover:bg-background disabled:opacity-60 print:hidden"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`}
      >
        <path d="M20 12a8 8 0 11-2.3-5.6M20 4v5h-5" />
      </svg>
      {pending ? text.refreshing : text.refresh}
    </button>
  );
}
