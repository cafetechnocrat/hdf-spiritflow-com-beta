"use client";

import { useId } from "react";
import { button, field } from "@/components/ui/styles";
import { PAGE_SIZES } from "@/lib/paging";

// All visible text sits here so it can be translated later.
const text = {
  rowsPerPage: "Rows per page",
  first: "First",
  previous: "Previous",
  next: "Next",
  last: "Last",
  pagerLabel: "Pages",
} as const;

const NUMBER = new Intl.NumberFormat("en-IN");

// Rows per page, and First, Previous, Next and Last, under a list that is read a
// page at a time. It works from a phone up: the two groups stack and the buttons
// stay large enough to tap.
export function Pager({
  total,
  page,
  size,
  onChange,
}: {
  total: number;
  page: number;
  size: number;
  onChange: (next: { page: number; size: number }) => void;
}) {
  const selectId = useId();
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(page, 1), pages);
  const from = total === 0 ? 0 : (current - 1) * size + 1;
  const to = Math.min(total, current * size);
  const nav = `${button.secondary} ${button.small} min-w-[72px] flex-1 sm:flex-none`;
  return (
    <nav
      aria-label={text.pagerLabel}
      className="mt-3 flex flex-col gap-3 rounded-2xl bg-surface px-3.5 py-3 text-[0.84rem] shadow-[0_1px_3px_rgba(0,0,0,0.05)] md:flex-row md:items-center md:justify-between"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label htmlFor={selectId} className="text-muted">
          {text.rowsPerPage}
        </label>
        <select
          id={selectId}
          value={size}
          onChange={(event) => onChange({ page: 1, size: Number(event.target.value) })}
          className={`${field.input} !h-10 !w-auto min-w-[84px] sm:!h-9`}
        >
          {PAGE_SIZES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="tabular-nums text-muted">
          {`Showing ${NUMBER.format(from)} to ${NUMBER.format(to)} of ${NUMBER.format(total)}`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={nav}
          disabled={current <= 1}
          onClick={() => onChange({ page: 1, size })}
        >
          {text.first}
        </button>
        <button
          type="button"
          className={nav}
          disabled={current <= 1}
          onClick={() => onChange({ page: current - 1, size })}
        >
          {text.previous}
        </button>
        <span className="order-first w-full px-1.5 text-center tabular-nums text-muted sm:order-none sm:w-auto sm:text-left">
          {`Page ${current} of ${NUMBER.format(pages)}`}
        </span>
        <button
          type="button"
          className={nav}
          disabled={current >= pages}
          onClick={() => onChange({ page: current + 1, size })}
        >
          {text.next}
        </button>
        <button
          type="button"
          className={nav}
          disabled={current >= pages}
          onClick={() => onChange({ page: pages, size })}
        >
          {text.last}
        </button>
      </div>
    </nav>
  );
}
