"use client";

import { useId, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import { setTransactionDate } from "@/lib/vouchers/actions";

const text = {
  label: "Transaction Date",
  backDated: "Back-dated",
  saving: "Saving...",
} as const;

// A small label and a calendar in the top bar. The date is saved the moment it
// is picked. New vouchers start on this date. A dot shows when it is not today.
export function TransactionDateSelector({ date, today }: { date: string; today: string }) {
  const [value, setValue] = useState(date);
  const [seenDate, setSeenDate] = useState(date);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();

  // When the saved date changes on the server, show it.
  if (seenDate !== date) {
    setSeenDate(date);
    setValue(date);
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    if (!next) return;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setTransactionDate(next);
      if (result.error) {
        setError(result.error);
        setValue(date);
      }
    });
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <label htmlFor={id} className="hidden whitespace-nowrap text-xs font-medium text-muted sm:block">
        {text.label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={onChange}
        aria-label={text.label}
        aria-busy={pending}
        className="h-[34px] w-[128px] rounded-[9px] border border-border-soft bg-surface px-2 text-[0.82rem] text-text hover:border-border focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/30 sm:w-[136px]"
      />
      {value !== today ? (
        <span
          title={text.backDated}
          role="img"
          aria-label={text.backDated}
          className="h-2 w-2 flex-none rounded-full bg-warn"
        />
      ) : null}
      {error ? (
        <span role="alert" className="sr-only">
          {error}
        </span>
      ) : null}
    </div>
  );
}
