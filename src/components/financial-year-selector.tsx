"use client";

import { useId, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import { displayDate } from "@/lib/reports/dates";
import {
  financialYearEndDate,
  financialYearLabel,
  financialYearStartDate,
} from "@/lib/period/financial-year";
import { setFinancialYear } from "@/lib/period/actions";

const text = {
  label: "Financial Year",
  to: "to",
  current: "current",
} as const;

// The financial year in the top bar. The picked year is saved at once and the
// reports follow it. The first and last day of the year show beside it.
export function FinancialYearSelector({
  selected,
  current,
  years,
}: {
  selected: number;
  current: number;
  years: number[];
}) {
  const [value, setValue] = useState(selected);
  const [seen, setSeen] = useState(selected);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();

  // When the saved year changes on the server, show it.
  if (seen !== selected) {
    setSeen(selected);
    setValue(selected);
  }

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = Number(event.target.value);
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setFinancialYear(next);
      if (result.error) {
        setError(result.error);
        setValue(selected);
      }
    });
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <label htmlFor={id} className="hidden whitespace-nowrap text-xs font-medium text-muted xl:block">
        {text.label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        aria-label={text.label}
        aria-busy={pending}
        className="h-[34px] rounded-[9px] border border-border-soft bg-surface px-2 text-[0.82rem] text-text hover:border-border focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/30"
      >
        {[...years].reverse().map((year) => (
          <option key={year} value={year}>
            {financialYearLabel(year)}
            {year === current ? ` (${text.current})` : ""}
          </option>
        ))}
      </select>
      <span className="hidden whitespace-nowrap text-xs text-muted lg:inline">
        {displayDate(financialYearStartDate(value))} {text.to}{" "}
        {displayDate(financialYearEndDate(value))}
      </span>
      {error ? (
        <span role="alert" className="sr-only">
          {error}
        </span>
      ) : null}
    </div>
  );
}
